import { useState } from 'react';
import { Footprints, Plus } from 'lucide-react';

export function StepsCard() {
  const [steps, setSteps] = useState(7400);
  const [inputVal, setInputVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const goal = 10000;
  const percentage = Math.min((steps / goal) * 100, 100);

  const handleAdd = () => {
    const val = parseInt(inputVal);
    if (!val || isNaN(val) || val <= 0) return;
    setSteps(prev => Math.min(prev + val, 99999));
    setInputVal('');
    setShowInput(false);
  };

  const statusColor = percentage >= 100 ? '#22c55e' : percentage >= 70 ? '#f59e0b' : '#22c55e';

  return (
    <>
      <style>{`
        @keyframes cardEntrance { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes progressSpin {
          from { stroke-dashoffset: 314; }
        }
        .steps-card { animation: cardEntrance 0.5s 0.15s ease both; }
        .log-btn-s { transition: all 0.2s; }
        .log-btn-s:hover { background: rgba(34,197,94,0.3) !important; transform: scale(1.05); }
        .steps-ring { transition: stroke-dashoffset 0.8s ease; }
      `}</style>

      <div className="glass-card p-4 h-100 steps-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="icon-circle" style={{ backgroundColor:'rgba(34,197,94,0.2)' }}>
              <Footprints size={20} color="#22c55e" />
            </div>
            <h5 className="text-white mb-0">Steps</h5>
          </div>
          <button
            className="log-btn-s"
            onClick={() => setShowInput(!showInput)}
            style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'8px', padding:'4px 10px', color:'#22c55e', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}
          >
            <Plus size={12} /> Log Steps
          </button>
        </div>

        {showInput && (
          <div className="d-flex gap-2 mb-3" style={{ animation:'cardEntrance 0.2s ease' }}>
            <input
              type="number" placeholder="Steps (e.g. 1000)" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(34,197,94,0.4)', borderRadius:'8px', padding:'6px 10px', color:'#fff', fontSize:'13px', outline:'none' }}
            />
            <button onClick={handleAdd} style={{ background:'#22c55e', border:'none', borderRadius:'8px', padding:'6px 12px', color:'#fff', fontSize:'12px', cursor:'pointer', fontWeight:600 }}>Add</button>
          </div>
        )}

        <div className="d-flex justify-content-center align-items-center mb-3" style={{ height:'120px' }}>
          {/* SVG Ring */}
          <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
              <circle
                className="steps-ring"
                cx="55" cy="55" r="46"
                fill="none"
                stroke={statusColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * percentage) / 100}
                transform="rotate(-90 55 55)"
                style={{ filter:`drop-shadow(0 0 6px ${statusColor}80)` }}
              />
            </svg>
            <div style={{ position:'absolute', textAlign:'center' }}>
              <div className="metric-value-small" style={{ color:'#fff', fontSize:'18px', fontWeight:700 }}>{steps.toLocaleString()}</div>
              <div className="text-white-50 small">of {goal.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <p className="text-white-50 small mb-0 text-center">
          {percentage.toFixed(0)}% of daily goal
          {percentage >= 100 && <span style={{ color:'#22c55e', marginLeft:'6px' }}>🎉 Completed!</span>}
        </p>
      </div>
    </>
  );
}