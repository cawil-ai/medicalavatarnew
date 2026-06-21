import type { RiskResult } from '../../../services/cardioIntelligence';

/**
 * RiskScoreCard — explainable cardiovascular risk gauge.
 * Shows the 0–100 score, its band, and the ranked factors that drove
 * it (each with the reason it contributed) so the score is transparent.
 */
export function RiskScoreCard({ risk, mounted = true }: { risk: RiskResult; mounted?: boolean }) {
  const size = 132;
  const r    = size / 2 - 11;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(risk.score / 100, 1) * circ;
  const maxPts = Math.max(1, ...risk.factors.map(f => f.points));

  return (
    <div
      className="metric-card"
      style={{
        background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)',
        border: `1px solid ${risk.color}33`, borderRadius: '20px', padding: '22px',
        animation: mounted ? 'fadeUp 0.5s ease 0.15s both' : 'none',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>
            Cardiovascular Risk
          </p>
          <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Health Risk Score</p>
        </div>
        <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: `${risk.color}22`, border: `1px solid ${risk.color}55`, color: risk.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {risk.band}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Gauge */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={risk.color} strokeWidth="9" strokeLinecap="round"
              style={{ strokeDasharray: circ, strokeDashoffset: circ - dash, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 7px ${risk.color})` }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{risk.score}</span>
            <span style={{ fontSize: '10px', color: 'rgba(180,210,255,0.5)', letterSpacing: '0.05em' }}>/ 100</span>
          </div>
        </div>

        <p style={{ color: 'rgba(200,225,255,0.75)', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>
          {risk.summary}
        </p>
      </div>

      {/* Explainable factors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          What's driving this score
        </p>
        {risk.factors.length === 0 && (
          <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12px', margin: 0 }}>
            No risk factors detected — every metric is in a healthy range. 🎉
          </p>
        )}
        {risk.factors.slice(0, 4).map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#e0f0ff', fontSize: '12.5px', fontWeight: 600 }}>{f.label}</span>
              <span style={{ color: risk.color, fontSize: '11px', fontWeight: 700 }}>+{f.points}</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${(f.points / maxPts) * 100}%`, borderRadius: '2px', background: risk.color, transition: 'width 1s ease', boxShadow: `0 0 6px ${risk.color}` }} />
            </div>
            <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px' }}>{f.explanation}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
