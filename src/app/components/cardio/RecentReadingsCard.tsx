import { Pencil, Trash2 } from 'lucide-react';
import { 
  classifyBloodPressure, 
  classifyRestingHr, 
  classifySpo2, 
  classifyHrv 
} from '../../../services/cardioIntelligence';
import type { CardioReading } from '../../../services/cardioIntelligence';

const ACTIVITY_ICON: Record<string, string> = {
  Resting: '😴', Running: '🏃', Walking: '🚶', Cycling: '🚴', Swimming: '🏊',
  Gym: '🏋️', Yoga: '🧘', HIIT: '⚡', Other: '❤️',
};

function fmtWhen(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

const actionBtn = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: '8px', cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
  color, transition: 'all 0.18s ease', flexShrink: 0, padding: 0,
});

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${color}14`, border: `1px solid ${color}33`, borderRadius: '8px', padding: '3px 8px', fontSize: '11px' }}>
      <span style={{ color: 'rgba(180,210,255,0.55)' }}>{label}</span>
      <span style={{ color: '#e0f0ff', fontWeight: 700 }}>{value}</span>
    </span>
  );
}

// Generates an explainable AI insight sentence for a single cardiovascular reading
function getReadingInsight(r: CardioReading, age: number = 35): string {
  const parts: string[] = [];

  if (r.bpm > 0) {
    if (r.activity?.toLowerCase().includes('resting') || r.bpm < 100) {
      const hrClass = classifyRestingHr(r.bpm);
      parts.push(`Resting HR is ${hrClass.band.toLowerCase()}`);
    } else {
      const zone = r.bpm < 100 ? 'Resting' : r.bpm < 120 ? 'Light' : r.bpm < 145 ? 'Moderate' : 'Vigorous';
      parts.push(`HR is in the ${zone.toLowerCase()} zone (${r.bpm} bpm)`);
    }
  }

  if (r.systolic > 0 && r.diastolic > 0) {
    const bpClass = classifyBloodPressure(r.systolic, r.diastolic);
    parts.push(`BP indicates ${bpClass.band.toLowerCase()}`);
  }

  if (r.spo2 > 0) {
    const oxClass = classifySpo2(r.spo2);
    parts.push(`oxygen level is ${oxClass.band.toLowerCase()}`);
  }

  if (r.hrv > 0) {
    const hrvClass = classifyHrv(r.hrv, age);
    parts.push(`HRV shows ${hrvClass.band.toLowerCase()} recovery capacity`);
  }

  if (r.recovery > 0) {
    if (r.recovery > 80) parts.push('optimal physical readiness');
    else if (r.recovery < 45) parts.push('fatigue indicators (resting is advised)');
  }

  if (parts.length === 0) return 'Add more vital measurements to receive AI insights.';
  return parts.join(', ') + '.';
}

/**
 * RecentReadingsCard — the logged-activity history list.
 * Shows the 5 most recent readings with AI insights.
 * The "View All" modal is rendered at page level (HeartPage) to avoid
 * stacking-context issues from backdrop-filter.
 */
interface Props {
  readings:  CardioReading[];
  mounted?:  boolean;
  onEdit?:   (r: CardioReading) => void;
  onDelete?: (r: CardioReading) => void;
  onViewAll?: () => void;
  age?:      number;
}

export function RecentReadingsCard({ readings, mounted = true, onEdit, onDelete, onViewAll, age = 35 }: Props) {
  return (
    <div
      style={{
        background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px',
        animation: mounted ? 'fadeUp 0.5s ease 0.28s both' : 'none',
      }}
    >
      <style>{`.rr-action:hover{ background:rgba(255,255,255,0.1)!important; transform:translateY(-1px); }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Activity Log</p>
          <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Recent Readings</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {readings.length > 0 && onViewAll && (
            <button onClick={onViewAll}
              style={{ background: 'rgba(100,180,255,0.08)', border: '1px solid rgba(100,180,255,0.25)', color: '#38bdf8', borderRadius: '12px', padding: '4px 10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              className="rr-action">
              View All
            </button>
          )}
          <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>{readings.length} logged</span>
        </div>
      </div>

      {readings.length === 0 ? (
        <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12.5px', lineHeight: 1.5, margin: 0 }}>
          No readings yet. Tap <strong style={{ color: '#e0f0ff' }}>Log Reading</strong> to record an activity and your vitals — they'll appear here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
          {readings.slice(0, 5).map((r, i) => {
            const matchingKey = Object.keys(ACTIVITY_ICON).find(k => 
              r.activity?.toLowerCase().includes(k.toLowerCase())
            );
            const icon = matchingKey ? ACTIVITY_ICON[matchingKey] : '❤️';
            const durationMatch = r.activity?.match(/\((\d+)\s*min\)/) || r.activity?.match(/\((\d+)m\)/);
            const durationVal = durationMatch ? durationMatch[1] : null;
            const cleanActivityName = r.activity 
              ? r.activity.replace(/\s*\(\d+\s*min\)/, '').replace(/\s*\(\d+m\)/, '') 
              : 'Reading';
            return (
              <div key={`${r.ts}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,180,255,0.1)', borderRadius: '14px', padding: '12px 14px' }}>
                <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#e0f0ff', fontSize: '13.5px', fontWeight: 700 }}>{cleanActivityName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtWhen(r.ts)}</span>
                      {r.id && onEdit && (<button onClick={() => onEdit(r)} title="Edit reading" className="rr-action" style={actionBtn('#38bdf8')}><Pencil size={13} /></button>)}
                      {r.id && onDelete && (<button onClick={() => onDelete(r)} title="Delete reading" className="rr-action" style={actionBtn('#ef4444')}><Trash2 size={13} /></button>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                    {durationVal && <Chip label="Time" value={`${durationVal} min`} color="#fbbf24" />}
                    <Chip label="HR" value={`${r.restingHr || r.bpm} bpm`} color="#ef4444" />
                    {r.systolic > 0 && <Chip label="BP" value={`${r.systolic}/${r.diastolic}`} color="#a78bfa" />}
                    {r.spo2 > 0 && <Chip label="SpO₂" value={`${r.spo2}%`} color="#38bdf8" />}
                    {r.hrv > 0 && <Chip label="HRV" value={`${r.hrv}ms`} color="#22c55e" />}
                    {r.recovery > 0 && <Chip label="Rec" value={`${r.recovery}%`} color="#f59e0b" />}
                  </div>
                  {r.note ? <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11.5px', margin: '7px 0 0', fontStyle: 'italic' }}>"{r.note}"</p> : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: 'rgba(100,180,255,0.05)', borderRadius: '8px', padding: '6px 10px', border: '1px dashed rgba(100,180,255,0.15)' }}>
                    <span style={{ fontSize: '11px' }}>✨</span>
                    <p style={{ color: 'rgba(180,230,255,0.85)', fontSize: '11px', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                      <strong style={{ color: '#8ec5fc' }}>AI Insight:</strong> {getReadingInsight(r, age)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Exported helpers for the View All modal rendered in HeartPage ── */
export { getReadingInsight, ACTIVITY_ICON, fmtWhen, Chip, actionBtn };
