/**
 * useFallDetection.ts
 * ─────────────────────────────────────────────────────────────────
 * Runtime for the Fall Detection page. Drives a sensor stream (a
 * simulated generator by default; real DeviceMotion on supported/
 * permitted phones), feeds it through the explainable detector, and
 * surfaces a `pendingFall` that opens the countdown modal. Captures
 * GPS on a fall. A "Simulate Fall" path triggers the full flow on any
 * device for testing.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createFallDetector, magnitudeG, severityFor,
  type SensorSample, type DetectedFall,
} from '../../services/fallAlgorithm';
import { ensureAudio, type GeoLocation } from '../../services/fallService';

const BUFFER = 60;          // samples kept for the live chart
const SIM_HZ = 20;          // simulated sample rate
const STILLNESS_MS = 4000;  // demo-tuned (spec 15–60 s); tunable

export type SensorMode = 'sim' | 'real';
export type MotionState = 'idle' | 'granted' | 'denied' | 'unsupported';

export interface PendingFall {
  detection: DetectedFall;
  source: 'sensor' | 'simulated' | 'manual';
}

export interface FallDetectionState {
  monitoring:        boolean;
  toggleMonitoring:  () => void;
  sensorMode:        SensorMode;
  motionState:       MotionState;
  enableRealSensors: () => Promise<void>;
  samples:           SensorSample[];
  latestG:           number;
  simulateFall:      () => void;
  triggerSos:        () => void;
  pendingFall:       PendingFall | null;
  dismissPendingFall:() => void;
  location:          GeoLocation | null;
}

export function useFallDetection(): FallDetectionState {
  const [monitoring, setMonitoring]   = useState(true);
  const [sensorMode, setSensorMode]   = useState<SensorMode>('sim');
  const [motionState, setMotionState] = useState<MotionState>('idle');
  const [samples, setSamples]         = useState<SensorSample[]>([]);
  const [latestG, setLatestG]         = useState(1);
  const [pendingFall, setPendingFall] = useState<PendingFall | null>(null);
  const [location, setLocation]       = useState<GeoLocation | null>(null);

  const detectorRef   = useRef(createFallDetector({ stillnessMs: STILLNESS_MS }));
  const bufRef        = useRef<SensorSample[]>([]);
  const monitoringRef = useRef(monitoring);
  const pendingRef    = useRef<PendingFall | null>(null);
  const simTimer      = useRef<number | null>(null);
  const realHandler   = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  useEffect(() => { monitoringRef.current = monitoring; }, [monitoring]);
  useEffect(() => { pendingRef.current = pendingFall; }, [pendingFall]);

  /* ── GPS capture ─────────────────────────────────────────────── */
  const captureLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) }),
      err => console.warn('[fall] geolocation:', err.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, []);

  const raiseFall = useCallback((detection: DetectedFall, source: PendingFall['source']) => {
    if (pendingRef.current) return;            // one at a time
    const pf = { detection, source };
    pendingRef.current = pf;
    setPendingFall(pf);
    captureLocation();
  }, [captureLocation]);

  /* ── Ingest a sample → buffer + detector ─────────────────────── */
  const pushSample = useCallback((s: SensorSample) => {
    const buf = bufRef.current;
    buf.push(s);
    if (buf.length > BUFFER) buf.shift();
    if (!monitoringRef.current) return;
    const fall = detectorRef.current.push(s);
    if (fall) raiseFall(fall, 'sensor');
  }, [raiseFall]);

  /* ── Simulated sensor stream ─────────────────────────────────── */
  const startSim = useCallback(() => {
    if (simTimer.current) return;
    simTimer.current = window.setInterval(() => {
      const n = () => (Math.random() - 0.5) * 0.06;         // small noise
      const x = n(), y = n(), z = 1 + n();
      pushSample({ t: Date.now(), x, y, z, g: magnitudeG(x, y, z) });
    }, 1000 / SIM_HZ);
  }, [pushSample]);

  const stopSim = useCallback(() => {
    if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
  }, []);

  /* ── Real DeviceMotion stream (iOS/Android) ──────────────────── */
  const attachReal = useCallback(() => {
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const x = (a.x ?? 0) / 9.81, y = (a.y ?? 0) / 9.81, z = (a.z ?? 0) / 9.81;
      pushSample({ t: Date.now(), x, y, z, g: magnitudeG(x, y, z) });
    };
    realHandler.current = handler;
    window.addEventListener('devicemotion', handler);
  }, [pushSample]);

  const enableRealSensors = useCallback(async () => {
    ensureAudio(); // unlock audio on this gesture so the alarm can sound later
    const DME: any = (window as any).DeviceMotionEvent;
    if (!DME) { setMotionState('unsupported'); return; }
    try {
      if (typeof DME.requestPermission === 'function') {
        const res = await DME.requestPermission();      // iOS 13+
        if (res !== 'granted') { setMotionState('denied'); return; }
      }
      stopSim();
      attachReal();
      setSensorMode('real');
      setMotionState('granted');
    } catch (err) {
      console.warn('[fall] motion permission:', err);
      setMotionState('denied');
    }
  }, [attachReal, stopSim]);

  /* ── Choose source based on mode + monitoring ────────────────── */
  useEffect(() => {
    if (sensorMode === 'sim') { startSim(); }
    return () => { if (sensorMode === 'sim') stopSim(); };
  }, [sensorMode, startSim, stopSim]);

  // Detach real listener on unmount
  useEffect(() => () => {
    if (realHandler.current) window.removeEventListener('devicemotion', realHandler.current);
    stopSim();
  }, [stopSim]);

  /* ── Throttled render of the live buffer (~10 fps) ───────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!monitoringRef.current) return;
      const buf = bufRef.current;
      setSamples([...buf]);
      setLatestG(buf.length ? buf[buf.length - 1].g : 1);
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ── Controls ────────────────────────────────────────────────── */
  const toggleMonitoring = useCallback(() => {
    ensureAudio();
    setMonitoring(m => {
      const next = !m;
      if (!next) { bufRef.current = []; setSamples([]); detectorRef.current.reset(); }
      return next;
    });
  }, []);

  /** Inject a visible spike + raise a (simulated) confirmed fall now. */
  const simulateFall = useCallback(() => {
    ensureAudio();
    if (!monitoringRef.current) setMonitoring(true);
    const seq = [0.3, 0.25, 3.7, 2.4, 1.0, 1.0];   // free-fall → impact → settle (for the chart)
    seq.forEach((g, i) => setTimeout(() => {
      const buf = bufRef.current;
      buf.push({ t: Date.now(), x: 0, y: 0, z: g, g });
      if (buf.length > BUFFER) buf.shift();
    }, i * 60));
    setTimeout(() => raiseFall({
      impactG: 3.7, stillnessMs: STILLNESS_MS, severity: severityFor(3.7), confidence: 95,
      classification: { isFall: true, type: 'fall', reason: 'Simulated fall (test) — free-fall → 3.7 g impact → stillness.' },
    }, 'simulated'), seq.length * 60 + 50);
  }, [raiseFall]);

  /** Manual panic button → same countdown flow. */
  const triggerSos = useCallback(() => {
    ensureAudio();
    raiseFall({
      impactG: 0, stillnessMs: 0, severity: 'high', confidence: 100,
      classification: { isFall: true, type: 'fall', reason: 'Manual SOS activated by user.' },
    }, 'manual');
  }, [raiseFall]);

  const dismissPendingFall = useCallback(() => {
    pendingRef.current = null;
    setPendingFall(null);
    detectorRef.current.reset();
  }, []);

  return {
    monitoring, toggleMonitoring, sensorMode, motionState, enableRealSensors,
    samples, latestG, simulateFall, triggerSos, pendingFall, dismissPendingFall, location,
  };
}
