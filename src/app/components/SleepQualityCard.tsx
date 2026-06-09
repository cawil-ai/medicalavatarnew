import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Moon, Plus } from 'lucide-react';

export function SleepQualityCard() {
  const [sleepData, setSleepData] = useState([7.2, 6.5, 8.0, 7.5, 6.8, 8.5, 7.8]);
  const [inputVal, setInputVal] = useState('');
  const [showInput, setShowInput] = useState(false);

  const avg = (sleepData.reduce((a, b) => a + b, 0) / sleepData.length).toFixed(1);

  const handleAdd = () => {
    const val = parseFloat(inputVal);
    if (!val || isNaN(val) || val < 0 || val > 24) return;
    const newData = [...sleepData.slice(1), val];
    setSleepData(newData);
    setInputVal('');
    setShowInput(false);
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = {
    labels: days,
    datasets: [{
      data: sleepData,
      backgroundColor: sleepData.map(h => h >= 7 ? 'rgba(139,92,246,0.85)' : 'rgba(139,92,246,0.4)'),
      borderRadius: 6,
      barThickness: 20,
    }],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        callbacks: { label: (ctx: any) => `${ctx.parsed.y} hours` },
      },
    },
    scales: {
      y: { display: false, max: 10 },
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } },
      },
    },
    animation: { duration: 600 },
  };

  const qualityColor = parseFloat(avg) >= 7 ? '#22c55e' : parseFloat(avg) >= 6 ? '#f59e0b' : '#ef4444';
  const qualityLabel = parseFloat(avg) >= 7 ? 'Good' : parseFloat(avg) >= 6 ? 'Fair' : 'Poor';

  return (
    <>
      <style>{`
        @keyframes cardEntrance { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .sleep-card { animation: cardEntrance 0.5s 0.2s ease both; }
        .log-btn-sl { transition: all 0.2s; }
        .log-btn-sl:hover { background: rgba(139,92,246,0.3) !important; transform: scale(1.05); }
      `}</style>

      <div className="glass-card p-4 h-100 sleep-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="icon-circle" style={{ backgroundColor:'rgba(139,92,246,0.2)' }}>
              <Moon size={20} color="#8b5cf6" />
            </div>
            <h5 className="text-white mb-0">Sleep Quality</h5>
          </div>
          <button
            className="log-btn-sl"
            onClick={() => setShowInput(!showInput)}
            style={{ background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'8px', padding:'4px 10px', color:'#8b5cf6', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}
          >
            <Plus size={12} /> Log Sleep
          </button>
        </div>

        {showInput && (
          <div className="d-flex gap-2 mb-3" style={{ animation:'cardEntrance 0.2s ease' }}>
            <input
              type="number" step="0.1" placeholder="Hours slept (e.g. 7.5)" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:'8px', padding:'6px 10px', color:'#fff', fontSize:'13px', outline:'none' }}
            />
            <button onClick={handleAdd} style={{ background:'#8b5cf6', border:'none', borderRadius:'8px', padding:'6px 12px', color:'#fff', fontSize:'12px', cursor:'pointer', fontWeight:600 }}>Add</button>
          </div>
        )}

        <div className="mb-2 d-flex align-items-baseline gap-2">
          <span className="metric-value">{avg}</span>
          <span className="metric-unit">hrs</span>
          <span style={{ fontSize:'11px', background:`${qualityColor}20`, color:qualityColor, padding:'2px 8px', borderRadius:'20px', border:`1px solid ${qualityColor}40` }}>{qualityLabel}</span>
        </div>

        <div style={{ height:'100px' }}>
          <Bar options={options as any} data={data} />
        </div>

        <p className="text-white-50 small mb-0 mt-2">Last 7 days average · Tap bar for details</p>
      </div>
    </>
  );
}