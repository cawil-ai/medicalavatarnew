import { useState, useEffect, memo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { BookOpen, Plus, X, Trash2, TrendingUp, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID } from '../../lib/appwrite';
import { account } from '../../lib/appwrite';

/* ── Assets ─────────────────────────────────────────────────────── */
const notebookImg = '/assets/notebook.png';

/* ── Emotion PNGs ─────────────────────────────────────────────── */
const EMOTION_IMGS: Record<string, string> = {
  '😄': '/assets/HappyEmotion.png',
  '😊': '/assets/CalmEmotion.png',
  '😌': '/assets/CalmEmotion.png',
  '😐': '/assets/NeutralEmotion.png',
  '😔': '/assets/SadEmotion.png',
  '😰': '/assets/StressedEmotion.png',
  '😴': '/assets/TiredEmotion.png',
  '💪': '/assets/EnergeticEmotion.png',
  '😠': '/assets/AngryEmotion.png',
};

const EMOTION_COLORS: Record<string, string> = {
  '😄': '#fbbf24', '😊': '#34d399', '😌': '#34d399',
  '😐': '#94a3b8', '😔': '#60a5fa', '😰': '#fb923c',
  '😴': '#a78bfa', '💪': '#f97316', '😠': '#ef4444',
};

const MOOD_LABELS: Record<string, string> = {
  '😄':'Great', '😊':'Happy', '😌':'Calm', '😐':'Neutral',
  '😔':'Sad', '😰':'Stressed', '😴':'Tired', '💪':'Energetic', '😠':'Angry',
};

const MOOD_OPTIONS = ['😄','😊','😌','😐','😔','😰','😴','💪','😠'];
const TAG_OPTIONS  = ['sleep','energy','nutrition','stress','walk','hydration','recovery','cardio','meditation','rest','heart rate','run','milestone'];

interface JournalEntry {
  id: string;
  date: string;
  text: string;
  mood: string;
  tags: string[];
}

const MemoSidebar = memo(Sidebar);

export function JournalPage() {
  const [entries, setEntries]           = useState<JournalEntry[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [text, setText]                 = useState('');
  const [mood, setMood]                 = useState('😊');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterMood, setFilterMood]     = useState('all');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [mounted, setMounted]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);
  const [userId, setUserId]             = useState<string>('');
  const { isMobile, isTablet }          = useResponsive();
  const [notebookBounce, setNotebookBounce] = useState(false);

  /* ── Get current user & load entries on mount ─────────────────── */
  useEffect(() => {
    setMounted(true);
    setTimeout(() => setNotebookBounce(true), 400);

    const init = async () => {
      try {
        const user = await account.get();
        setUserId(user.$id);
        await loadEntries(user.$id);
      } catch (err) {
        console.error('Failed to get user:', err);
        toast.error('Please log in again.');
      }
    };
    init();
  }, []);

  /* ── Load entries from Appwrite ───────────────────────────────── */
  const loadEntries = async (uid: string) => {
    setLoading(true);
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.journal,
      );
      const mapped: JournalEntry[] = res.documents.map(doc => ({
        id:   doc.$id,
        date: new Date(doc.loggedAt).toLocaleString(),
        text: doc.content  || '',
        mood: doc.mood     || '😊',
        tags: doc.date     ? [doc.date] : [], // storing tags in date field as comma-separated
      }));
      setEntries(mapped);
    } catch (err) {
      console.error('❌ Load error:', err);
      toast.error('Failed to load journal entries.');
    } finally {
      setLoading(false);
    }
  };

  const now = () => {
    const d = new Date(); const h = d.getHours();
    return `Today, ${h}:${String(d.getMinutes()).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
  };

  const addEntry = async () => {
  if (!text.trim()) return;
  setSaving(true);
  try {
    const user = await account.get();

    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.journal,
      ID.unique(),
      {
        userID:   user.$id,
        title:    mood,
        content:  text,
        mood:     mood,
        date:     selectedTags.join(', '),
        loggedAt: new Date().toISOString(),
      }
    );
    const newEntry: JournalEntry = {
      id:   doc.$id,
      date: now(),
      text,
      mood,
      tags: selectedTags,
    };
    setEntries(p => [newEntry, ...p]);
    toast.success('Journal entry saved!');
    setText(''); setMood('😊'); setSelectedTags([]); setShowForm(false);
  } catch (err) {
    console.error('❌ Save error:', err);
    toast.error('Failed to save entry. Check console for details.');
  } finally {
    setSaving(false);
  }
};

  /* ── Delete entry from Appwrite ───────────────────────────────── */
  const deleteEntry = async (id: string) => {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.journal, id);
      setEntries(p => p.filter(e => e.id !== id));
      toast.success('Entry deleted');
    } catch (err) {
      console.error('❌ Delete error:', err);
      toast.error('Failed to delete entry.');
    }
  };

  const toggleTag = (tag: string) =>
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);

  const filtered = filterMood === 'all' ? entries : entries.filter(e => e.mood === filterMood);

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
        @keyframes notebookBounce {
          0%  { transform:scale(0.7) rotate(-8deg) translateY(20px); opacity:0; }
          60% { transform:scale(1.08) rotate(3deg) translateY(-6px); opacity:1; }
          80% { transform:scale(0.97) rotate(-1deg); }
          100%{ transform:scale(1) rotate(0deg) translateY(0); opacity:1; }
        }
        @keyframes notebookFloat {
          0%,100%{ transform:translateY(0) rotate(-2deg); filter:drop-shadow(0 12px 28px rgba(236,72,153,0.4)); }
          50%    { transform:translateY(-10px) rotate(2deg); filter:drop-shadow(0 20px 40px rgba(236,72,153,0.6)); }
        }
        @keyframes entrySlide {
          from{ opacity:0; transform:translateX(-14px); }
          to  { opacity:1; transform:translateX(0); }
        }
        @keyframes tagPulse {
          0%,100%{ transform:scale(1); } 50%{ transform:scale(1.08); }
        }
        @keyframes shimmer {
          0%  { transform:translateX(-100%); }
          100%{ transform:translateX(200%); }
        }
        .entry-card { transition: all 0.25s ease; }
        .entry-card:hover { transform:translateY(-3px) !important; box-shadow:0 12px 40px rgba(245,158,11,0.15) !important; }
        .del-btn  { opacity:0; transition:opacity 0.2s; }
        .entry-card:hover .del-btn { opacity:1; }
        .tag-chip { transition:all 0.15s ease; cursor:pointer; }
        .tag-chip:hover { transform:translateY(-1px); }
        .filter-btn:hover { background:rgba(245,158,11,0.15) !important; color:rgba(245,158,11,0.9) !important; }
        .new-btn:hover { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(245,158,11,0.4) !important; }
        .jrnl-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(245,158,11,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .jrnl-input:focus { border-color:rgba(245,158,11,0.6); background:rgba(255,255,255,0.1); box-shadow:0 0 0 3px rgba(245,158,11,0.1); }
        .jrnl-input::placeholder { color:rgba(180,210,255,0.35); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(245,158,11,0.25); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding:0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '320px 1fr', gap:'22px', minHeight:'calc(100vh - 73px)' }}>

            {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Notebook Hero Card */}
              <div style={{
                ...card,
                border:'1px solid rgba(236,72,153,0.25)',
                padding:'28px 20px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:'14px',
                position:'relative', overflow:'hidden',
                boxShadow:'0 8px 40px rgba(236,72,153,0.12)',
                animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none',
              }}>
                <div style={{ position:'absolute', bottom:'-30px', left:'50%', transform:'translateX(-50%)', width:'200px', height:'120px', background:'rgba(236,72,153,0.08)', filter:'blur(40px)', borderRadius:'50%', pointerEvents:'none' }} />
                <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:'20px', pointerEvents:'none' }}>
                  <div style={{ position:'absolute', top:0, left:0, width:'60%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)', animation:'shimmer 4s ease infinite' }} />
                </div>

                <img
                  src={notebookImg} alt="Journal"
                  style={{
                    width:160, height:160, objectFit:'contain',
                    animation: notebookBounce
                      ? 'notebookBounce 0.7s cubic-bezier(.4,0,.2,1) forwards, notebookFloat 4s ease-in-out 0.8s infinite'
                      : 'none',
                    filter:'drop-shadow(0 12px 28px rgba(236,72,153,0.5))',
                  }}
                />
                <div style={{ textAlign:'center' }}>
                  <h2 style={{ color:'#fce7f3', fontWeight:800, fontSize:'18px', margin:'0 0 5px', letterSpacing:'-0.3px' }}>Health Journal</h2>
                  <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'12px', margin:0 }}>Your daily health reflections</p>
                </div>

                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:'8px', width:'100%' }}>
                  {[
                    { icon: BookOpen, val: entries.length, label:'Entries', color:'#f472b6' },
                    { icon: Star,     val: entries.reduce((s,e) => s + e.text.split(' ').length, 0), label:'Words', color:'#38bdf8' },
                    { icon: Star,     val: 6,              label:'Streak',  color:'#fbbf24' },
                  ].map(s => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} style={{ textAlign:'center', padding:'10px 6px', background:'rgba(255,255,255,0.04)', borderRadius:'12px', border:'1px solid rgba(100,180,255,0.08)' }}>
                        <Icon size={14} color={s.color} style={{ marginBottom:'4px' }} />
                        <p style={{ color:s.color, fontWeight:800, fontSize:'16px', margin:0 }}>{s.val}</p>
                        <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'9px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', margin:0 }}>{s.label}</p>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="new-btn"
                  onClick={() => setShowForm(!showForm)}
                  style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg,#ec4899,#f59e0b)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', boxShadow:'0 4px 18px rgba(236,72,153,0.35)', transition:'all .2s ease', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Plus size={16} /> New Entry
                </button>
              </div>

              {/* Mood Filter */}
              <div style={{ ...card, padding:'18px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>Filter by Mood</p>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  <button className="filter-btn" onClick={() => setFilterMood('all')}
                    style={{ padding:'5px 14px', borderRadius:'20px', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all .2s', background: filterMood==='all' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${filterMood==='all' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, color: filterMood==='all' ? '#fbbf24' : 'rgba(180,210,255,0.45)' }}>
                    All
                  </button>
                  {MOOD_OPTIONS.map(e => (
                    <button key={e} onClick={() => setFilterMood(filterMood===e ? 'all' : e)}
                      style={{ padding:'4px 8px', borderRadius:'20px', fontSize:'18px', cursor:'pointer', background: filterMood===e ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${filterMood===e ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`, transition:'all .15s', transform: filterMood===e ? 'scale(1.15)' : 'scale(1)' }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Entries ────────────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Header row */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ position:'relative', width:52, height:52 }}>
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(245,158,11,0.15)', animation:'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position:'absolute', inset:'8px', borderRadius:'50%', background:'rgba(245,158,11,0.2)', animation:'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <BookOpen size={22} color="#f59e0b" />
                    </div>
                  </div>
                  <div>
                    <h1 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'22px', margin:0, letterSpacing:'-0.3px' }}>My Entries</h1>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:'2px 0 0' }}>{filtered.length} {filterMood !== 'all' ? MOOD_LABELS[filterMood]+' ' : ''}entries</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <TrendingUp size={14} color="rgba(180,210,255,0.4)" />
                  <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px' }}>6-day writing streak</span>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {Array.from({length:7}).map((_,i) => (
                      <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i < 6 ? '#fbbf24' : 'rgba(255,255,255,0.1)', boxShadow: i < 6 ? '0 0 5px rgba(251,191,36,0.5)' : 'none' }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* New Entry Form */}
              {showForm && (
                <div style={{ ...card, border:'1px solid rgba(245,158,11,0.3)', padding:'24px', animation:'fadeUp 0.25s ease' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
                    <img src={notebookImg} alt="Journal" style={{ width:40, height:40, objectFit:'contain', filter:'drop-shadow(0 0 8px rgba(236,72,153,0.5))' }} />
                    <div>
                      <h4 style={{ color:'#fce7f3', fontWeight:800, fontSize:'16px', margin:0 }}>New Journal Entry</h4>
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>How are you feeling today?</p>
                    </div>
                  </div>

                  <p style={{ color:'rgba(180,210,255,0.6)', fontSize:'11px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 10px' }}>Select Mood</p>
                  <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
                    {MOOD_OPTIONS.map(e => {
                      const isSelected = mood === e;
                      const col = EMOTION_COLORS[e] || '#f59e0b';
                      return (
                        <button key={e} onClick={() => setMood(e)}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', padding:'8px', borderRadius:'12px', cursor:'pointer', transition:'all .2s', background: isSelected ? `${col}20` : 'rgba(255,255,255,0.04)', border:`1.5px solid ${isSelected ? col : 'rgba(255,255,255,0.08)'}`, transform: isSelected ? 'scale(1.1)' : 'scale(1)', boxShadow: isSelected ? `0 0 14px ${col}40` : 'none' }}>
                          <img src={EMOTION_IMGS[e]} alt={e} style={{ width:36, height:36, objectFit:'contain', filter: isSelected ? `drop-shadow(0 0 8px ${col})` : 'none' }} />
                          <span style={{ color: isSelected ? col : 'rgba(180,210,255,0.45)', fontSize:'9px', fontWeight:600 }}>{MOOD_LABELS[e]}</span>
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    className="jrnl-input"
                    placeholder="Write about your health today — how you feel, what you did, what you're proud of..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={4}
                    style={{ marginBottom:'14px', resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
                  />

                  <p style={{ color:'rgba(180,210,255,0.6)', fontSize:'11px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 8px' }}>Tags</p>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'18px' }}>
                    {TAG_OPTIONS.map(t => (
                      <span key={t} className="tag-chip" onClick={() => toggleTag(t)}
                        style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:600, background: selectedTags.includes(t) ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${selectedTags.includes(t) ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, color: selectedTags.includes(t) ? '#fbbf24' : 'rgba(180,210,255,0.45)', animation: selectedTags.includes(t) ? 'tagPulse 0.3s ease' : 'none' }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={addEntry} disabled={saving}
                      style={{ flex:1, padding:'12px', background: saving ? 'rgba(236,72,153,0.4)' : 'linear-gradient(135deg,#ec4899,#f59e0b)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:'0 4px 18px rgba(236,72,153,0.3)', transition:'all .2s' }}
                      onMouseEnter={e => { if(!saving){ e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                      onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
                      {saving ? 'Saving...' : 'Save Entry'}
                    </button>
                    <button onClick={() => setShowForm(false)}
                      style={{ padding:'12px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:'12px', color:'rgba(180,210,255,0.7)', cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div style={{ ...card, padding:'48px', textAlign:'center' }}>
                  <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'14px', margin:0 }}>Loading entries...</p>
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <div style={{ ...card, padding:'48px', textAlign:'center', animation:'fadeUp 0.4s ease' }}>
                  <img src={notebookImg} alt="Empty" style={{ width:80, height:80, objectFit:'contain', opacity:0.4, marginBottom:'12px' }} />
                  <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'14px', margin:0 }}>No entries yet. Click <strong style={{ color:'#f59e0b' }}>New Entry</strong> to get started!</p>
                </div>
              )}

              {/* Entry Cards */}
              {!loading && (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {filtered.map((entry, i) => {
                    const emotionImg = EMOTION_IMGS[entry.mood];
                    const col        = EMOTION_COLORS[entry.mood] || '#f59e0b';
                    const isExpanded = expandedId === entry.id;

                    return (
                      <div key={entry.id} className="entry-card"
                        style={{ ...card, border:`1px solid ${col}22`, padding:'20px', animationDelay:`${i*0.05}s`, animation: mounted ? `entrySlide 0.4s ease ${i*0.05}s both` : 'none', position:'relative', overflow:'hidden', boxShadow:`0 4px 20px rgba(0,0,0,0.25)` }}>

                        <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'100px', height:'100px', borderRadius:'50%', background:`${col}10`, filter:'blur(30px)', pointerEvents:'none' }} />

                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                            <div style={{ width:52, height:52, borderRadius:'14px', background:`${col}15`, border:`1px solid ${col}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 0 12px ${col}25` }}>
                              <img src={emotionImg} alt={entry.mood} style={{ width:38, height:38, objectFit:'contain', filter:`drop-shadow(0 0 8px ${col}70)` }} />
                            </div>
                            <div>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ color:col, fontWeight:700, fontSize:'14px' }}>{MOOD_LABELS[entry.mood]}</span>
                                <span style={{ color:'rgba(180,210,255,0.25)', fontSize:'12px' }}>·</span>
                                <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px' }}>{entry.date}</span>
                              </div>
                              {entry.tags.length > 0 && (
                                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'5px' }}>
                                  {entry.tags.map(t => (
                                    <span key={t} style={{ padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:600, background:`${col}15`, border:`1px solid ${col}30`, color:`${col}cc` }}>{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <button className="del-btn" onClick={() => deleteEntry(entry.id)}
                            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'8px', padding:'6px', cursor:'pointer', display:'flex', alignItems:'center', color:'#ef4444', flexShrink:0 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <p onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          style={{ margin:'0 0 10px', color:'rgba(220,235,255,0.8)', fontSize:'14px', lineHeight:1.65, cursor:'pointer', userSelect:'none' }}>
                          {isExpanded ? entry.text : entry.text.length > 150 ? entry.text.slice(0,150)+'…' : entry.text}
                          {entry.text.length > 150 && (
                            <span style={{ color:col, fontSize:'12px', fontWeight:600, marginLeft:'6px' }}>
                              {isExpanded ? 'Show less' : 'Read more'}
                            </span>
                          )}
                        </p>

                        <span style={{ color:'rgba(180,210,255,0.25)', fontSize:'11px' }}>{entry.text.split(' ').length} words</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}