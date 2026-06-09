import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Brain, Plus, X, Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID, account } from '../../lib/appwrite';

const meditationPink   = '/assets/meditationpink.png';
const meditationGreen  = '/assets/meditationgreen.png';
const meditationPurple = '/assets/meditationpurple.png';
const meditationBlue   = '/assets/meditationblue.png';
const meditationYellow = '/assets/meditationyellow.png';
const lotusFlower      = '/assets/lotusflower.jpg';
const meditationFlower = '/assets/meditationflower.jpg';
const clockImg         = '/assets/clock.png';
const streakImg        = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

interface MedSession {
  id: string;
  date: string;
  type: string;
  duration: string;
  durationSec: number;
  completedMins: number;
  notes: string;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  'Morning Calm':  '#a78bfa',
  'Sleep Prep':    '#818cf8',
  'Stress Relief': '#34d399',
  'Focus':         '#fbbf24',
  'Body Scan':     '#f472b6',
  'Breathing':     '#38bdf8',
};

const TYPE_FIGURES: Record<string, string> = {
  'Morning Calm':  meditationYellow,
  'Sleep Prep':    meditationPurple,
  'Stress Relief': meditationGreen,
  'Focus':         meditationBlue,
  'Body Scan':     meditationPink,
  'Breathing':     meditationBlue,
};

const DURATIONS = [
  { label:'3 min',  sec:180  },
  { label:'5 min',  sec:300  },
  { label:'10 min', sec:600  },
  { label:'15 min', sec:900  },
  { label:'20 min', sec:1200 },
];

const BREATHING_PATTERNS = [
  { label:'Box (4-4-4-4)', steps:['Inhale 4s','Hold 4s','Exhale 4s','Hold 4s'], durations:[4,4,4,4] },
  { label:'4-7-8',         steps:['Inhale 4s','Hold 7s','Exhale 8s'],           durations:[4,7,8]   },
  { label:'Calm (4-6)',    steps:['Inhale 4s','Exhale 6s'],                      durations:[4,6]     },
];

const FEATURED = [
  { title:'Morning Awakening', tag:'Serenity',  minutes:9,  img:meditationYellow, color:'#fbbf24', glow:'rgba(251,191,36,0.4)',  bg:'rgba(251,191,36,0.08)' },
  { title:'Relax Mode',        tag:'Deep Rest', minutes:15, img:meditationPink,   color:'#f472b6', glow:'rgba(244,114,182,0.4)', bg:'rgba(244,114,182,0.08)' },
  { title:'Calm Focus',        tag:'Clarity',   minutes:10, img:meditationBlue,   color:'#38bdf8', glow:'rgba(56,189,248,0.4)',  bg:'rgba(56,189,248,0.08)' },
  { title:'Body Wisdom',       tag:'Calming',   minutes:12, img:meditationGreen,  color:'#34d399', glow:'rgba(52,211,153,0.4)',  bg:'rgba(52,211,153,0.08)' },
];

export function MeditationPage() {
  const navigate = useNavigate();
  const [mounted, setMounted]           = useState(false);
  const { isMobile, isTablet }          = useResponsive();
  const [sessions, setSessions]         = useState<MedSession[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [type, setType]                 = useState('Morning Calm');
  const [duration, setDuration]         = useState(DURATIONS[2]);
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [timerActive, setTimerActive]   = useState(false);
  const [timerSec, setTimerSec]         = useState(DURATIONS[2].sec);
  const [timerTotal, setTimerTotal]     = useState(DURATIONS[2].sec);
  const [timerDone, setTimerDone]       = useState(false);
  const [selectedBreath, setSelectedBreath] = useState(BREATHING_PATTERNS[0]);
  const [breathStep, setBreathStep]     = useState(0);
  const [breathProg, setBreathProg]     = useState(0);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const intervalRef  = useRef<any>(null);
  const breathRef    = useRef<any>(null);
  const breathSecRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    loadSessions();
  }, []);

  /* ── Load sessions from Appwrite ──────────────────────────────── */
  const loadSessions = async () => {
    try {
      const user = await account.get();
      const res  = await databases.listDocuments(DATABASE_ID, COLLECTIONS.meditation);
      const mine = res.documents.filter(d => d.userID === user.$id);
      const mapped: MedSession[] = mine.map(doc => ({
        id:            doc.$id,
        date:          new Date(doc.loggedAt).toLocaleString(),
        type:          doc.sessionType   || 'Morning Calm',
        duration:      `${doc.durationMinutes} min`,
        durationSec:   doc.durationMinutes * 60,
        completedMins: doc.completedMins  || 0,
        notes:         '',
        color:         TYPE_COLORS[doc.sessionType] || '#a78bfa',
      }));
      setSessions(mapped);
    } catch (err) {
      console.error('❌ Load meditation error:', err);
    }
  };

  useEffect(() => {
    if (timerActive && timerSec > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSec(p => {
          if (p <= 1) {
            setTimerActive(false);
            setTimerDone(true);
            clearInterval(intervalRef.current);
            toast.success('Meditation session complete!');
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerActive]);

  useEffect(() => {
    if (timerActive) {
      breathSecRef.current = 0;
      breathRef.current = setInterval(() => {
        breathSecRef.current += 0.1;
        const stepDur = selectedBreath.durations[breathStep];
        setBreathProg(Math.min((breathSecRef.current / stepDur) * 100, 100));
        if (breathSecRef.current >= stepDur) {
          breathSecRef.current = 0;
          setBreathStep(p => (p + 1) % selectedBreath.steps.length);
        }
      }, 100);
    } else {
      clearInterval(breathRef.current);
    }
    return () => clearInterval(breathRef.current);
  }, [timerActive, breathStep, selectedBreath]);

  const startTimer  = () => { setTimerSec(timerTotal); setTimerActive(true); setTimerDone(false); setBreathStep(0); setBreathProg(0); };
  const pauseTimer  = () => setTimerActive(p => !p);
  const resetTimer  = () => { setTimerActive(false); setTimerSec(timerTotal); setTimerDone(false); setBreathStep(0); setBreathProg(0); };
  const setTimerDur = (d: typeof DURATIONS[0]) => { setDuration(d); setTimerTotal(d.sec); setTimerSec(d.sec); setTimerActive(false); setTimerDone(false); };

  /* ── Save session to Appwrite ─────────────────────────────────── */
  const addSession = async () => {
    setSaving(true);
    try {
      const user         = await account.get();
      const today        = new Date().toISOString().split('T')[0];
      const durationMins = Math.round(duration.sec / 60);
      const completed    = Math.round((timerTotal - timerSec) / 60);

      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.meditation,
        ID.unique(),
        {
          userID:          user.$id,
          sessionType:     type,
          durationMinutes: durationMins,
          completedMins:   Math.max(completed, 1),
          date:            today,
          loggedAt:        new Date().toISOString(),
        }
      );
      console.log('✅ Meditation saved:', doc);

      const newSession: MedSession = {
        id:            doc.$id,
        date:          'Just now',
        type,
        duration:      duration.label,
        durationSec:   duration.sec,
        completedMins: Math.max(completed, 1),
        notes,
        color:         TYPE_COLORS[type] || '#a78bfa',
      };
      setSessions(p => [newSession, ...p]);
      toast.success('Session logged!');
      setNotes('');
      setShowForm(false);
    } catch (err) {
      console.error('❌ Save meditation error:', err);
      toast.error('Failed to save session. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime   = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const progress     = ((timerTotal - timerSec) / timerTotal) * 100;
  const r = 72; const circ = 2 * Math.PI * r;
  const totalMinutes = sessions.reduce((a,b) => a + b.durationSec/60, 0);
  const streak = 5;

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(180,150,255,0.15)',
    borderRadius: '20px',
    transition: 'all 0.3s ease',
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(22px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn   { from{opacity:0;} to{opacity:1;} }
        @keyframes ringPulse{ 0%{transform:scale(1);opacity:.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes lotusBloom {
          0%,100%{ transform:scale(1) rotate(0deg); filter:drop-shadow(0 0 20px rgba(244,114,182,0.4)) brightness(1); }
          50%    { transform:scale(1.06) rotate(3deg); filter:drop-shadow(0 0 40px rgba(244,114,182,0.7)) brightness(1.1); }
        }
        @keyframes figureBreath {
          0%,100%{ transform:scale(1) translateY(0); filter:drop-shadow(0 8px 30px var(--fig-glow)); }
          50%    { transform:scale(1.05) translateY(-6px); filter:drop-shadow(0 16px 45px var(--fig-glow)); }
        }
        @keyframes clockTick {
          0%,100%{ transform:rotate(-2deg); filter:drop-shadow(0 0 14px rgba(251,191,36,0.4)); }
          50%    { transform:rotate(2deg);  filter:drop-shadow(0 0 24px rgba(251,191,36,0.65)); }
        }
        @keyframes streakPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.1) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes petalFloat {
          0%  { transform:translateY(0) rotate(0deg) translateX(0); opacity:.8; }
          100%{ transform:translateY(-80px) rotate(120deg) translateX(20px); opacity:0; }
        }
        @keyframes breathExpand {
          0%,100%{ transform:scale(1); opacity:.4; }
          50%    { transform:scale(1.25); opacity:.1; }
        }
        @keyframes shimmer {
          0%  { transform:translateX(-100%); }
          100%{ transform:translateX(100%); }
        }
        .feat-card:hover { transform:translateY(-5px) scale(1.02) !important; }
        .feat-card { transition: all 0.3s cubic-bezier(.4,0,.2,1); }
        .session-item { transition: all 0.2s ease; }
        .session-item:hover { transform:translateX(4px) !important; background:rgba(180,150,255,0.07) !important; border-color:rgba(167,139,250,0.25) !important; }
        .dur-btn:hover { background:rgba(167,139,250,0.2) !important; color:#c4b5fd !important; }
        .breath-btn:hover { background:rgba(167,139,250,0.15) !important; }
        .med-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(167,139,250,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .med-input:focus { border-color:rgba(167,139,250,0.6); background:rgba(255,255,255,0.1); box-shadow:0 0 0 3px rgba(167,139,250,0.12); }
        .med-input::placeholder { color:rgba(180,210,255,0.35); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(167,139,250,0.3); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding:0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 1fr', gap:'22px', minHeight:'calc(100vh - 73px)' }}>

            {/* ── LEFT COLUMN ──────────────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Page Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ position:'relative', width:52, height:52 }}>
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(167,139,250,0.15)', animation:'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position:'absolute', inset:'8px', borderRadius:'50%', background:'rgba(167,139,250,0.2)', animation:'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Brain size={22} color="#a78bfa" />
                    </div>
                  </div>
                  <div>
                    <h1 style={{ color:'#e0f0ff', fontWeight:900, fontSize:'22px', margin:0, letterSpacing:'-0.3px' }}>Meditation</h1>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:'2px 0 0' }}>Find your inner peace</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                  style={{ background:'linear-gradient(135deg,#8b5cf6,#6d28d9)', border:'none', borderRadius:'12px', padding:'11px 20px', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 18px rgba(139,92,246,0.35)', transition:'all .2s', display:'flex', alignItems:'center', gap:'7px' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 26px rgba(139,92,246,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 18px rgba(139,92,246,0.35)'; }}>
                  <Plus size={15}/> Log Session
                </button>
              </div>

              {/* Hero Banner */}
              <div style={{ ...card, padding:0, overflow:'hidden', position:'relative', border:'1px solid rgba(244,114,182,0.2)', boxShadow:'0 8px 40px rgba(167,139,250,0.2)', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none', minHeight:'200px' }}>
                <div style={{ position:'absolute', inset:0, backgroundImage:`url(${lotusFlower})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.25 }} />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, rgba(8,20,50,0.7) 0%, rgba(139,92,246,0.3) 50%, rgba(244,114,182,0.25) 100%)' }} />
                <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)', animation:'shimmer 4s ease infinite' }} />
                </div>
                {[{left:'10%',d:0},{left:'30%',d:1},{left:'60%',d:2},{left:'80%',d:0.5},{left:'50%',d:1.5}].map((p,i) => (
                  <div key={i} style={{ position:'absolute', bottom:'20px', left:p.left, width:8, height:8, borderRadius:'50% 20%', background:'rgba(244,114,182,0.5)', animation:`petalFloat 3s ease-in-out infinite`, animationDelay:`${p.d}s`, pointerEvents:'none', transform:'rotate(45deg)' }} />
                ))}
                <div style={{ position:'relative', zIndex:1, padding:'28px', display:'flex', alignItems:'center', gap:'24px' }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', inset:'-12px', borderRadius:'50%', background:'rgba(244,114,182,0.12)', animation:'breathExpand 4s ease-in-out infinite' }} />
                    <img src={meditationFlower} alt="Lotus" style={{ width:100, height:100, objectFit:'cover', borderRadius:'50%', animation:'lotusBloom 4s ease-in-out infinite', filter:'drop-shadow(0 0 20px rgba(244,114,182,0.55)) brightness(1.1)', border:'2px solid rgba(244,114,182,0.4)' }} />
                  </div>
                  <div>
                    <p style={{ color:'rgba(220,180,255,0.7)', fontSize:'11px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', margin:'0 0 4px' }}>Daily Practice</p>
                    <h2 style={{ color:'#f0e6ff', fontWeight:900, fontSize:'22px', margin:'0 0 6px', letterSpacing:'-0.3px' }}>Blooming Serenity</h2>
                    <p style={{ color:'rgba(220,180,255,0.65)', fontSize:'13px', margin:'0 0 14px', maxWidth:'260px', lineHeight:1.5 }}>Let your mind bloom like a lotus — rooted in stillness, rising through clarity.</p>
                    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                      {[
                        { v: sessions.length,          l:'Sessions', c:'#c4b5fd' },
                        { v: Math.round(totalMinutes), l:'Minutes',  c:'#f9a8d4' },
                        { v: `${streak} days`,         l:'Streak',   c:'#fbbf24' },
                      ].map(s => (
                        <div key={s.l} style={{ background:'rgba(255,255,255,0.08)', borderRadius:'10px', padding:'7px 14px', textAlign:'center' }}>
                          <p style={{ color:s.c, fontWeight:800, fontSize:'16px', margin:0 }}>{s.v}</p>
                          <p style={{ color:'rgba(220,180,255,0.5)', fontSize:'10px', margin:0 }}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Featured Cards */}
              <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>Featured Sessions</p>
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'12px' }}>
                  {FEATURED.map((f, i) => (
                    <div key={f.title} className="feat-card" style={{ background:`rgba(8,20,50,0.8)`, backdropFilter:'blur(20px)', border:`1px solid ${f.color}33`, borderRadius:'18px', padding:'18px', position:'relative', overflow:'hidden', cursor:'pointer', boxShadow: activeFeatured === i ? `0 0 28px ${f.glow}` : '0 4px 16px rgba(0,0,0,0.3)', animationDelay:`${i*0.06}s` }} onClick={() => setActiveFeatured(i)}>
                      <div style={{ position:'absolute', inset:0, background:f.bg, pointerEvents:'none' }} />
                      {activeFeatured === i && (
                        <div style={{ position:'absolute', top:8, right:8, width:8, height:8, borderRadius:'50%', background:f.color, boxShadow:`0 0 8px ${f.color}` }} />
                      )}
                      <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
                        <div>
                          <p style={{ color:`${f.color}cc`, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 3px' }}>{f.tag}</p>
                          <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'14px', margin:'0 0 6px', lineHeight:1.3 }}>{f.title}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'20px', padding:'4px 10px', width:'fit-content' }}>
                            <Play size={10} fill={f.color} color={f.color} />
                            <span style={{ color:f.color, fontSize:'11px', fontWeight:700 }}>{f.minutes} Minutes</span>
                          </div>
                        </div>
                        <img src={f.img} alt={f.title} style={{ width:64, height:64, objectFit:'contain', filter:`drop-shadow(0 0 16px ${f.glow})`, animation:'figureBreath 4s ease-in-out infinite', ['--fig-glow' as any]: f.glow }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak Card */}
              <div style={{ ...card, border:'1px solid rgba(251,191,36,0.25)', padding:'18px 22px', display:'flex', alignItems:'center', gap:'18px', animation: mounted ? 'fadeUp 0.5s ease 0.26s both' : 'none', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', right:'-20px', top:'-20px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(251,191,36,0.06)', filter:'blur(28px)', pointerEvents:'none' }} />
                <div style={{ position:'relative', flexShrink:0 }}>
                  <img src={streakImg} alt="Streak" style={{ width:64, height:64, objectFit:'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.4s both' : 'none', filter:'drop-shadow(0 0 14px rgba(251,191,36,0.6))' }} />
                  <div style={{ position:'absolute', bottom:-2, right:-4, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'2px solid rgba(8,20,50,0.9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 10px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.5s ease 0.65s both' : 'none' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>Meditation Streak</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
                    <span style={{ color:'#fbbf24', fontWeight:900, fontSize:'28px', lineHeight:1 }}>{streak}</span>
                    <span style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', fontWeight:500 }}>days in a row</span>
                  </div>
                  <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'11px', margin:'3px 0 0' }}>Consistent daily practice this week</p>
                </div>
                <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                  {Array.from({length:7}).map((_,i) => (
                    <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i < streak ? '#fbbf24' : 'rgba(255,255,255,0.1)', boxShadow: i < streak ? '0 0 6px rgba(251,191,36,0.6)' : 'none', transition:`all 0.3s ease ${i*0.05}s` }} />
                  ))}
                </div>
              </div>

              {/* Log Form */}
              {showForm && (
                <div style={{ ...card, border:'1px solid rgba(167,139,250,0.3)', padding:'24px', animation:'fadeUp 0.25s ease' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
                    <div style={{ width:36, height:36, borderRadius:'10px', background:'rgba(167,139,250,0.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Brain size={18} color="#a78bfa" />
                    </div>
                    <div>
                      <h4 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'16px', margin:0 }}>Log Session</h4>
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>Record your practice</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                    <select value={type} onChange={e => setType(e.target.value)} className="med-input" style={{ flex:1, minWidth:'140px' }}>
                      {Object.keys(TYPE_COLORS).map(o => <option key={o} value={o} style={{ background:'#0d1a38' }}>{o}</option>)}
                    </select>
                    <select value={duration.label} onChange={e => setDuration(DURATIONS.find(d => d.label===e.target.value)!)} className="med-input" style={{ width:'110px' }}>
                      {DURATIONS.map(d => <option key={d.label} value={d.label} style={{ background:'#0d1a38' }}>{d.label}</option>)}
                    </select>
                  </div>
                  <input placeholder="How did your session go?" value={notes} onChange={e => setNotes(e.target.value)} className="med-input" style={{ marginBottom:'14px' }} />
                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={addSession} disabled={saving}
                      style={{ flex:1, padding:'12px', background: saving ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:'0 4px 16px rgba(139,92,246,0.35)', transition:'all .2s' }}
                      onMouseEnter={e => { if(!saving){ e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                      onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
                      {saving ? 'Saving...' : 'Save Session'}
                    </button>
                    <button onClick={() => setShowForm(false)} style={{ padding:'12px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:'12px', color:'rgba(180,210,255,0.7)', cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Timer Card */}
              <div style={{ ...card, border:'1px solid rgba(167,139,250,0.2)', padding:'28px', position:'relative', overflow:'hidden', animation: mounted ? 'fadeUp 0.5s ease 0.12s both' : 'none', boxShadow:'0 8px 40px rgba(139,92,246,0.15)' }}>
                <div style={{ position:'absolute', inset:0, backgroundImage:`url(${meditationFlower})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.04, borderRadius:'20px' }} />
                <div style={{ position:'absolute', top:'-40px', right:'-40px', width:'200px', height:'200px', borderRadius:'50%', background:'rgba(167,139,250,0.06)', filter:'blur(50px)', pointerEvents:'none' }} />

                <div style={{ position:'relative', zIndex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
                    <div>
                      <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>Timer</p>
                      <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:0 }}>Meditation Session</p>
                    </div>
                    <img src={clockImg} alt="Clock" style={{ width:52, height:52, objectFit:'contain', animation:'clockTick 3s ease-in-out infinite', filter:'drop-shadow(0 0 10px rgba(251,191,36,0.4))' }} />
                  </div>

                  <div style={{ display:'flex', gap:'7px', marginBottom:'24px', flexWrap:'wrap' }}>
                    {DURATIONS.map(d => (
                      <button key={d.label} className="dur-btn" onClick={() => setTimerDur(d)}
                        style={{ padding:'7px 14px', borderRadius:'20px', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all .2s', background: duration.sec===d.sec ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)', border:`1px solid ${duration.sec===d.sec ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`, color: duration.sec===d.sec ? '#c4b5fd' : 'rgba(180,210,255,0.45)' }}>
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'22px', position:'relative' }}>
                    {timerActive && (
                      <>
                        <div style={{ position:'absolute', width:'220px', height:'220px', borderRadius:'50%', border:`2px solid rgba(167,139,250,0.15)`, animation:'breathExpand 4s ease-in-out infinite' }} />
                        <div style={{ position:'absolute', width:'200px', height:'200px', borderRadius:'50%', border:`2px solid rgba(167,139,250,0.2)`, animation:'breathExpand 4s ease-in-out infinite 1s' }} />
                      </>
                    )}

                    <div style={{ position:'relative', width:'180px', height:'180px' }}>
                      <svg width="180" height="180" viewBox="0 0 180 180" style={{ position:'absolute', top:0, left:0, transform:'rotate(-90deg)' }}>
                        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                        <circle cx="90" cy="90" r={r} fill="none" stroke={timerDone ? '#34d399' : 'url(#timerGrad)'} strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={circ - (circ * progress) / 100}
                          style={{ transition:'stroke-dashoffset 1s linear', filter: timerDone ? 'drop-shadow(0 0 8px #34d399)' : 'drop-shadow(0 0 8px rgba(167,139,250,0.7))' }} />
                        <defs>
                          <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#a78bfa" />
                            <stop offset="100%" stopColor="#f472b6" />
                          </linearGradient>
                        </defs>
                      </svg>

                      <div style={{ position:'absolute', inset:'12px', borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(8,20,50,0.6)' }}>
                        <img
                          src={timerDone ? meditationGreen : timerActive ? FEATURED[activeFeatured].img : meditationPurple}
                          alt="Meditation"
                          style={{ width:'100%', height:'100%', objectFit:'cover', animation: timerActive ? `figureBreath ${selectedBreath.durations[breathStep] * 2}s ease-in-out infinite` : 'none', ['--fig-glow' as any]: timerActive ? FEATURED[activeFeatured].glow : 'rgba(167,139,250,0.4)', opacity: timerActive ? 1 : 0.7, transition:'opacity 0.5s' }}
                        />
                        {!timerActive && (
                          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(8,20,50,0.3)' }}>
                            <span style={{ color:'#e0f0ff', fontWeight:900, fontSize:'28px', fontFamily:'monospace', textShadow:'0 2px 12px rgba(0,0,0,0.8)' }}>
                              {timerDone ? '✓' : formatTime(timerSec)}
                            </span>
                          </div>
                        )}
                        {timerActive && (
                          <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(8,20,50,0.7)', borderRadius:'8px', padding:'2px 8px' }}>
                            <span style={{ color:'#c4b5fd', fontWeight:700, fontSize:'12px', fontFamily:'monospace' }}>{formatTime(timerSec)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {timerActive && (
                      <div style={{ marginTop:'16px', textAlign:'center' }}>
                        <div style={{ background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.35)', borderRadius:'20px', padding:'8px 22px', display:'inline-block' }}>
                          <span style={{ color:'#c4b5fd', fontSize:'14px', fontWeight:700 }}>{selectedBreath.steps[breathStep]}</span>
                        </div>
                        <div style={{ width:'180px', height:'4px', background:'rgba(255,255,255,0.07)', borderRadius:'2px', margin:'8px auto 0' }}>
                          <div style={{ height:'100%', background:'linear-gradient(90deg,#a78bfa,#f472b6)', borderRadius:'2px', width:`${breathProg}%`, transition:'width 0.1s linear', boxShadow:'0 0 6px rgba(167,139,250,0.5)' }} />
                        </div>
                      </div>
                    )}
                    {timerDone && (
                      <p style={{ color:'#34d399', fontWeight:700, fontSize:'15px', margin:'12px 0 0', textShadow:'0 0 12px rgba(52,211,153,0.5)' }}>Session Complete!</p>
                    )}
                  </div>

                  <div style={{ display:'flex', justifyContent:'center', gap:'12px', marginBottom:'22px' }}>
                    {!timerActive && timerSec === timerTotal ? (
                      <button onClick={startTimer}
                        style={{ display:'flex', alignItems:'center', gap:'8px', background:'linear-gradient(135deg,#8b5cf6,#6d28d9)', border:'none', borderRadius:'14px', padding:'13px 36px', color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', boxShadow:'0 6px 22px rgba(139,92,246,0.45)', transition:'all .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(139,92,246,0.55)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 22px rgba(139,92,246,0.45)'; }}>
                        <Play size={16} fill="#fff" /> Begin
                      </button>
                    ) : (
                      <>
                        <button onClick={pauseTimer}
                          style={{ display:'flex', alignItems:'center', gap:'8px', background: timerActive ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'14px', padding:'13px 28px', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', transition:'all .2s', boxShadow: timerActive ? 'none' : '0 6px 22px rgba(139,92,246,0.45)' }}>
                          {timerActive ? <><Pause size={16} /> Pause</> : <><Play size={16} fill="#fff" /> Resume</>}
                        </button>
                        <button onClick={resetTimer}
                          style={{ display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px', padding:'13px 20px', color:'rgba(180,210,255,0.6)', fontSize:'14px', cursor:'pointer', transition:'all .2s' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
                          <RotateCcw size={16} /> Reset
                        </button>
                      </>
                    )}
                  </div>

                  <div>
                    <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center', margin:'0 0 8px' }}>Breathing Pattern</p>
                    <div style={{ display:'flex', justifyContent:'center', gap:'8px', flexWrap:'wrap' }}>
                      {BREATHING_PATTERNS.map(b => (
                        <button key={b.label} className="breath-btn" onClick={() => { setSelectedBreath(b); setBreathStep(0); }}
                          style={{ padding:'6px 13px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', transition:'all .2s', background: selectedBreath.label===b.label ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)', border:`1px solid ${selectedBreath.label===b.label ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`, color: selectedBreath.label===b.label ? '#c4b5fd' : 'rgba(180,210,255,0.4)', fontWeight: selectedBreath.label===b.label ? 600 : 400 }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session History */}
              <div style={{ ...card, padding:'22px', animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>History</p>
                <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>Session Log</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxHeight:'340px', overflowY:'auto' }}>
                  {sessions.length === 0 ? (
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'13px', textAlign:'center', marginTop:'20px' }}>No sessions yet. Log your first meditation!</p>
                  ) : sessions.map((s, i) => {
                    const fig = TYPE_FIGURES[s.type] || meditationPurple;
                    return (
                      <div key={s.id} className="session-item"
                        style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'12px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(100,180,255,0.07)', borderRadius:'14px', cursor:'default', animationDelay:`${i*0.04}s` }}>
                        <div style={{ width:44, height:44, borderRadius:'12px', background:`${s.color}15`, border:`1px solid ${s.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                          <img src={fig} alt={s.type} style={{ width:36, height:36, objectFit:'contain', filter:`drop-shadow(0 0 6px ${s.color}60)` }} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'3px' }}>
                            <span style={{ color:'#e0f0ff', fontWeight:700, fontSize:'13px' }}>{s.type}</span>
                            <span style={{ color:s.color, fontSize:'11px', fontWeight:700, background:`${s.color}18`, padding:'2px 8px', borderRadius:'6px' }}>{s.duration}</span>
                          </div>
                          <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'10px', margin:'0 0 4px' }}>{s.date}</p>
                          {s.notes && <p style={{ color:'rgba(180,210,255,0.55)', fontSize:'12px', margin:0, lineHeight:1.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}