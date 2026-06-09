import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID, account } from '../../lib/appwrite';
import '../styles/dashboard.css';

const MemoSidebar = memo(Sidebar);

const MOODS = [
  { id: 'happy',     label: 'Happy',     img: '/assets/HappyEmotion.png',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',   glow: 'rgba(251,191,36,0.5)',  desc: 'Feeling joyful and content' },
  { id: 'calm',      label: 'Calm',      img: '/assets/CalmEmotion.png',      color: '#34d399', bg: 'rgba(52,211,153,0.15)',   glow: 'rgba(52,211,153,0.5)',  desc: 'Peaceful and relaxed' },
  { id: 'neutral',   label: 'Neutral',   img: '/assets/NeutralEmotion.png',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)',  glow: 'rgba(148,163,184,0.4)', desc: 'Neither good nor bad' },
  { id: 'energetic', label: 'Energetic', img: '/assets/EnergeticEmotion.png', color: '#f97316', bg: 'rgba(249,115,22,0.15)',   glow: 'rgba(249,115,22,0.5)',  desc: 'Full of energy and motivation' },
  { id: 'tired',     label: 'Tired',     img: '/assets/TiredEmotion.png',     color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',  glow: 'rgba(167,139,250,0.5)', desc: 'Low energy, need rest' },
  { id: 'sad',       label: 'Sad',       img: '/assets/SadEmotion.png',       color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',   glow: 'rgba(96,165,250,0.5)',  desc: 'Feeling down or blue' },
  { id: 'stressed',  label: 'Stressed',  img: '/assets/StressedEmotion.png',  color: '#fb923c', bg: 'rgba(251,146,60,0.15)',   glow: 'rgba(251,146,60,0.5)',  desc: 'Overwhelmed and tense' },
  { id: 'angry',     label: 'Angry',     img: '/assets/AngryEmotion.png',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)',    glow: 'rgba(239,68,68,0.5)',   desc: 'Frustrated and irritated' },
];

const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEK_MOODS = [
  { day:'Mon', mood:'happy' },
  { day:'Tue', mood:'calm' },
  { day:'Wed', mood:'energetic' },
  { day:'Thu', mood:'tired' },
  { day:'Fri', mood:'' },
  { day:'Sat', mood:'' },
  { day:'Sun', mood:'' },
];

interface MoodEntry {
  mood: string;
  note: string;
  time: string;
  words: number;
}

export function MoodTrackerPage() {
  const navigate = useNavigate();
  const [mounted, setMounted]             = useState(false);
  const { isMobile, isTablet }            = useResponsive();
  const [selectedMood, setSelectedMood]   = useState<string | null>(null);
  const [hoveredMood, setHoveredMood]     = useState<string | null>(null);
  const [step, setStep]                   = useState<'select' | 'note' | 'done'>('select');
  const [note, setNote]                   = useState('');
  const [weekMoods, setWeekMoods]         = useState(WEEK_MOODS);
  const [activeTab, setActiveTab]         = useState<'today' | 'history' | 'insights'>('today');
  const [moodKey, setMoodKey]             = useState(0);
  const [saving, setSaving]               = useState(false);
  const [journalEntries, setJournalEntries] = useState<MoodEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    loadMoodHistory();
  }, []);

  const loadMoodHistory = async () => {
    try {
      const user = await account.get();
      const res  = await databases.listDocuments(DATABASE_ID, COLLECTIONS.mood);
      const mine = res.documents.filter(d => d.userID === user.$id);
      const mapped: MoodEntry[] = mine.map(doc => ({
        mood:  doc.mood  || 'neutral',
        note:  doc.note  || '',
        time:  new Date(doc.loggedAt).toLocaleString(),
        words: doc.note ? doc.note.split(' ').length : 0,
      }));
      setJournalEntries(mapped);
    } catch (err) {
      console.error('❌ Load mood error:', err);
    }
  };

  const activeMood  = MOODS.find(m => m.id === (hoveredMood || selectedMood));
  const displayMood = MOODS.find(m => m.id === selectedMood);

  const handleMoodSelect = (id: string) => {
    setSelectedMood(id);
    setMoodKey(k => k + 1);
  };

  const handleSubmit = async () => {
    if (!selectedMood) return;
    setSaving(true);
    try {
      const user  = await account.get();
      const today = new Date().toISOString().split('T')[0];

      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.mood,
        ID.unique(),
        {
          userID:   user.$id,
          mood:     selectedMood,
          note:     note || '',
          date:     today,
          loggedAt: new Date().toISOString(),
        }
      );
      console.log('✅ Mood saved:', doc);

      const updated = [...weekMoods];
      const todayIdx = updated.findIndex(d => d.day === 'Fri');
      if (todayIdx !== -1) updated[todayIdx] = { ...updated[todayIdx], mood: selectedMood };
      setWeekMoods(updated);

      toast.success(`Mood logged: ${MOODS.find(m => m.id === selectedMood)?.label}`);
      setStep('done');
      await loadMoodHistory();
    } catch (err) {
      console.error('❌ Save mood error:', err);
      toast.error('Failed to save mood. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const moodCounts = MOODS.map(m => ({
    ...m,
    count: journalEntries.filter(e => e.mood === m.id).length,
  })).filter(m => m.count > 0).sort((a,b) => b.count - a.count);

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)',
    borderRadius: '20px',
    transition: 'all 0.3s ease',
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(22px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn   { from{opacity:0;} to{opacity:1;} }
        @keyframes ringPulse{ 0%{transform:scale(1);opacity:.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes moodFloat {
          0%,100%{ transform:translateY(0) scale(1); }
          50%    { transform:translateY(-14px) scale(1.04); }
        }
        @keyframes moodPop {
          0%  { transform:scale(1); }
          40% { transform:scale(1.18); }
          70% { transform:scale(0.96); }
          100%{ transform:scale(1); }
        }
        @keyframes slideRight {
          from{ opacity:0; transform:translateX(20px); }
          to  { opacity:1; transform:translateX(0); }
        }
        @keyframes checkPop {
          0%  { transform:scale(0) rotate(-30deg); opacity:0; }
          60% { transform:scale(1.2) rotate(5deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        .mood-btn { background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08); border-radius:18px; cursor:pointer; transition:all 0.25s cubic-bezier(.4,0,.2,1); display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px 10px; position:relative; overflow:hidden; }
        .mood-btn:hover { transform:translateY(-6px) scale(1.05); background:rgba(255,255,255,0.08); }
        .mood-btn.selected { transform:translateY(-4px) scale(1.06); }
        .tab-btn { background:transparent; border:none; cursor:pointer; padding:10px 18px; border-radius:10px; font-weight:600; font-size:13px; transition:all .2s; }
        .journal-item:hover { background:rgba(255,255,255,0.07) !important; border-color:rgba(100,180,255,0.2) !important; transform:translateX(3px); }
        .submit-btn:hover { transform:translateY(-2px) !important; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(167,139,250,0.3); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: 0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 1fr', gap:'22px', minHeight:'calc(100vh - 73px)' }}>

            {/* ── LEFT: Mood Selector ──────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              <div style={{ animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', margin:'0 0 4px' }}>Wellness</p>
                <h1 style={{ color:'#e0f0ff', fontWeight:900, fontSize:'26px', margin:0, letterSpacing:'-0.5px' }}>
                  How Do You Feel <span style={{ background:'linear-gradient(135deg,#a78bfa,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Today?</span>
                </h1>
                <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'13px', margin:'4px 0 0' }}>Select your current mood to track your emotional wellness</p>
              </div>

              {/* Big mood display */}
              <div style={{
                ...card,
                border: activeMood ? `1.5px solid ${activeMood.color}44` : '1px solid rgba(100,180,255,0.12)',
                padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px',
                position:'relative', overflow:'hidden',
                animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none',
                minHeight:'260px', justifyContent:'center',
                boxShadow: activeMood ? `0 0 60px ${activeMood.glow}30, 0 8px 32px rgba(0,0,0,0.4)` : '0 8px 32px rgba(0,0,0,0.3)',
                transition: 'all 0.4s ease',
              }}>
                {activeMood && (
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'300px', height:'300px', borderRadius:'50%', background:`radial-gradient(circle, ${activeMood.glow}18 0%, transparent 70%)`, pointerEvents:'none', transition:'all 0.4s ease' }} />
                )}

                {step === 'done' ? (
                  <div style={{ textAlign:'center', animation:'checkPop 0.5s ease' }}>
                    <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${displayMood?.color},${displayMood?.color}99)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:`0 0 30px ${displayMood?.glow}` }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <p style={{ color:'#e0f0ff', fontWeight:800, fontSize:'20px', margin:'0 0 6px' }}>Mood Logged!</p>
                    <p style={{ color: displayMood?.color, fontWeight:700, fontSize:'24px', margin:'0 0 4px' }}>{displayMood?.label}</p>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:0 }}>{displayMood?.desc}</p>
                    <button onClick={() => { setStep('select'); setSelectedMood(null); setNote(''); }}
                      style={{ marginTop:'20px', padding:'10px 24px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'12px', color:'rgba(180,210,255,0.8)', fontWeight:600, fontSize:'13px', cursor:'pointer', transition:'all .2s' }}>
                      Log Again
                    </button>
                  </div>
                ) : selectedMood && step === 'note' ? (
                  <div style={{ width:'100%', animation:'slideRight 0.3s ease' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
                      <img key={moodKey} src={displayMood?.img} alt={displayMood?.label} style={{ width:56, height:56, objectFit:'contain', filter:`drop-shadow(0 0 12px ${displayMood?.glow})` }} />
                      <div>
                        <p style={{ color: displayMood?.color, fontWeight:800, fontSize:'20px', margin:0 }}>{displayMood?.label}</p>
                        <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'12px', margin:0 }}>{displayMood?.desc}</p>
                      </div>
                    </div>
                    <label style={{ display:'block', color:'rgba(180,210,255,0.7)', fontSize:'12px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'8px' }}>Add a note (optional)</label>
                    <textarea
                      value={note} onChange={e => setNote(e.target.value)}
                      placeholder="What's on your mind? How did your day go..."
                      rows={4}
                      style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:'12px', color:'#e0f0ff', fontSize:'13px', outline:'none', resize:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:1.6, transition:'all .2s' }}
                      onFocus={e => { e.target.style.borderColor = `${displayMood?.color}66`; e.target.style.boxShadow = `0 0 0 3px ${displayMood?.color}18`; }}
                      onBlur={e =>  { e.target.style.borderColor = 'rgba(100,180,255,0.2)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <div style={{ display:'flex', gap:'10px', marginTop:'14px' }}>
                      <button onClick={() => setStep('select')} style={{ padding:'11px 18px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', color:'rgba(180,210,255,0.6)', fontWeight:600, fontSize:'13px', cursor:'pointer', transition:'all .2s' }}>
                        Back
                      </button>
                      <button className="submit-btn" onClick={handleSubmit} disabled={saving}
                        style={{ flex:1, padding:'11px', background: saving ? `${displayMood?.color}66` : `linear-gradient(135deg,${displayMood?.color},${displayMood?.color}99)`, border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:`0 4px 18px ${displayMood?.glow}50`, transition:'all .2s' }}>
                        {saving ? 'Saving...' : 'Save Mood'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeMood ? (
                      <>
                        <img key={`big-${hoveredMood || selectedMood}`} src={activeMood.img} alt={activeMood.label}
                          style={{ width:140, height:140, objectFit:'contain', animation:'moodFloat 3s ease-in-out infinite', filter:`drop-shadow(0 0 32px ${activeMood.glow})` }} />
                        <div style={{ textAlign:'center' }}>
                          <p style={{ color: activeMood.color, fontWeight:900, fontSize:'28px', margin:'0 0 4px', letterSpacing:'-0.5px', textShadow:`0 0 20px ${activeMood.glow}` }}>{activeMood.label}</p>
                          <p style={{ color:'rgba(180,210,255,0.55)', fontSize:'13px', margin:0 }}>{activeMood.desc}</p>
                        </div>
                        {selectedMood && !hoveredMood && (
                          <button onClick={() => setStep('note')}
                            style={{ padding:'12px 32px', background:`linear-gradient(135deg,${activeMood.color},${activeMood.color}99)`, border:'none', borderRadius:'14px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', boxShadow:`0 6px 20px ${activeMood.glow}50`, transition:'all .2s', marginTop:'4px' }}
                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}>
                            Continue
                          </button>
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign:'center', opacity:0.5 }}>
                        <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.05)', border:'2px dashed rgba(180,210,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                          <span style={{ fontSize:'32px' }}>?</span>
                        </div>
                        <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'14px', margin:0 }}>Select a mood below</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mood Grid */}
              {step !== 'done' && step !== 'note' && (
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:'10px', animation: mounted ? 'fadeUp 0.5s ease 0.2s both' : 'none' }}>
                  {MOODS.map((mood) => {
                    const isSelected = selectedMood === mood.id;
                    return (
                      <button key={mood.id} className={`mood-btn${isSelected ? ' selected' : ''}`}
                        style={{ border: isSelected ? `1.5px solid ${mood.color}88` : '1.5px solid rgba(255,255,255,0.08)', background: isSelected ? mood.bg : 'rgba(255,255,255,0.04)', boxShadow: isSelected ? `0 0 20px ${mood.glow}40, 0 4px 16px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)' } as React.CSSProperties}
                        onMouseEnter={() => setHoveredMood(mood.id)}
                        onMouseLeave={() => setHoveredMood(null)}
                        onClick={() => handleMoodSelect(mood.id)}>
                        <img src={mood.img} alt={mood.label} style={{ width:52, height:52, objectFit:'contain', animation: isSelected ? `moodPop 0.4s ease` : 'none', filter: isSelected ? `drop-shadow(0 0 10px ${mood.glow})` : 'none', transition:'filter 0.2s' }} />
                        <span style={{ color: isSelected ? mood.color : 'rgba(180,210,255,0.6)', fontSize:'11px', fontWeight:isSelected ? 700 : 500, letterSpacing:'0.02em' }}>{mood.label}</span>
                        {isSelected && (
                          <div style={{ position:'absolute', top:6, right:6, width:14, height:14, borderRadius:'50%', background:mood.color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 8px ${mood.glow}` }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: Weekly + History ──────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Weekly Mood Calendar */}
              <div style={{ ...card, padding:'22px', animation: mounted ? 'fadeUp 0.5s ease 0.15s both' : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
                  <div>
                    <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>This Week</p>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:0 }}>Mood Calendar</p>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button style={{ width:28, height:28, borderRadius:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(180,210,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={14}/></button>
                    <button style={{ width:28, height:28, borderRadius:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(180,210,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRight size={14}/></button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(4,1fr)' : 'repeat(7,1fr)', gap:'8px' }}>
                  {weekMoods.map((d, i) => {
                    const m = MOODS.find(m => m.id === d.mood);
                    const isToday = d.day === 'Fri';
                    return (
                      <div key={d.day} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', animation: mounted ? `fadeUp 0.4s ease ${0.05*i}s both` : 'none' }}>
                        <span style={{ color: isToday ? '#a78bfa' : 'rgba(180,210,255,0.4)', fontSize:'10px', fontWeight: isToday ? 700 : 500 }}>{d.day}</span>
                        <div style={{ width:44, height:44, borderRadius:'14px', background: m ? m.bg : 'rgba(255,255,255,0.04)', border: isToday ? `2px solid ${m?.color || '#a78bfa'}` : `1px solid ${m ? m.color+'44' : 'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: m ? `0 0 12px ${m.glow}30` : 'none', transition:'all .3s' }}>
                          {m ? (
                            <img src={m.img} alt={m.label} style={{ width:28, height:28, objectFit:'contain', filter:`drop-shadow(0 0 6px ${m.glow})` }} />
                          ) : (
                            <span style={{ color:'rgba(180,210,255,0.2)', fontSize:'16px' }}>—</span>
                          )}
                        </div>
                        {m && <span style={{ color: m.color, fontSize:'9px', fontWeight:600 }}>{m.label}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ ...card, padding:'22px', flex:1, animation: mounted ? 'fadeUp 0.5s ease 0.22s both' : 'none', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'rgba(255,255,255,0.04)', borderRadius:'12px', padding:'4px' }}>
                  {(['today','history','insights'] as const).map(tab => (
                    <button key={tab} className="tab-btn"
                      style={{ flex:1, background: activeTab === tab ? 'rgba(167,139,250,0.2)' : 'transparent', color: activeTab === tab ? '#a78bfa' : 'rgba(180,210,255,0.45)', border: activeTab === tab ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent' }}
                      onClick={() => setActiveTab(tab)}>
                      {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Today tab */}
                {activeTab === 'today' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px', animation:'fadeIn 0.3s ease' }}>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'12px' }}>
                      {[
                        { label:'Current Mood', value: displayMood?.label || '—',                    color: displayMood?.color || '#94a3b8' },
                        { label:'Mood Streak',  value:'4 days',                                      color:'#fbbf24' },
                        { label:'Best Mood',    value:'Happy',                                       color:'#fbbf24' },
                        { label:'Entries',      value:`${journalEntries.length} total`,              color:'#34d399' },
                      ].map(s => (
                        <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(100,180,255,0.08)', borderRadius:'14px', padding:'14px 16px' }}>
                          <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'10px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 4px' }}>{s.label}</p>
                          <p style={{ color:s.color, fontWeight:800, fontSize:'16px', margin:0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'14px', padding:'16px' }}>
                      <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 6px' }}>Mood Insight</p>
                      <p style={{ color:'#e0f0ff', fontSize:'13px', margin:0, lineHeight:1.6 }}>
                        Your mood has been mostly <span style={{ color:'#fbbf24', fontWeight:700 }}>positive</span> this week. Keep maintaining your healthy habits!
                      </p>
                    </div>
                  </div>
                )}

                {/* History tab */}
                {activeTab === 'history' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px', animation:'fadeIn 0.3s ease', overflowY:'auto', maxHeight:'340px' }}>
                    {journalEntries.length === 0 ? (
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'13px', textAlign:'center', marginTop:'20px' }}>No mood entries yet. Log your first mood!</p>
                    ) : journalEntries.map((entry, i) => {
                      const m = MOODS.find(m => m.id === entry.mood) || MOODS[2];
                      return (
                        <div key={i} className="journal-item" style={{ display:'flex', gap:'12px', padding:'14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(100,180,255,0.08)', borderRadius:'14px', transition:'all .2s', cursor:'default' }}>
                          <img src={m.img} alt={m.label} style={{ width:40, height:40, objectFit:'contain', flexShrink:0, filter:`drop-shadow(0 0 8px ${m.glow})` }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                              <span style={{ color:m.color, fontWeight:700, fontSize:'13px' }}>{m.label}</span>
                              <span style={{ color:'rgba(180,210,255,0.35)', fontSize:'11px' }}>{entry.time}</span>
                            </div>
                            <p style={{ color:'rgba(180,210,255,0.65)', fontSize:'12px', margin:0, lineHeight:1.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{entry.note || 'No note added'}</p>
                            <span style={{ color:'rgba(180,210,255,0.3)', fontSize:'10px' }}>{entry.words} words</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Insights tab */}
                {activeTab === 'insights' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px', animation:'fadeIn 0.3s ease' }}>
                    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:'10px' }}>
                      {[
                        { label:'Total Entries', value: String(journalEntries.length),                                                              color:'#a78bfa' },
                        { label:'Total Words',   value: String(journalEntries.reduce((s,e) => s + e.words, 0)),                                     color:'#38bdf8' },
                        { label:'Positive',      value: String(journalEntries.filter(e => ['happy','calm','energetic'].includes(e.mood)).length),   color:'#22c55e' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign:'center', padding:'14px 8px', background:'rgba(255,255,255,0.04)', borderRadius:'12px', border:'1px solid rgba(100,180,255,0.08)' }}>
                          <p style={{ color:s.color, fontWeight:900, fontSize:'22px', margin:'0 0 2px' }}>{s.value}</p>
                          <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'10px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', margin:0 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'4px 0 0' }}>Most Frequent Moods</p>
                    {moodCounts.length === 0 ? (
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'13px' }}>No data yet. Start logging moods!</p>
                    ) : moodCounts.map((m, i) => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <img src={m.img} alt={m.label} style={{ width:32, height:32, objectFit:'contain', filter:`drop-shadow(0 0 6px ${m.glow})` }} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                            <span style={{ color:m.color, fontSize:'12px', fontWeight:600 }}>{m.label}</span>
                            <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px' }}>{m.count} entries</span>
                          </div>
                          <div style={{ height:'4px', borderRadius:'2px', background:'rgba(255,255,255,0.06)' }}>
                            <div style={{ height:'100%', borderRadius:'2px', background:m.color, width:`${(m.count / Math.max(...moodCounts.map(x=>x.count)))*100}%`, boxShadow:`0 0 6px ${m.glow}`, transition:'width 0.8s ease' }} />
                          </div>
                        </div>
                        {i === 0 && (
                          <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 10px rgba(251,191,36,0.6)', flexShrink:0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}