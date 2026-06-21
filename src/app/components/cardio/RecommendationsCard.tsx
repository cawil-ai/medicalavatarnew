import { useState } from 'react';
import type { Recommendation } from '../../../services/cardioIntelligence';

const PRIORITY = {
  high:   { label: 'High',   color: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low:    { label: 'Low',    color: '#22c55e' },
} as const;

/**
 * RecommendationsCard — "Personalised + Explainable Recommendations".
 * Each item exposes a "Why this?" toggle revealing the metric-based
 * reason it was generated, so advice is never an unexplained black box.
 */
export function RecommendationsCard({ recs, mounted = true }: { recs: Recommendation[]; mounted?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div
      style={{
        background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px',
        animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Personalised For You</p>
          <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Recommendations</p>
        </div>
        <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>{recs.length} actions</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {recs.map(rec => {
          const pr = PRIORITY[rec.priority];
          const isOpen = open === rec.id;
          return (
            <div key={rec.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${rec.color}28`, borderRadius: '14px', padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '10px', background: `${rec.color}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
                  {rec.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e0f0ff', fontSize: '13.5px', fontWeight: 700 }}>{rec.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', background: `${pr.color}1f`, color: pr.color, border: `1px solid ${pr.color}44` }}>{pr.label}</span>
                  </div>
                  <p style={{ color: 'rgba(200,225,255,0.7)', fontSize: '12px', lineHeight: 1.5, margin: '5px 0 0' }}>{rec.detail}</p>

                  <button
                    onClick={() => setOpen(isOpen ? null : rec.id)}
                    style={{ marginTop: '8px', background: 'transparent', border: 'none', color: rec.color, fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isOpen ? '▾ Hide reason' : '▸ Why this?'}
                  </button>
                  {isOpen && (
                    <p style={{ color: 'rgba(180,210,255,0.7)', fontSize: '11.5px', lineHeight: 1.5, margin: '6px 0 0', padding: '8px 11px', background: 'rgba(6,15,40,0.5)', borderRadius: '9px', borderLeft: `2px solid ${rec.color}` }}>
                      {rec.why}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
