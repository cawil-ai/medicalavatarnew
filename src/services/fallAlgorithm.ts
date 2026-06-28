/**
 * fallAlgorithm.ts
 * ─────────────────────────────────────────────────────────────────
 * Explainable, on-device fall-detection engine. No ML dependency — a
 * transparent 3-phase physics model (the same shape every published
 * fall-detection paper uses), so every decision is traceable:
 *
 *   1. FREE-FALL   total acceleration dips toward 0 g  (g < 0.5)
 *   2. IMPACT      sudden spike on landing             (g > 2.5)
 *   3. STILLNESS   little/no movement afterwards        (|g − 1| < tol)
 *
 * A confirmed fall = free-fall → impact → sustained stillness. Quick
 * sits, phone drops, running and jumping are rejected by heuristics.
 *
 * Pure functions + a small state machine (no React, no I/O) so it is
 * unit-testable and reused by the hook, the live feed, and the log.
 */

/* ── Types ──────────────────────────────────────────────────────── */
export interface SensorSample {
  t: number;   // epoch ms
  x: number;   // g
  y: number;   // g
  z: number;   // g
  g: number;   // magnitude in g
}

export type FallSeverity = 'low' | 'moderate' | 'high';
export type FallType = 'fall' | 'sit' | 'drop' | 'activity';

export interface Classification {
  isFall:  boolean;
  type:    FallType;
  reason:  string;
}

export interface DetectedFall {
  impactG:     number;
  stillnessMs: number;
  severity:    FallSeverity;
  classification: Classification;
}

export interface FallEvent {
  id:       string;
  ts:       string;          // ISO
  severity: FallSeverity;
  type:     FallType;
  action:   string;          // "False Alarm – Dismissed" | "Emergency Contacts Notified" | …
  impactG:  number;
  stillnessMs: number;
  lat?:     number;
  lng?:     number;
}

/* ── Thresholds (g) ─────────────────────────────────────────────── */
export const FREE_FALL_G = 0.5;   // below this = free-fall
export const IMPACT_G    = 2.5;   // above this = impact spike
export const STILL_TOL   = 0.18;  // |g − 1| below this = at rest

export interface DetectorOptions {
  freeFallG?:   number;
  impactG?:     number;
  stillTol?:    number;
  stillnessMs?: number;   // how long stillness must hold to confirm
  freeFallWindowMs?: number; // max gap between free-fall and impact
}

/* ── Helpers ────────────────────────────────────────────────────── */
export function magnitudeG(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function severityFor(impactG: number): FallSeverity {
  if (impactG >= 4) return 'high';
  if (impactG >= 3) return 'moderate';
  return 'low';
}

/**
 * Classify a candidate event. Free-fall preceding a hard impact that is
 * then followed by sustained stillness is the signature of a real fall;
 * everything else is explained away.
 */
export function classify(
  impactG: number,
  stillnessMs: number,
  sawFreeFall: boolean,
  recentSpikes: number,
  requiredStillMs: number,
): Classification {
  if (recentSpikes >= 3 && stillnessMs < requiredStillMs)
    return { isFall: false, type: 'activity', reason: 'Repeated spikes with no stillness — looks like running or jumping.' };

  if (impactG < IMPACT_G)
    return { isFall: false, type: 'sit', reason: `Impact ${impactG.toFixed(1)} g is below the ${IMPACT_G} g fall threshold — likely sitting down.` };

  if (stillnessMs < requiredStillMs)
    return { isFall: false, type: 'drop', reason: `Hard impact but movement resumed after ${(stillnessMs / 1000).toFixed(1)} s — likely a dropped phone.` };

  if (!sawFreeFall)
    return { isFall: true, type: 'fall', reason: `Impact ${impactG.toFixed(1)} g followed by ${(stillnessMs / 1000).toFixed(0)} s of stillness.` };

  return { isFall: true, type: 'fall', reason: `Free-fall → ${impactG.toFixed(1)} g impact → ${(stillnessMs / 1000).toFixed(0)} s of stillness. Classic fall signature.` };
}

/* ── Stateful detector ──────────────────────────────────────────── */
type Phase = 'idle' | 'freefall' | 'impact' | 'watching';

/**
 * Push samples in chronologically; returns a DetectedFall on the sample
 * that confirms a fall, otherwise null. Reset internally afterwards.
 */
export function createFallDetector(opts: DetectorOptions = {}) {
  const freeFallG   = opts.freeFallG   ?? FREE_FALL_G;
  const impactG     = opts.impactG     ?? IMPACT_G;
  const stillTol    = opts.stillTol    ?? STILL_TOL;
  const stillnessMs = opts.stillnessMs ?? 8000;        // demo default (spec: 15–60 s)
  const freeFallWindowMs = opts.freeFallWindowMs ?? 1200;

  let phase: Phase = 'idle';
  let sawFreeFall = false;
  let freeFallAt = 0;
  let peakImpact = 0;
  let stillSince = 0;
  let recentSpikes = 0;
  let lastSpikeAt = 0;

  function reset() {
    phase = 'idle'; sawFreeFall = false; freeFallAt = 0;
    peakImpact = 0; stillSince = 0;
  }

  function push(s: SensorSample): DetectedFall | null {
    // Track spike cadence (for running/jumping rejection)
    if (s.g > impactG) {
      if (s.t - lastSpikeAt < 1500) recentSpikes++; else recentSpikes = 1;
      lastSpikeAt = s.t;
    } else if (s.t - lastSpikeAt > 2500) {
      recentSpikes = 0;
    }

    switch (phase) {
      case 'idle':
        if (s.g < freeFallG) { phase = 'freefall'; sawFreeFall = true; freeFallAt = s.t; }
        else if (s.g > impactG) { phase = 'impact'; sawFreeFall = false; peakImpact = s.g; stillSince = 0; }
        break;

      case 'freefall':
        if (s.g > impactG) { phase = 'impact'; peakImpact = s.g; stillSince = 0; }
        else if (s.t - freeFallAt > freeFallWindowMs) reset(); // free-fall fizzled
        break;

      case 'impact':
        peakImpact = Math.max(peakImpact, s.g);
        // wait for motion to settle before counting stillness
        if (Math.abs(s.g - 1) < stillTol) { phase = 'watching'; stillSince = s.t; }
        break;

      case 'watching':
        if (Math.abs(s.g - 1) >= stillTol) {
          // movement resumed → drop, not a fall
          const dur = s.t - stillSince;
          const cls = classify(peakImpact, dur, sawFreeFall, recentSpikes, stillnessMs);
          reset();
          if (cls.isFall) return done(peakImpact, dur, cls);
        } else if (s.t - stillSince >= stillnessMs) {
          const dur = s.t - stillSince;
          const cls = classify(peakImpact, dur, sawFreeFall, recentSpikes, stillnessMs);
          const peak = peakImpact;
          reset();
          if (cls.isFall) return done(peak, dur, cls);
        }
        break;
    }
    return null;
  }

  function done(impact: number, dur: number, cls: Classification): DetectedFall {
    return { impactG: impact, stillnessMs: dur, severity: severityFor(impact), classification: cls };
  }

  return { push, reset, get phase() { return phase; } };
}
