import { useState } from 'react';

export interface ReadingFormData {
  activity:   string;
  durationMin?: number;
  intensity?: number;
  restingHr?: number;
  systolic?:  number;
  diastolic?: number;
  spo2?:      number;
  hrv?:       number;
  notes?:     string;
}

interface Props {
  open:     boolean;
  saving:   boolean;
  mode?:    'create' | 'edit';
  initial?: ReadingFormData;     // pre-fill (edit mode)
  onClose:  () => void;
  onSubmit: (data: ReadingFormData) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(100,180,255,0.25)', borderRadius: '10px', color: '#e0f0ff',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px',
};
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/**
 * LogReadingModal — upgraded logger. Beyond activity, it captures the
 * vitals that make the monitor's metrics REAL (and feed risk/trends/
 * alerts): resting HR, blood pressure, SpO₂ and HRV. All optional.
 */
export function LogReadingModal({ open, saving, mode = 'create', initial, onClose, onSubmit }: Props) {
  const s = (v: number | undefined, fallback = '') => (v != null ? String(v) : fallback);
  const [f, setF] = useState(() => ({
    activity:  initial?.activity ?? 'Running',
    duration:  s(initial?.durationMin),
    intensity: s(initial?.intensity, '5'),
    restingHr: s(initial?.restingHr),
    systolic:  s(initial?.systolic),
    diastolic: s(initial?.diastolic),
    spo2:      s(initial?.spo2),
    hrv:       s(initial?.hrv),
    notes:     initial?.notes ?? '',
  }));

  const isEdit = mode === 'edit';

  if (!open) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      activity: f.activity,
      durationMin: num(f.duration),
      intensity: num(f.intensity),
      restingHr: num(f.restingHr),
      systolic: num(f.systolic),
      diastolic: num(f.diastolic),
      spo2: num(f.spo2),
      hrv: num(f.hrv),
      notes: f.notes || undefined,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }} onClick={onClose}>
      <div style={{ background: '#0d1a38', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '22px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{isEdit ? '✏️' : '❤️'}</div>
          <div>
            <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0 }}>{isEdit ? 'Edit Reading' : 'Log Reading'}</h4>
            <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>{isEdit ? 'Update this logged reading' : 'Record your activity and vitals'}</p>
          </div>
        </div>

        <form onSubmit={submit}>
          {/* Activity */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Activity Type</label>
            <select value={f.activity} onChange={set('activity')} style={inputStyle}>
              {['Resting', 'Running', 'Walking', 'Cycling', 'Swimming', 'Gym', 'Yoga', 'HIIT', 'Other'].map(t => (
                <option key={t} value={t} style={{ background: '#0d1a38' }}>{t}</option>
              ))}
            </select>
          </div>

          {/* Duration + Resting HR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Duration (min)</label>
              <input type="number" min="0" placeholder="e.g. 30" value={f.duration} onChange={set('duration')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Resting HR (bpm)</label>
              <input type="number" min="0" placeholder="e.g. 72" value={f.restingHr} onChange={set('restingHr')} style={inputStyle} />
            </div>
          </div>

          {/* Vitals header */}
          <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 0 10px' }}>Vitals (optional)</p>

          {/* Blood pressure */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Systolic (mmHg)</label>
              <input type="number" min="0" placeholder="e.g. 118" value={f.systolic} onChange={set('systolic')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Diastolic (mmHg)</label>
              <input type="number" min="0" placeholder="e.g. 76" value={f.diastolic} onChange={set('diastolic')} style={inputStyle} />
            </div>
          </div>

          {/* SpO2 + HRV */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>SpO₂ (%)</label>
              <input type="number" min="0" max="100" placeholder="e.g. 98" value={f.spo2} onChange={set('spo2')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>HRV (ms)</label>
              <input type="number" min="0" placeholder="e.g. 65" value={f.hrv} onChange={set('hrv')} style={inputStyle} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '22px' }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input type="text" placeholder="e.g. Morning run, felt great" value={f.notes} onChange={set('notes')} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 18px rgba(239,68,68,0.35)' }}>
              {saving ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Reading' : 'Save Reading')}
            </button>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
