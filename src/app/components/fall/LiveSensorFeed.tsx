import type { SensorSample } from '../../../services/fallAlgorithm';
import { FREE_FALL_G, IMPACT_G } from '../../../services/fallAlgorithm';

const W = 600, H = 170, PAD = 14, MAX_G = 4;

interface Props {
  samples:    SensorSample[];
  monitoring: boolean;
  latestG:    number;
}

/** Real-time accelerometer line chart (g-magnitude) with threshold guides. */
export function LiveSensorFeed({ samples, monitoring, latestG }: Props) {
  const gToY = (g: number) => PAD + (1 - Math.min(g, MAX_G) / MAX_G) * (H - 2 * PAD);
  const n = samples.length;
  const xAt = (i: number) => PAD + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * PAD));

  const pts = samples.map((s, i) => `${xAt(i)},${gToY(s.g)}`).join(' ');
  const lineColor = latestG > IMPACT_G ? '#ef4444' : latestG < FREE_FALL_G ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Live Sensor Feed</p>
          <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Accelerometer Force</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: monitoring ? '#22c55e' : '#64748b', boxShadow: monitoring ? '0 0 6px #22c55e' : 'none', animation: monitoring ? 'fallPulse 1.4s ease-out infinite' : 'none' }} />
          <span style={{ color: monitoring ? '#22c55e' : 'rgba(180,210,255,0.4)', fontSize: '12px', fontWeight: 700 }}>
            {monitoring ? 'Listening' : 'Paused'}
          </span>
          <span style={{ color: lineColor, fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginLeft: '8px' }}>{latestG.toFixed(2)} g</span>
        </div>
      </div>

      <div style={{ position: 'relative', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', overflow: 'hidden' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="ff-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Threshold guides */}
          <Guide y={gToY(IMPACT_G)}    color="#ef4444" label={`Impact ${IMPACT_G}g`} />
          <Guide y={gToY(1)}           color="#64748b" label="Rest 1g" dim />
          <Guide y={gToY(FREE_FALL_G)} color="#f59e0b" label={`Free-fall ${FREE_FALL_G}g`} />

          {n > 1 && (
            <>
              <polygon points={`${PAD},${H - PAD} ${pts} ${xAt(n - 1)},${H - PAD}`} fill="url(#ff-fill)" />
              <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${lineColor}88)` }} />
              <circle cx={xAt(n - 1)} cy={gToY(samples[n - 1].g)} r="3.5" fill="#fff" stroke={lineColor} strokeWidth="1.5" />
            </>
          )}
          {n <= 1 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fill="rgba(180,210,255,0.4)" fontSize="13">
              {monitoring ? 'Waiting for sensor data…' : 'Monitoring paused'}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

function Guide({ y, color, label, dim }: { y: number; color: string; label: string; dim?: boolean }) {
  return (
    <g>
      <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity={dim ? 0.3 : 0.5} />
      <text x={W - PAD - 2} y={y - 3} textAnchor="end" fill={color} fontSize="9" opacity={dim ? 0.5 : 0.8} fontFamily="monospace">{label}</text>
    </g>
  );
}
