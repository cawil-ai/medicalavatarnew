import { useState, useEffect, useRef } from 'react';
import { Siren, ShieldCheck, MapPin } from 'lucide-react';
import { beep, startSosAlarm, stopSosAlarm, type GeoLocation } from '../../../services/fallService';
import type { PendingFall } from '../../hooks/useFallDetection';

interface Props {
  pending:   PendingFall;
  location:  GeoLocation | null;
  seconds?:  number;        // countdown length (default 30)
  onImOkay:  () => void;    // false alarm
  onNotify:  () => void;    // countdown hit 0 → notify + log
  onClose:   () => void;    // stop SOS / close
}

/**
 * Full-screen fail-safe. A 30-second countdown with beeps; "I'm Okay"
 * dismisses it as a false alarm. At zero it escalates to a loud, looping
 * SOS alarm (siren + vibration) that only stops via the Stop SOS button.
 */
export function FallCountdownModal({ pending, location, seconds = 30, onImOkay, onNotify, onClose }: Props) {
  const [phase, setPhase] = useState<'countdown' | 'alarm'>('countdown');
  const [secs, setSecs]   = useState(seconds);
  const timerRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    timerRef.current = window.setInterval(() => {
      setSecs(s => {
        const next = s - 1;
        if (next <= 0) { escalate(); return 0; }
        beep(next <= 5 ? 1320 : 880, next <= 5 ? 200 : 130);  // faster/higher in last 5 s
        return next;
      });
    }, 1000);
    beep(880, 130);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount — never leave the alarm ringing
  useEffect(() => () => { stopSosAlarm(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  const escalate = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('alarm');
    startSosAlarm();
    if (!notifiedRef.current) { notifiedRef.current = true; onNotify(); }
  };

  const handleImOkay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopSosAlarm();
    onImOkay();
  };

  const handleStop = () => { stopSosAlarm(); onClose(); };

  const total = seconds;
  const R = 120, C = 2 * Math.PI * R;
  const isAlarm = phase === 'alarm';
  const ringColor = isAlarm ? '#ef4444' : secs <= 5 ? '#ef4444' : secs <= 15 ? '#f59e0b' : '#38bdf8';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: isAlarm ? 'rgba(60,0,0,0.92)' : 'rgba(5,8,20,0.94)',
      backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      animation: isAlarm ? 'sosFlash 0.9s ease-in-out infinite' : 'fadeIn 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <Siren size={30} color="#ef4444" style={{ animation: 'sosShake 0.5s ease-in-out infinite' }} />
        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '30px', margin: 0, letterSpacing: '-0.5px' }}>
          {isAlarm ? 'SOS ACTIVATED' : 'Fall Detected'}
        </h1>
      </div>
      <p style={{ color: 'rgba(255,210,210,0.85)', fontSize: '15px', margin: '0 0 28px', textAlign: 'center', maxWidth: '440px' }}>
        {isAlarm
          ? 'Emergency contacts have been alerted. The alarm will keep sounding until you stop it.'
          : pending.source === 'manual' ? 'Manual SOS — alerting your contacts unless you cancel.' : 'Are you okay? Tap "I\'m Okay" to cancel before the countdown ends.'}
      </p>

      {/* Countdown ring */}
      {!isAlarm && (
        <div style={{ position: 'relative', width: 280, height: 280, marginBottom: '32px' }}>
          <svg width="280" height="280" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle cx="140" cy="140" r={R} fill="none" stroke={ringColor} strokeWidth="14" strokeLinecap="round"
              style={{ strokeDasharray: C, strokeDashoffset: C * (1 - secs / total), transition: 'stroke-dashoffset 1s linear, stroke 0.4s', filter: `drop-shadow(0 0 12px ${ringColor})` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '88px', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{secs}</span>
            <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>seconds</span>
          </div>
        </div>
      )}

      {isAlarm && (
        <div style={{ width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.35), transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', animation: 'sosPulse 1.2s ease-out infinite' }}>
          <Siren size={110} color="#fff" style={{ animation: 'sosShake 0.4s ease-in-out infinite' }} />
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '28px' }}>
        <span style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: '12px', fontWeight: 700, textTransform: 'capitalize' }}>
          Severity: {pending.detection.severity}
        </span>
        {location && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac', fontSize: '12px', fontWeight: 700 }}>
            <MapPin size={12} /> {location.lat}, {location.lng}
          </span>
        )}
      </div>

      {/* Actions */}
      {!isAlarm ? (
        <button onClick={handleImOkay} style={{
          display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg,#22c55e,#16a34a)',
          border: 'none', borderRadius: '16px', padding: '18px 48px', color: '#fff', fontWeight: 800, fontSize: '20px',
          cursor: 'pointer', boxShadow: '0 8px 28px rgba(34,197,94,0.4)',
        }}>
          <ShieldCheck size={24} /> I'm Okay
        </button>
      ) : (
        <button onClick={handleStop} style={{
          display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.1)',
          border: '2px solid rgba(255,255,255,0.4)', borderRadius: '16px', padding: '18px 52px', color: '#fff',
          fontWeight: 800, fontSize: '20px', cursor: 'pointer',
        }}>
          Stop SOS
        </button>
      )}
    </div>
  );
}
