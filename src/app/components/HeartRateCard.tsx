import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Heart, Plus } from 'lucide-react';

export function HeartRateCard() {
  const [bpm, setBpm] = useState(76);
  const [history, setHistory] = useState([72, 75, 73, 78, 76, 74, 77, 75, 73, 76]);
  const [inputVal, setInputVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [pulse, setPulse] = useState(false);

  const handleAdd = () => {
    const val = parseInt(inputVal);
    if (!val || isNaN(val) || val < 30 || val > 220) return;
    const newHistory = [...history.slice(1), val];
    setHistory(newHistory);
    setBpm(val);
    setInputVal('');
    setShowInput(false);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const status = bpm < 60 ? 'Low' : bpm <= 100 ? 'Normal' : 'High';
  const statusColor = bpm < 60 ? '#3b82f6' : bpm <= 100 ? '#22c55e' : '#ef4444';

  const data = {
    labels: history.map(() => ''),
    datasets: [{
      data: history,
      borderColor: 'rgba(239,68,68,1)',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    }],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { y: { display: false }, x: { display: false } },
    animation: { duration: 500 },
  };

  return (
    <>
      <style>{`
        @keyframes heartBeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.25)} }
        @keyframes cardEntrance { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .heart-card { animation: cardEntrance 0.5s ease forwards; }
        .heart-pulse { animation: heartBeat 0.6s ease; }
        .log-btn-hr { transition: all 0.2s; }
        .log-btn-hr:hover { background: rgba(239,68,68,0.3) !important; transform: scale(1.05); }
      `}</style>

      <div className="glass-card p-4 h-100 heart-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="icon-circle" style={{ backgroundColor:'rgba(239,68,68,0.2)' }}>
              <Heart size={20} color="#ef4444" className={pulse ? 'heart-pulse' : ''} />
            </div>
            <h5 className="text-white mb-0">Heart Rate</h5>
          </div>
          <button
            className="log-btn-hr"
            onClick={() => setShowInput(!showInput)}
            style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'4px 10px', color:'#ef4444', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}
          >
            <Plus size={12} /> Log BPM
          </button>
        </div>

        {showInput && (
          <div className="d-flex gap-2 mb-3" style={{ animation:'cardEntrance 0.2s ease' }}>
            <input
              type="number" placeholder="Enter BPM (30-220)" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'8px', padding:'6px 10px', color:'#fff', fontSize:'13px', outline:'none' }}
            />
            <button onClick={handleAdd} style={{ background:'#ef4444', border:'none', borderRadius:'8px', padding:'6px 12px', color:'#fff', fontSize:'12px', cursor:'pointer', fontWeight:600 }}>Add</button>
          </div>
        )}

        <div className="mb-2 d-flex align-items-baseline gap-2">
          <span className="metric-value">{bpm}</span>
          <span className="metric-unit">BPM</span>
          <span style={{ fontSize:'11px', background:`${statusColor}20`, color:statusColor, padding:'2px 8px', borderRadius:'20px', border:`1px solid ${statusColor}40` }}>{status}</span>
        </div>

        <div style={{ height:'80px' }}>
          <Line options={options as any} data={data} />
        </div>

        <p className="text-white-50 small mb-0 mt-2">Normal range: 60–100 BPM</p>
      </div>
    </>
  );
}