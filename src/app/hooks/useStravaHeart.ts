/**
 * useStravaHeart.ts
 * ─────────────────────────────────────────────────────────────────
 * Wearable heart-rate integration (prototype).
 *
 * Mirrors useStravaSteps.ts: it performs a silent token refresh and
 * pulls today's Strava activities, but instead of deriving steps it
 * surfaces the heart-rate stream Strava records when an HR monitor /
 * watch is worn (`average_heartrate`, `max_heartrate`, `has_heartrate`).
 *
 * Reuses the existing VITE_STRAVA_* env vars and the shared token cache
 * key — NO new secrets. Degrades gracefully when activities have no HR
 * data (older phones, no chest strap), returning isConnected with empty
 * samples so the UI can show a "no HR data" state rather than an error.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { LOCAL_MODE } from '../../lib/appwrite';

const STRAVA_BASE     = 'https://www.strava.com/api/v3';
const TOKEN_URL       = 'https://www.strava.com/oauth/token';
const CACHE_TTL_MS    = 5 * 60 * 1000;
const HR_CACHE_KEY    = 'strava_hr_cache_v1';
const TOKEN_CACHE_KEY = 'strava_token_v1';   // shared with useStravaSteps

interface HrActivity {
  id:                number;
  name:              string;
  type:              string;
  sport_type:        string;
  start_date:        string;
  moving_time:       number;
  has_heartrate?:    boolean;
  average_heartrate?: number;
  max_heartrate?:    number;
}

export interface StravaHeartSample {
  id:    number;
  name:  string;
  sport: string;
  start: string;
  avgHr: number;
  maxHr: number;
  elapsedMin?: number;
}

export interface StravaHeartState {
  avgHr:       number;            // session-weighted average across today's HR activities
  maxHr:       number;            // highest HR recorded today
  samples:     StravaHeartSample[];
  loading:     boolean;
  error:       string | null;
  lastSynced:  Date | null;
  isConnected: boolean;
  sync:        () => Promise<StravaHeartSample[]>;
}

type TokenCache = { access_token: string; refresh_token: string; expires_at: number };
interface HrCache { samples: StravaHeartSample[]; fetchedAt: number; dateKey: string }

const todayKey = () => new Date().toISOString().split('T')[0];
const midnightUnix = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); };

function getTokenCache(): TokenCache | null {
  try { const raw = sessionStorage.getItem(TOKEN_CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function setTokenCache(d: TokenCache) { try { sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(d)); } catch {} }
function getHrCache(): HrCache | null {
  try {
    const raw = sessionStorage.getItem(HR_CACHE_KEY);
    if (!raw) return null;
    const c: HrCache = JSON.parse(raw);
    return c.dateKey === todayKey() ? c : null;
  } catch { return null; }
}
function setHrCache(samples: StravaHeartSample[]) {
  try { sessionStorage.setItem(HR_CACHE_KEY, JSON.stringify({ samples, fetchedAt: Date.now(), dateKey: todayKey() })); } catch {}
}

export function useStravaHeart(): StravaHeartState {
  const [avgHr,       setAvgHr]       = useState(0);
  const [maxHr,       setMaxHr]       = useState(0);
  const [samples,     setSamples]     = useState<StravaHeartSample[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [lastSynced,  setLastSynced]  = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const accessTokenRef = useRef<string>(import.meta.env.VITE_STRAVA_ACCESS_TOKEN ?? '');

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    const cached = getTokenCache();
    if (cached && cached.expires_at > Date.now() / 1000 + 60) {
      accessTokenRef.current = cached.access_token;
      return cached.access_token;
    }
    const clientId     = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
    const refreshToken = cached?.refresh_token || import.meta.env.VITE_STRAVA_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Strava env vars (VITE_STRAVA_CLIENT_ID / _SECRET / _REFRESH_TOKEN).');
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    if (!res.ok) throw new Error(`Strava token refresh failed (${res.status}).`);
    const data = await res.json();
    setTokenCache({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at });
    accessTokenRef.current = data.access_token;
    return data.access_token;
  }, []);

  const fetchHeartActivities = useCallback(async (token: string): Promise<StravaHeartSample[]> => {
    const cache = getHrCache();
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.samples;

    const params = new URLSearchParams({ after: String(midnightUnix()), per_page: '50' });
    const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error('Strava token expired — please reconnect.');
    if (res.status === 429) throw new Error('Strava rate limit reached. Try again shortly.');
    if (!res.ok) throw new Error(`Strava activities fetch failed (${res.status}).`);

    const raw: HrActivity[] = await res.json();
    const samples: StravaHeartSample[] = raw
      .filter(a => a.has_heartrate && (a.average_heartrate ?? 0) > 0)
      .map(a => ({
        id: a.id, name: a.name, sport: a.sport_type || a.type, start: a.start_date,
        avgHr: Math.round(a.average_heartrate ?? 0), maxHr: Math.round(a.max_heartrate ?? 0),
        elapsedMin: Math.round((a.moving_time ?? 0) / 60) || 30,
      }));
    setHrCache(samples);
    return samples;
  }, []);

  const sync = useCallback(async (): Promise<StravaHeartSample[]> => {
    setLoading(true); setError(null);

    // Local mode: no Strava creds, so simulate a wearable session so the
    // Sync button is demonstrably functional. Replaced by the real Strava
    // pull in production (LOCAL_MODE off).
    if (LOCAL_MODE) {
      await new Promise(r => setTimeout(r, 650)); // brief "syncing…" feel
      
      const activities = [
        { name: 'Morning Run', sport: 'Running', avg: 142, max: 170 },
        { name: 'Evening Walk', sport: 'Walking', avg: 92, max: 112 },
        { name: 'Trail Run', sport: 'Running', avg: 148, max: 178 },
        { name: 'Sunset Ride', sport: 'Cycling', avg: 124, max: 154 },
        { name: 'HIIT Session', sport: 'HIIT', avg: 156, max: 184 },
        { name: 'Gym Workout', sport: 'Gym', avg: 112, max: 142 },
        { name: 'Lap Swim', sport: 'Swimming', avg: 128, max: 158 },
      ];
      
      const selected = activities[Math.floor(Math.random() * activities.length)];
      const jitter = (n: number) => n + Math.floor(Math.random() * 8) - 4;
      
      const elapsedMin = 20 + Math.floor(Math.random() * 70); // 20-90 minutes
      
      const demo: StravaHeartSample[] = [
        { 
          id: Date.now(), 
          name: selected.name,  
          sport: selected.sport,  
          start: new Date().toISOString(), 
          avgHr: jitter(selected.avg), 
          maxHr: jitter(selected.max),
          elapsedMin
        },
      ];
      
      setSamples(demo);
      setAvgHr(demo[0].avgHr);
      setMaxHr(demo[0].maxHr);
      setIsConnected(true);
      setLastSynced(new Date());
      setLoading(false);
      return demo;
    }

    try {
      const token   = await refreshAccessToken();
      const samples = await fetchHeartActivities(token);

      // Duration-weighted average across sessions; simple max across all.
      const totalAvg = samples.reduce((s, x) => s + x.avgHr, 0);
      const computedAvg = samples.length ? Math.round(totalAvg / samples.length) : 0;
      const computedMax = samples.reduce((m, x) => Math.max(m, x.maxHr), 0);

      setSamples(samples);
      setAvgHr(computedAvg);
      setMaxHr(computedMax);
      setIsConnected(true);
      setLastSynced(new Date());
      return samples;
    } catch (err: any) {
      setError(err?.message ?? 'Unknown Strava error.');
      setIsConnected(false);
      console.error('[StravaHeart]', err?.message ?? err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [refreshAccessToken, fetchHeartActivities]);

  // Auto-sync on mount in BOTH modes: production pulls today's real HR,
  // local mode runs the simulated wearable session so the chip is connected
  // and populated automatically (no manual click needed).
  useEffect(() => { sync(); }, [sync]);

  return { avgHr, maxHr, samples, loading, error, lastSynced, isConnected, sync };
}
