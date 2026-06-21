import { useState } from 'react';
import type { HealthSummary } from '../../../services/cardioIntelligence';

const toneColor = { good: '#22c55e', watch: '#f59e0b', bad: '#ef4444' } as const;

/**
 * AIHealthSummaryCard — the "AI Health Summary Generator".
 * Renders a plain-language narrative built from the user's real metrics,
 * a row of highlight chips, and a small info popover that surfaces the
 * research rationale (why this benchmark matters) directly in-app.
 */
export function AIHealthSummaryCard({ summary, mounted = true }: { summary: HealthSummary; mounted?: boolean }) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(14,165,233,0.22) 100%)',
        backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden',
        animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none',
      }}
    >
      <div style={{ position: 'absolute', top: '-40px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(99,102,241,0.18)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px' }}>🧠</div>
          <div>
            <p style={{ color: 'rgba(220,235,255,0.6)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>AI Health Summary</p>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '16px', margin: '1px 0 0' }}>{summary.headline}</h3>
          </div>
        </div>
        <button
          onClick={() => setShowWhy(v => !v)}
          title="Why these benchmarks?"
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          i
        </button>
      </div>

      {showWhy && (
        <div style={{ background: 'rgba(6,15,40,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', fontSize: '11.5px', color: 'rgba(220,235,255,0.8)', lineHeight: 1.5 }}>
          <strong style={{ color: '#fff' }}>Benchmarked against leading platforms.</strong> Apple Health, Fitbit, Garmin,
          Samsung Health, WHOOP and Cardiogram all pair raw metrics with plain-language insight. This summary applies the
          same idea using transparent clinical thresholds (AHA/ACC blood-pressure stages, standard resting-HR & SpO₂ bands,
          age-adjusted HRV) — so every statement is explainable, not a black box.
        </div>
      )}

      {summary.paragraphs.map((p, i) => (
        <p key={i} style={{ color: 'rgba(225,238,255,0.88)', fontSize: '13px', lineHeight: 1.6, margin: i === 0 ? '0 0 9px' : '0 0 9px', position: 'relative' }}>
          {p}
        </p>
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', position: 'relative' }}>
        {summary.highlights.map(h => (
          <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(6,15,40,0.45)', border: `1px solid ${toneColor[h.tone]}55`, borderRadius: '10px', padding: '6px 11px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: toneColor[h.tone], boxShadow: `0 0 6px ${toneColor[h.tone]}` }} />
            <span style={{ color: 'rgba(200,225,255,0.65)', fontSize: '10.5px', fontWeight: 600 }}>{h.label}</span>
            <span style={{ color: '#fff', fontSize: '11.5px', fontWeight: 700 }}>{h.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
