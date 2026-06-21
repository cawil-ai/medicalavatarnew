import { useState } from 'react';
import type { MetricTrend } from '../../../services/cardioIntelligence';

const INTERP = {
  improving: { color: '#22c55e', label: 'Improving', arrow: '↗' },
  declining: { color: '#ef4444', label: 'Declining', arrow: '↘' },
  stable:    { color: '#38bdf8', label: 'Stable',    arrow: '→' },
} as const;

/** Hand-rolled SVG line chart (matches the page's no-extra-deps idiom). */
function LineChart({ series, color, unit }: { series: number[]; color: string; unit: string }) {
  const w = 300, h = 96, pad = 8;
  if (series.length === 0) return null;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const n = series.length;
  const x = (i: number) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const pts = series.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${pad},${h - pad} ${pts} ${x(n - 1)},${h - pad}`;
  const gid = `tg-${color.replace('#', '')}`;

  const mid = Math.round(min + span / 2);

  return (
    <div style={{ display: 'flex', gap: '8px', height: '110px', alignItems: 'stretch' }}>
      {/* Y-Axis Labels */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(180,210,255,0.4)', textAlign: 'right', width: '38px', padding: '6px 0', fontWeight: 700, fontFamily: 'monospace' }}>
        <span>{max}{unit}</span>
        <span>{mid}{unit}</span>
        <span>{min}{unit}</span>
      </div>
      
      {/* SVG Chart Container */}
      <div style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Horizontal grid lines */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '8px', borderTop: '1px dashed rgba(100,180,255,0.06)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed rgba(100,180,255,0.06)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '8px', borderTop: '1px dashed rgba(100,180,255,0.06)' }} />

        <style>{`
          .chart-dot:hover circle {
            r: 5px !important;
            fill: #fff !important;
            stroke-width: 2px !important;
          }
          .chart-dot .dot-tooltip {
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.12s ease;
            pointer-events: none;
          }
          .chart-dot:hover .dot-tooltip {
            visibility: visible;
            opacity: 1;
          }
        `}</style>

        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color}66)` }} />
          {series.map((v, i) => {
            const cx = x(i);
            const cy = y(v);
            const showBelow = cy < 26;
            const ty = showBelow ? cy + 15 : cy - 10;
            const ry = showBelow ? cy + 6 : cy - 21;
            const labelStr = `${v}${unit}`;
            // Estimate tooltip width based on text length
            const rw = labelStr.length * 5.2 + 8;
            const rx = cx - rw / 2;

            return (
              <g key={i} className="chart-dot" style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={i === n - 1 ? 3 : 1.8} fill={i === n - 1 ? '#fff' : color} stroke={color} strokeWidth="1.2" />
                
                {/* Custom tooltip group */}
                <g className="dot-tooltip">
                  <rect x={rx} y={ry} width={rw} height={14} rx={4} fill="#0b132b" stroke={color} strokeWidth="1" />
                  <text x={cx} y={ty} textAnchor="middle" fontSize="8.5px" fontWeight="800" fill="#fff" fontFamily="monospace">
                    {labelStr}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * TrendAnalysisCard — the "Trend Analysis Dashboard".
 * Real per-metric history with avg/min/max/Δ and an improving/declining
 * interpretation that respects each metric's "good direction".
 */
export function TrendAnalysisCard({ trends, mounted = true }: { trends: MetricTrend[]; mounted?: boolean }) {
  const [active, setActive] = useState(0);

  if (!trends.length) {
    return (
      <div style={cardShell(mounted)}>
        <Header />
        <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12.5px', margin: '14px 0 0', lineHeight: 1.5 }}>
          No history yet. Log a few readings (heart rate, BP, SpO₂, HRV) and your trend analysis will appear here.
        </p>
      </div>
    );
  }

  const t = trends[Math.min(active, trends.length - 1)];
  const interp = INTERP[t.interpretation];

  return (
    <div style={cardShell(mounted)}>
      <Header />

      {/* Metric tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '14px 0 12px' }}>
        {trends.map((m, i) => (
          <button
            key={m.key}
            onClick={() => setActive(i)}
            style={{
              padding: '6px 12px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              background: i === active ? `${m.color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${i === active ? m.color + '66' : 'rgba(100,180,255,0.12)'}`,
              color: i === active ? m.color : 'rgba(180,210,255,0.55)', transition: 'all 0.2s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', padding: '12px 8px 6px' }}>
        <LineChart series={t.series} color={t.color} unit={t.unit} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', gap: '8px' }}>
        {[
          { k: 'Latest', v: `${t.latest}${t.unit}` },
          { k: 'Avg',    v: `${t.avg}${t.unit}` },
          { k: 'Min',    v: `${t.min}${t.unit}` },
          { k: 'Max',    v: `${t.max}${t.unit}` },
        ].map(s => (
          <div key={s.k} style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 3px' }}>{s.k}</p>
            <p style={{ color: '#e0f0ff', fontSize: '15px', fontWeight: 800, margin: 0 }}>{s.v}</p>
          </div>
        ))}
        <div style={{ textAlign: 'center', flex: 1.2 }}>
          <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 3px' }}>Trend</p>
          <p style={{ color: interp.color, fontSize: '13px', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>
            {interp.arrow} {interp.label}
          </p>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Trend Analysis</p>
        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Your Cardiovascular History</p>
      </div>
      <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>Recent readings</span>
    </div>
  );
}

const cardShell = (mounted: boolean): React.CSSProperties => ({
  background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px',
  animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none',
});
