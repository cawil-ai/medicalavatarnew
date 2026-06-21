import { databases, DATABASE_ID, COLLECTIONS, ID, Query, LOCAL_MODE } from '../lib/appwrite';
import type { CardioReading } from './cardioIntelligence';

/* ── Local-mode store (localStorage) ─────────────────────────────────
 * In local mode there is no backend, so heart logs are persisted to
 * localStorage in an Appwrite-document-compatible shape (so docToReading
 * and every read path work unchanged). Capped to the most recent 200. */
const LOCAL_KEY = 'cawil_local_heart_logs';

function readLocal(): any[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function writeLocal(docs: any[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(docs.slice(0, 200))); } catch {}
}

/* ── Extended vitals the upgraded monitor can persist ───────────────
 * The base columns (userID, bpmLog, Zone, Activity, Resting, Note,
 * Date, loggedAt) already exist. The vitals below require these
 * OPTIONAL integer columns on the `heart_logs` collection:
 *   systolic, diastolic, spo2, hrv, restingHr, recovery
 * If they are missing, saveHeartLog() retries with the base columns
 * and warns — the app keeps working before the migration is applied. */
export interface HeartLogInput {
  bpm:        number;
  zone:       string;
  restingHr?: number;
  systolic?:  number;
  diastolic?: number;
  spo2?:      number;
  hrv?:       number;
  recovery?:  number;
  activity?:  string;
  notes?:     string;
  ts?:        string;
}

const EXTENDED_COLUMNS = ['systolic', 'diastolic', 'spo2', 'hrv', 'restingHr', 'recovery'];

/** Always-present columns. */
function baseFields(input: HeartLogInput) {
  return {
    bpmLog:   input.bpm,
    Zone:     input.zone,
    Activity: input.activity || '',
    Resting:  input.zone === 'Resting',
    Note:     input.notes || '',
  };
}

/** Optional vitals columns (only included when provided). */
function vitalsFields(input: HeartLogInput) {
  return {
    ...(input.restingHr != null ? { restingHr: input.restingHr } : {}),
    ...(input.systolic  != null ? { systolic:  input.systolic  } : {}),
    ...(input.diastolic != null ? { diastolic: input.diastolic } : {}),
    ...(input.spo2      != null ? { spo2:      input.spo2      } : {}),
    ...(input.hrv       != null ? { hrv:       input.hrv       } : {}),
    ...(input.recovery  != null ? { recovery:  input.recovery  } : {}),
  };
}

const migrationWarning = (err: any) => console.warn(
  '⚠️ Extended heart vitals could not be saved — falling back to base columns.\n' +
  `   To persist blood pressure / SpO₂ / HRV, add these OPTIONAL integer attributes to ` +
  `the "${COLLECTIONS.heart}" collection: ${EXTENDED_COLUMNS.join(', ')}.\n` +
  `   (${err?.message ?? err})`
);

export async function saveHeartLog(userId: string, input: HeartLogInput) {
  const now = input.ts || new Date().toISOString();
  const base     = { userID: userId, ...baseFields(input), Date: now, loggedAt: now };
  const extended = { ...base, ...vitalsFields(input) };

  // Local mode → persist to localStorage, newest first.
  if (LOCAL_MODE) {
    const doc = { $id: `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`, ...extended };
    writeLocal([doc, ...readLocal()]);
    return doc as any;
  }

  try {
    return await databases.createDocument(DATABASE_ID, COLLECTIONS.heart, ID.unique(), extended);
  } catch (err: any) {
    migrationWarning(err);
    return await databases.createDocument(DATABASE_ID, COLLECTIONS.heart, ID.unique(), base);
  }
}

/** Update an existing reading (preserves its original timestamp/id). */
export async function updateHeartLog(userId: string, id: string, input: HeartLogInput) {
  const base     = baseFields(input);
  const extended = { ...base, ...vitalsFields(input) };

  if (LOCAL_MODE) {
    const docs = readLocal();
    const idx  = docs.findIndex(d => d.$id === id);
    if (idx < 0) return null;
    docs[idx] = { ...docs[idx], ...extended };
    writeLocal(docs);
    return docs[idx];
  }

  try {
    return await databases.updateDocument(DATABASE_ID, COLLECTIONS.heart, id, extended);
  } catch (err: any) {
    migrationWarning(err);
    return await databases.updateDocument(DATABASE_ID, COLLECTIONS.heart, id, base);
  }
}

/** Delete a reading by id. */
export async function deleteHeartLog(userId: string, id: string) {
  if (LOCAL_MODE) {
    writeLocal(readLocal().filter(d => d.$id !== id));
    return;
  }
  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.heart, id);
}

/* ── Reads ──────────────────────────────────────────────────────── */
export async function getLatestBpm(userId: string): Promise<number> {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(1)]
  );
  return res.documents[0]?.bpmLog ?? 76;
}

export async function getTodayHeartLogs(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(100)]
  );
  return res.documents;
}

export async function getWeeklyHeartLogs(userId: string) {
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(7)]
  );
  return res.documents;
}

export async function getRecentHeartLogs(userId: string, limit = 30) {
  if (LOCAL_MODE) return readLocal().slice(0, limit);
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(limit)]
  );
  return res.documents;
}

/* ── Mapping: Appwrite document → CardioReading ─────────────────────
 * Old logs only have bpmLog; missing vitals default to 0 (the trend
 * engine filters zeros out) except restingHr which falls back to bpm. */
export function docToReading(doc: any): CardioReading {
  const bpm = Number(doc.bpmLog) || 0;
  return {
    id:        doc.$id,
    ts:        doc.loggedAt ?? doc.Date ?? doc.$createdAt ?? new Date().toISOString(),
    bpm,
    restingHr: Number(doc.restingHr) || bpm,
    systolic:  Number(doc.systolic)  || 0,
    diastolic: Number(doc.diastolic) || 0,
    spo2:      Number(doc.spo2)      || 0,
    hrv:       Number(doc.hrv)       || 0,
    recovery:  Number(doc.recovery)  || 0,
    activity:  doc.Activity || '',
    note:      doc.Note     || '',
    zone:      doc.Zone     || '',
  };
}

/** Latest reading as a CardioReading, or null when no logs exist. */
export async function getLatestReading(userId: string): Promise<CardioReading | null> {
  if (LOCAL_MODE) {
    const docs = readLocal();
    return docs[0] ? docToReading(docs[0]) : null;
  }
  const res = await databases.listDocuments(
    DATABASE_ID, COLLECTIONS.heart,
    [Query.equal('userID', userId), Query.orderDesc('loggedAt'), Query.limit(1)]
  );
  return res.documents[0] ? docToReading(res.documents[0]) : null;
}
