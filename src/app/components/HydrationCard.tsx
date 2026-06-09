import { useState } from 'react';
import { Droplet, Plus } from 'lucide-react';

export function HydrationCard() {
  const [current, setCurrent] = useState(1.8);
  const [inputVal, setInputVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [ripple, setRipple] = useState(false);
  const goal = 2.5;
  const percentage = Math.min((current / goal) * 100, 100);

  const handleAdd = () => {
    const val = parseFloat(inputVal);
    if (!val || isNaN(val) || val <= 0) return;
    setCurrent(prev => Math.min(+(prev + val).toFixed(1), 10));
    setInputVal('');
    setShowInput(false);
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
  };

  const statusColor = percentage >= 100 ? '#22c55e' : percentage >= 60 ? '#3b82f6' : '#f59e0b';

  return (
    <>
      <style>{`
        @keyframes cardEntrance { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes waterRise { from { height: 0%; } to { height: var(--pct); } }
        @keyframes wave { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes dropPop { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }
        .hydration-card { animation: cardEntrance 0.5s 0.1s ease both; }
        .drop-ripple { animation: dropPop 0.6s ease; }
        .water-wave { animation: wave 2s linear infinite; }
        .log-btn-h { transition: all 0.2s; }
        .log-btn-h:hover { background: rgba(59,130,246,0.3) !important; transform: scale(1.05); }
      `}</style>

      <div className="glass-card p-4 h-100 hydration-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="icon-circle" style={{ backgroundColor:'rgba(59,130,246,0.2)' }}>
              <Droplet size={20} color="#3b82f6" className={ripple ? 'drop-ripple' : ''} />
            </div>
            <h5 className="text-white mb-0">Hydration</h5>
          </div>
          <button
            className="log-btn-h"
            onClick={() => setShowInput(!showInput)}
            style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'8px', padding:'4px 10px', color:'#3b82f6', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}
          >
            <Plus size={12} /> Add Water
          </button>
        </div>

        {showInput && (
          <div className="d-flex gap-2 mb-3" style={{ animation:'cardEntrance 0.2s ease' }}>
            <input
              type="number" step="0.1" placeholder="Liters (e.g. 0.5)" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:'8px', padding:'6px 10px', color:'#fff', fontSize:'13px', outline:'none' }}
            />
            <button onClick={handleAdd} style={{ background:'#3b82f6', border:'none', borderRadius:'8px', padding:'6px 12px', color:'#fff', fontSize:'12px', cursor:'pointer', fontWeight:600 }}>Add</button>
          </div>
        )}

        <div className="mb-2 d-flex align-items-baseline gap-2">
          <span className="metric-value">{current.toFixed(1)}</span>
          <span className="metric-unit">L</span>
          {percentage >= 100 && <span style={{ fontSize:'11px', background:'rgba(34,197,94,0.15)', color:'#22c55e', padding:'2px 8px', borderRadius:'20px' }}>✓ Goal reached!</span>}
        </div>

        <div className="water-container mb-3" style={{ position:'relative', overflow:'hidden' }}>
          <div
            className="water-fill"
            style={{ height:`${percentage}%`, background:`linear-gradient(180deg, ${statusColor}60, ${statusColor}40)`, transition:'height 0.8s ease' }}
          >
            <div className="water-wave" />
          </div>
          <div className="water-glass-overlay" />
        </div>

        <p className="text-white-50 small mb-0 text-center">
          {current.toFixed(1)}L of {goal}L daily goal
          <span style={{ marginLeft:'8px', color:statusColor }}>({Math.round(percentage)}%)</span>
        </p>
      </div>
    </>
  );
}