import { databases, DATABASE_ID, COLLECTIONS, ID, Query, LOCAL_MODE } from '../lib/appwrite';
import type { FallEvent } from './fallAlgorithm';

/* ── Types ──────────────────────────────────────────────────────── */
export interface EmergencyContact {
  id:    string;
  name:  string;
  phone: string;
  email?: string;
  pref?: 'phone' | 'email' | 'both';
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

/* ── localStorage keys (used in LOCAL_MODE) ─────────────────────── */
const EVENTS_KEY   = 'cawil_local_fall_events';
const CONTACTS_KEY = 'cawil_local_emergency_contacts';

function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ══════════════════════════════════════════════════════════════════
   FALL EVENTS (append-only history)
   Prod Appwrite collection `fall_detection_logs` attributes:
     userID (text), date (datetime), emergencyContact (text), latitude
     (double), longitude (double), confidenceScore (double), status (text)
══════════════════════════════════════════════════════════════════ */
const severityFromConfidence = (c?: number): FallEvent['severity'] =>
  c == null ? 'moderate' : c >= 66 ? 'high' : c >= 33 ? 'moderate' : 'low';

export async function saveFallEvent(userId: string, event: FallEvent) {
  if (LOCAL_MODE) {
    const all = readJSON<FallEvent[]>(EVENTS_KEY, []);
    writeJSON(EVENTS_KEY, [event, ...all].slice(0, 200));
    return event;
  }
  return await databases.createDocument(DATABASE_ID, COLLECTIONS.fallEvents, ID.unique(), {
    userID:           userId,
    date:             event.ts,
    status:           event.action,
    latitude:         event.lat ?? null,
    longitude:        event.lng ?? null,
    confidenceScore:  event.confidence ?? null,
    emergencyContact: event.emergencyContact ?? null,
  });
}

export async function getFallEvents(userId: string): Promise<FallEvent[]> {
  if (LOCAL_MODE) return readJSON<FallEvent[]>(EVENTS_KEY, []);
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.fallEvents,
    [Query.equal('userID', userId), Query.orderDesc('date'), Query.limit(100)]);
  return res.documents.map((d: any) => {
    const confidence = d.confidenceScore ?? undefined;
    return {
      id: d.$id, ts: d.date, action: d.status ?? 'Detected',
      severity: severityFromConfidence(confidence), type: 'fall' as const,
      impactG: 0, stillnessMs: 0, confidence,
      emergencyContact: d.emergencyContact ?? undefined,
      lat: d.latitude ?? undefined, lng: d.longitude ?? undefined,
    };
  });
}

export async function deleteFallEvent(userId: string, id: string) {
  if (LOCAL_MODE) {
    writeJSON(EVENTS_KEY, readJSON<FallEvent[]>(EVENTS_KEY, []).filter(e => e.id !== id));
    return;
  }
  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.fallEvents, id);
}

/* ══════════════════════════════════════════════════════════════════
   EMERGENCY CONTACTS (list, upserted as one record)
   Prod Appwrite collection `emergency_contacts` attributes:
     userID, data (string — JSON-encoded EmergencyContact[])
══════════════════════════════════════════════════════════════════ */
export async function getContacts(userId: string): Promise<EmergencyContact[]> {
  if (LOCAL_MODE) return readJSON<EmergencyContact[]>(CONTACTS_KEY, []);
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.emergencyContacts,
    [Query.equal('userID', userId), Query.limit(1)]);
  const doc: any = res.documents[0];
  try { return doc ? JSON.parse(doc.data) as EmergencyContact[] : []; } catch { return []; }
}

export async function saveContacts(userId: string, contacts: EmergencyContact[]) {
  if (LOCAL_MODE) { writeJSON(CONTACTS_KEY, contacts); return; }
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.emergencyContacts,
    [Query.equal('userID', userId), Query.limit(1)]);
  const payload = { userID: userId, data: JSON.stringify(contacts) };
  if (res.documents[0]) {
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.emergencyContacts, res.documents[0].$id, payload);
  } else {
    await databases.createDocument(DATABASE_ID, COLLECTIONS.emergencyContacts, ID.unique(), payload);
  }
}

/* ══════════════════════════════════════════════════════════════════
   NOTIFICATION — native browser notification (secondary channel; the
   primary fail-safe is the SOS alarm below, plus the email alerts).
══════════════════════════════════════════════════════════════════ */
function browserNotify(title: string, body: string) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') new Notification(title, { body });
    else if (Notification.permission !== 'denied')
      Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body }); });
  } catch { /* ignore */ }
}

export function notifyEmergencyContacts(
  contacts: EmergencyContact[],
  location: GeoLocation | null,
): void {
  const mapsLink = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : null;
  browserNotify('🚨 Fall detected — SOS', `Notifying ${contacts.length} contact(s).${mapsLink ? ' Location attached.' : ''}`);
}

/* ══════════════════════════════════════════════════════════════════
   EMAIL ALERTS via Novu
   Sends an individual email to every contact that has an address.
══════════════════════════════════════════════════════════════════ */
const NOVU_API_KEY = (import.meta.env.VITE_NOVU_API_KEY || '').trim();
const NOVU_TRIGGER_URL = 'https://api.novu.co/v1/events/trigger';
const NOVU_USE_PROXY = import.meta.env.VITE_NOVU_USE_PROXY !== 'false';
const NOVU_SERVER_TRIGGER = (import.meta.env.VITE_NOVU_TRIGGER_URL || '').trim();

const NOVU_PROXY_BUILDERS = [
  { name: 'corsproxy.io', build: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}` },
  { name: 'thingproxy.freeboard.io', build: (target: string) => `https://thingproxy.freeboard.io/fetch/${target}` },
  { name: 'yacdn.org', build: (target: string) => `https://yacdn.org/proxy/${target}` },
  { name: 'api.codetabs.com', build: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}` },
];

async function triggerNovuEndpoint(requestInit: RequestInit) {
  const candidates: { name: string; build: (target: string) => string }[] = [];

  // Prefer a server-side trigger URL if provided (deployed to Railway or similar)
  if (NOVU_SERVER_TRIGGER) candidates.push({ name: 'server', build: () => NOVU_SERVER_TRIGGER });

  // Optionally try public proxies (least preferred)
  if (NOVU_USE_PROXY) candidates.push(...NOVU_PROXY_BUILDERS);

  // Last resort: try direct Novu endpoint (will fail from browsers due to CORS)
  candidates.push({ name: 'direct', build: (t: string) => t });

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    const url = candidate.build(NOVU_TRIGGER_URL);
    try {
      const response = await fetch(url, requestInit);
      if (response.ok) return response;

      const body = await response.text().catch(() => 'Unable to read response body');
      throw new Error(`${candidate.name} returned ${response.status}: ${body}`);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[fall] Novu trigger via ${candidate.name} failed:`, lastError);
    }
  }

  throw lastError ?? new Error('Novu trigger failed without an error object');
}

export async function sendFallAlertEmails(
  contacts: EmergencyContact[],
  location: GeoLocation | null,
  event: FallEvent,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!NOVU_API_KEY) {
    console.warn('[fall] Novu not configured — skipping email alerts.');
    return { sent: 0, failed: 0, errors: ['Novu API key missing from environment configuration.'] };
  }

  const withEmail = contacts.filter(c => c.email?.trim() && (c.pref === 'email' || c.pref === 'both' || !c.pref));
  if (withEmail.length === 0) return { sent: 0, failed: 0, errors: [] };

  const mapsLink = location
    ? `https://maps.google.com/?q=${location.lat},${location.lng}`
    : 'Location unavailable';

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contact of withEmail) {
    try {
      const response = await triggerNovuEndpoint({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ApiKey ${NOVU_API_KEY}`,
        },
        body: JSON.stringify({
          name: 'fall-alert',
          to: {
            subscriberId: contact.email!.trim(),
            email: contact.email!.trim(),
          },
          payload: {
            to_name: contact.name,
            severity: event.severity.toUpperCase(),
            timestamp: new Date(event.ts).toLocaleString(),
            maps_link: mapsLink,
            message: `A ${event.severity} severity fall was detected. Impact: ${event.impactG.toFixed(1)} g.`,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      sent++;
    } catch (err: any) {
      console.error(`[fall] email to ${contact.email} failed:`, err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Unknown Novu error');
      errors.push(`${contact.name}: ${msg}`);
      failed++;
    }
  }

  return { sent, failed, errors };
}

/* ══════════════════════════════════════════════════════════════════
   SOS ALARM — loud looping siren (Web Audio) + vibration.
   A shared AudioContext, unlocked on a user gesture via ensureAudio(),
   so the alarm can sound when the countdown later hits zero.
   ⚠️ A web app cannot bypass iOS silent/DND/volume, and iOS Safari has
   no Vibration API — those need a native wrapper (future work).
══════════════════════════════════════════════════════════════════ */
let _ctx: AudioContext | null = null;
let _osc: OscillatorNode | null = null;
let _gain: GainNode | null = null;
let _sirenTimer: number | null = null;
let _vibrateTimer: number | null = null;

/** Create/resume the shared AudioContext — call from a user gesture. */
export function ensureAudio() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!_ctx && Ctx) _ctx = new Ctx();
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
  } catch { /* ignore */ }
  return _ctx;
}

/** Short attention beep (used each second during the countdown). */
export function beep(freq = 880, ms = 140) {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.25;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch { /* ignore */ }
}

export function startSosAlarm() {
  stopSosAlarm();
  const ctx = ensureAudio();
  if (ctx) {
    try {
      _osc = ctx.createOscillator();
      _gain = ctx.createGain();
      _osc.type = 'sawtooth';
      _osc.frequency.value = 900;
      _gain.gain.value = 0.9;               // loud
      _osc.connect(_gain).connect(ctx.destination);
      _osc.start();
      let high = true;                       // two-tone siren sweep
      _sirenTimer = window.setInterval(() => {
        try { _osc?.frequency.setValueAtTime(high ? 1050 : 620, ctx.currentTime); } catch { /* ignore */ }
        high = !high;
      }, 450);
    } catch (err) { console.warn('[fall] siren failed:', err); }
  }
  // Vibration loop (Android/Chromium only; iOS Safari ignores this).
  try {
    if (navigator.vibrate) {
      const pattern = [500, 250, 500, 250, 800];
      navigator.vibrate(pattern);
      _vibrateTimer = window.setInterval(() => navigator.vibrate(pattern), 2300);
    }
  } catch { /* ignore */ }
}

export function stopSosAlarm() {
  if (_sirenTimer)   { clearInterval(_sirenTimer);   _sirenTimer = null; }
  if (_vibrateTimer) { clearInterval(_vibrateTimer); _vibrateTimer = null; }
  try { navigator.vibrate?.(0); } catch { /* ignore */ }
  try { _osc?.stop(); _osc?.disconnect(); } catch { /* ignore */ }
  try { _gain?.disconnect(); } catch { /* ignore */ }
  _osc = null; _gain = null;
}
