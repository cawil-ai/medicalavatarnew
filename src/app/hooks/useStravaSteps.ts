/**
 * useStravaSteps.ts
 * ─────────────────────────────────────────────────────────────────
 * Strava API integration for the Steps Tracker.
 *
 * FLOW:
 *  1. On mount, attempt a silent token refresh via /oauth/token
 *     (grant_type=refresh_token) using VITE_STRAVA_REFRESH_TOKEN.
 *  2. Fetch today's activities with /athlete/activities (after=midnight).
 *  3. Count steps from walking/running/hiking activities.
 *     Strava does not expose raw step counts, so we convert:
 *       steps ≈ distance_meters / STRIDE_LENGTH_M
 *     with sport-specific stride lengths for accuracy.
 *  4. Expose { stravaSteps, stravaActivities, loading, error, sync }.
 *
 * ENV VARS (add to .env):
 *   VITE_STRAVA_CLIENT_ID      = 222559
 *   VITE_STRAVA_CLIENT_SECRET  = 696359ad134d8a0cc4f62b3d39401f91df35ba2e
 *   VITE_STRAVA_REFRESH_TOKEN  = e066cd8eb3ff262738df4c38d1e17a114fd7d295
 *   VITE_STRAVA_ACCESS_TOKEN   = aa7ca96fd151d1783461c7cc932837fc700605ed  (optional seed)
 *
 * RATE LIMITS: 100 read req / 15 min, 1 000 / day.
 * This hook caches the last fetch in sessionStorage and only re-fetches
 * when the cached timestamp is older than CACHE_TTL_MS (5 min).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Constants ──────────────────────────────────────────────────────
const STRAVA_BASE        = 'https://www.strava.com/api/v3';
const TOKEN_URL          = 'https://www.strava.com/oauth/token';
const CACHE_TTL_MS       = 5 * 60 * 1000;   // 5 minutes
const CACHE_KEY          = 'strava_cache_v1';
const TOKEN_CACHE_KEY    = 'strava_token_v1';

/** Activity types Strava may return that contribute to step count */
const STEP_ACTIVITY_TYPES = new Set([
  'Walk', 'Run', 'TrailRun', 'Hike',
  'VirtualRun', 'Workout',               // some treadmill sessions
]);

/** Approximate stride length per activity type (metres per step) */
const STRIDE_M: Record<string, number> = {
  Walk:       0.75,
  Hike:       0.70,
  Run:        0.95,
  TrailRun:   0.85,
  VirtualRun: 0.95,
  Workout:    0.75,
  default:    0.75,
};

// ── Types ──────────────────────────────────────────────────────────
export interface StravaActivity {
  id:             number;
  name:           string;
  type:           string;
  sport_type:     string;
  start_date:     string;     // ISO-8601 UTC
  distance:       number;     // metres
  moving_time:    number;     // seconds
  elapsed_time:   number;     // seconds
  total_elevation_gain: number;
  average_speed:  number;     // m/s
  max_speed:      number;     // m/s
  steps?:         number;     // computed by this hook
}

export interface StravaState {
  stravaSteps:      number;
  stravaActivities: StravaActivity[];
  loading:          boolean;
  error:            string | null;
  lastSynced:       Date | null;
  sync:             () => Promise<void>;
  isConnected:      boolean;
}

// interface TokenCache {
//   access_token:  string;
//   expires_at:    number;   // Unix seconds
// }

type TokenCache = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

interface ActivityCache {
  activities: StravaActivity[];
  fetchedAt:  number;      // Date.now() ms
  dateKey:    string;      // YYYY-MM-DD (so cache invalidates on day change)
}

// ── Helpers ────────────────────────────────────────────────────────
function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function midnightUnix(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function distanceToSteps(activity: StravaActivity): number {
  const type   = activity.sport_type || activity.type || 'default';
  const stride = STRIDE_M[type] ?? STRIDE_M.default;
  return Math.round(activity.distance / stride);
}

function getTokenCache(): TokenCache | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setTokenCache(data: TokenCache) {
  try { sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(data)); } catch {}
}

function getActivityCache(): ActivityCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: ActivityCache = JSON.parse(raw);
    // Invalidate on new day
    if (cache.dateKey !== todayKey()) return null;
    return cache;
  } catch { return null; }
}

function setActivityCache(activities: StravaActivity[]) {
  try {
    const cache: ActivityCache = { activities, fetchedAt: Date.now(), dateKey: todayKey() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ── Hook ───────────────────────────────────────────────────────────
export function useStravaSteps(): StravaState {
  const [stravaSteps,      setStravaSteps]      = useState(0);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [lastSynced,       setLastSynced]       = useState<Date | null>(null);
  const [isConnected,      setIsConnected]      = useState(false);

  const accessTokenRef = useRef<string>(
    import.meta.env.VITE_STRAVA_ACCESS_TOKEN ?? ''
  );

  // ── 1. Refresh access token ──────────────────────────────────────
  // const refreshAccessToken = useCallback(async (): Promise<string> => {
  //   // Check session cache first
  //   const cached = getTokenCache();
  //   if (cached && cached.expires_at > Date.now() / 1000 + 60) {
  //     accessTokenRef.current = cached.access_token;
  //     return cached.access_token;
  //   }

  //   const clientId     = import.meta.env.VITE_STRAVA_CLIENT_ID;
  //   const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
  //   const refreshToken = import.meta.env.VITE_STRAVA_REFRESH_TOKEN;

  //   if (!clientId || !clientSecret || !refreshToken) {
  //     throw new Error(
  //       'Missing Strava env vars. Add VITE_STRAVA_CLIENT_ID, ' +
  //       'VITE_STRAVA_CLIENT_SECRET and VITE_STRAVA_REFRESH_TOKEN to your .env.'
  //     );
  //   }

  //   const res = await fetch(TOKEN_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       client_id:     clientId,
  //       client_secret: clientSecret,
  //       refresh_token: refreshToken,
  //       grant_type:    'refresh_token',
  //     }),
  //   });

  //   if (!res.ok) {
  //     const msg = await res.text().catch(() => res.statusText);
  //     throw new Error(`Strava token refresh failed (${res.status}): ${msg}`);
  //   }

  //   const data = await res.json();
  //   const tokenData: TokenCache = {
  //     access_token: data.access_token,
  //     expires_at:   data.expires_at,
  //   };
  //   setTokenCache(tokenData);
  //   accessTokenRef.current = data.access_token;
  //   return data.access_token;
  // }, []);
  const refreshAccessToken = useCallback(async (): Promise<string> => {
  // Check cache first
  const cached = getTokenCache();
  if (cached && cached.expires_at > Date.now() / 1000 + 60) {
    accessTokenRef.current = cached.access_token;
    return cached.access_token;
  }

  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
  const refreshToken =
    cached?.refresh_token || import.meta.env.VITE_STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Strava env vars. Add VITE_STRAVA_CLIENT_ID, ' +
      'VITE_STRAVA_CLIENT_SECRET and VITE_STRAVA_REFRESH_TOKEN to your .env.'
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Strava token refresh failed (${res.status}): ${msg}`);
  }

  const data = await res.json();

  const tokenData: TokenCache = {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // IMPORTANT: persist newest refresh token
    expires_at: data.expires_at,
  };

  setTokenCache(tokenData);
  accessTokenRef.current = data.access_token;

  return data.access_token;
}, []);

  // ── 2. Fetch today's activities ──────────────────────────────────
  const fetchTodayActivities = useCallback(async (token: string): Promise<StravaActivity[]> => {
    // Check cache freshness
    const cache = getActivityCache();
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache.activities;
    }

    const params = new URLSearchParams({
      after:    String(midnightUnix()),
      per_page: '50',
    });

    const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      throw new Error('Strava token expired — please reconnect your account.');
    }
    if (res.status === 429) {
      throw new Error('Strava rate limit reached. Try again in a few minutes.');
    }
    if (!res.ok) {
      throw new Error(`Strava activities fetch failed (${res.status}).`);
    }

    const raw: StravaActivity[] = await res.json();

    // Annotate with computed step count
    const annotated = raw.map(a => ({
      ...a,
      steps: STEP_ACTIVITY_TYPES.has(a.sport_type || a.type) ? distanceToSteps(a) : 0,
    }));

    setActivityCache(annotated);
    return annotated;
  }, []);

  // ── 3. Main sync function ─────────────────────────────────────────
  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token      = await refreshAccessToken();
      const activities = await fetchTodayActivities(token);

      // Sum steps from qualifying activities today
      const totalSteps = activities.reduce(
        (sum, a) => sum + (a.steps ?? 0), 0
      );

      setStravaActivities(activities);
      setStravaSteps(totalSteps);
      setIsConnected(true);
      setLastSynced(new Date());
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown Strava error.';
      setError(msg);
      setIsConnected(false);
      console.error('[Strava]', msg);
    } finally {
      setLoading(false);
    }
  }, [refreshAccessToken, fetchTodayActivities]);

  // ── 4. Auto-sync on mount + periodic refresh every 5 min ─────────
  useEffect(() => {
    sync();
    const interval = setInterval(sync, CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [sync]);

  return {
    stravaSteps,
    stravaActivities,
    loading,
    error,
    lastSynced,
    sync,
    isConnected,
  };
}