// src/components/UserProfileModal.tsx
import { useState, useRef } from 'react';
import { X, Camera, User, Calculator, Lock, Eye, EyeOff } from 'lucide-react';
import { useUserProfile, getBMICategory } from '../../context/UserProfileContext';
import { toast } from 'sonner';
import { account } from '../../lib/appwrite';

interface Props { onClose: () => void; }

export function UserProfileModal({ onClose }: Props) {
  const { profile, updateProfile, computeBMI } = useUserProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:   profile.name,
    email:  profile.email,
    height: profile.height || '',
    weight: profile.weight || '',
    age:    profile.age    || '',
    gender: profile.gender,
    goal:   profile.goal,
  });

  // Password form state
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [pwLoading, setPwLoading]       = useState(false);
  const [pwError, setPwError]           = useState('');
  const [pwSuccess, setPwSuccess]       = useState(false);

  const [saved, setSaved]   = useState(false);
  const [tab, setTab]       = useState<'profile' | 'bmi' | 'password'>('profile');

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateProfile({ avatar: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateProfile({
      name:   form.name,
      email:  form.email,
      height: Number(form.height),
      weight: Number(form.weight),
      age:    Number(form.age),
      gender: form.gender as 'male' | 'female',
      goal:   form.goal as 'lose' | 'maintain' | 'gain',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // const handleCompute = () => {
  //   updateProfile({
  //     height: Number(form.height),
  //     weight: Number(form.weight),
  //     age:    Number(form.age),
  //     gender: form.gender as 'male' | 'female',
  //     goal:   form.goal as 'lose' | 'maintain' | 'gain',
  //   });
  //   setTimeout(() => {
  //     computeBMI();
  //     toast.success('BMI saved! Your calorie goal has been updated.', {
  //       description: 'Check the sidebar for your daily recommended intake.',
  //       duration: 4000,
  //     });
  //   }, 50);
  // };
  const handleCompute = () => {
  const data = {
    height: Number(form.height),
    weight: Number(form.weight),
    age: Number(form.age),
    gender: form.gender as 'male' | 'female',
    goal: form.goal as 'lose' | 'maintain' | 'gain',
  };

  computeBMI(data); // ✅ DIRECT SAVE

  toast.success('BMI saved! Your calorie goal has been updated.', {
    description: 'Check the sidebar for your daily recommended intake.',
    duration: 4000,
  });
};

  // ── Change Password via Appwrite ──────────────────────────────────
  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);

    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      setPwError('Please fill in all fields.'); return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.'); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match.'); return;
    }
    if (pwForm.currentPassword === pwForm.newPassword) {
      setPwError('New password must be different from your current password.'); return;
    }

    setPwLoading(true);
    try {
      // Appwrite updatePassword requires (newPassword, oldPassword)
      await account.updatePassword(pwForm.newPassword, pwForm.currentPassword);
      setPwSuccess(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully! 🔐', {
        description: 'Your new password will be used next time you log in.',
        duration: 4000,
      });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      // Appwrite error codes
      if (err?.code === 401) {
        setPwError('Current password is incorrect.');
      } else {
        setPwError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  const bmiCat = profile.bmi ? getBMICategory(profile.bmi) : null;

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(100,180,255,0.2)',
    borderRadius: '10px', color: '#e0f0ff',
    fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', transition: 'all .2s',
  };

  const lbl: React.CSSProperties = {
    display: 'block', color: 'rgba(180,210,255,0.7)',
    fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: '6px',
  };

  const GOALS = [
    { value: 'lose',     label: 'Lose Weight',    color: '#38bdf8', sub: 'Caloric deficit' },
    { value: 'maintain', label: 'Maintain Weight', color: '#22c55e', sub: 'Balanced intake' },
    { value: 'gain',     label: 'Gain Weight',     color: '#f97316', sub: 'Caloric surplus' },
  ];

  return (
    <>
      <style>{`
        @keyframes modalUp   { from{opacity:0;transform:translateY(30px) scale(0.97);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes fadeInBg  { from{opacity:0;} to{opacity:1;} }
        @keyframes shake     { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-4px);} 40%,80%{transform:translateX(4px);} }
        .prof-input:focus { border-color:rgba(99,102,241,0.6) !important; background:rgba(255,255,255,0.11) !important; box-shadow:0 0 0 3px rgba(99,102,241,0.12) !important; }
        .pw-input:focus   { border-color:rgba(56,189,248,0.6) !important; background:rgba(255,255,255,0.11) !important; box-shadow:0 0 0 3px rgba(56,189,248,0.12) !important; }
        .prof-tab { transition:all .2s; cursor:pointer; }
        .prof-tab:hover { background:rgba(255,255,255,0.07) !important; }
        .goal-btn:hover { transform:translateY(-2px); }
        .goal-btn { transition:all .2s; cursor:pointer; }
      `}</style>

      {/* Backdrop */}
      <div
        style={{ position:'fixed', inset:0, background:'rgba(0,5,20,0.8)', backdropFilter:'blur(8px)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', animation:'fadeInBg .25s ease' }}
        onClick={onClose}
      >
        <div
          style={{ background:'#0a1628', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'24px', width:'100%', maxWidth:'520px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.7)', animation:'modalUp .35s cubic-bezier(.4,0,.2,1)', position:'relative' }}
          onClick={e => e.stopPropagation()}
        >

          {/* Header */}
          <div style={{ padding:'24px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'18px', margin:0 }}>My Profile</h3>
            <button onClick={onClose}
              style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'rgba(180,210,255,0.6)', display:'flex', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
              <X size={16} />
            </button>
          </div>

          {/* Avatar */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 24px 0', gap:'10px' }}>
            <div style={{ position:'relative', cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
              <div style={{ width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', border:'3px solid rgba(99,102,241,0.5)', boxShadow:'0 0 24px rgba(99,102,241,0.4)' }}>
                {profile.avatar
                  ? <img src={profile.avatar} alt="Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <User size={36} color="#fff" />}
              </div>
              <div style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#0ea5e9)', border:'2px solid #0a1628', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 10px rgba(99,102,241,0.5)' }}>
                <Camera size={13} color="#fff" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />
            <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>Tap photo to change</p>
          </div>

          {/* Tabs — now 3 tabs */}
          <div style={{ display:'flex', gap:'4px', margin:'20px 24px 0', background:'rgba(255,255,255,0.04)', borderRadius:'12px', padding:'4px' }}>
            {(['profile', 'bmi', 'password'] as const).map(t => (
              <button key={t} className="prof-tab" onClick={() => setTab(t)}
                style={{ flex:1, padding:'9px 6px', borderRadius:'9px', border:'none', fontWeight:600, fontSize:'12px', cursor:'pointer', background: tab===t ? 'rgba(99,102,241,0.25)' : 'transparent', color: tab===t ? '#a5b4fc' : 'rgba(180,210,255,0.45)', borderColor: tab===t ? 'rgba(99,102,241,0.4)' : 'transparent', borderStyle:'solid', borderWidth:'1px', whiteSpace:'nowrap' }}>
                {t === 'profile' ? '👤 Profile' : t === 'bmi' ? '📊 BMI' : '🔐 Password'}
              </button>
            ))}
          </div>

          <div style={{ padding:'20px 24px 24px' }}>

            {/* ── PROFILE TAB ── */}
            {tab === 'profile' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={lbl}>Full Name</label>
                    <input className="prof-input" style={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Your name" />
                  </div>
                  <div>
                    <label style={lbl}>Age</label>
                    <input className="prof-input" style={inp} type="number" value={form.age} onChange={e => setForm(f => ({...f, age: e.target.value}))} placeholder="e.g. 25" min={1} max={120} />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Email</label>
                  <input className="prof-input" style={inp} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@email.com" />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={lbl}>Height (cm)</label>
                    <input className="prof-input" style={inp} type="number" value={form.height} onChange={e => setForm(f => ({...f, height: e.target.value}))} placeholder="e.g. 170" />
                  </div>
                  <div>
                    <label style={lbl}>Weight (kg)</label>
                    <input className="prof-input" style={inp} type="number" value={form.weight} onChange={e => setForm(f => ({...f, weight: e.target.value}))} placeholder="e.g. 65" />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Gender</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {(['male','female'] as const).map(g => (
                      <button key={g} onClick={() => setForm(f => ({...f, gender: g}))}
                        style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${form.gender===g ? 'rgba(99,102,241,0.6)' : 'rgba(100,180,255,0.15)'}`, background: form.gender===g ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', color: form.gender===g ? '#a5b4fc' : 'rgba(180,210,255,0.5)', fontWeight:600, fontSize:'13px', cursor:'pointer', transition:'all .2s', textTransform:'capitalize' }}>
                        {g === 'male' ? '♂ Male' : '♀ Female'}
                      </button>
                    ))}
                  </div>
                </div>

                {profile.bmi && (
                  <div style={{ background:`${bmiCat?.color}15`, border:`1px solid ${bmiCat?.color}40`, borderRadius:'12px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 2px' }}>Current BMI</p>
                      <p style={{ color:bmiCat?.color, fontWeight:800, fontSize:'22px', margin:0 }}>{profile.bmi} <span style={{ fontSize:'13px', fontWeight:500, color:'rgba(180,210,255,0.5)' }}>— {bmiCat?.label}</span></p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', margin:'0 0 2px' }}>Recommended</p>
                      <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:0 }}>{profile.recommendedCalories} <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px' }}>kcal/day</span></p>
                    </div>
                  </div>
                )}

                <button onClick={handleSave}
                  style={{ padding:'13px', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#6366f1,#0ea5e9)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', boxShadow:'0 4px 18px rgba(99,102,241,0.3)', transition:'all .3s' }}>
                  {saved ? '✓ Saved!' : 'Save Profile'}
                </button>
              </div>
            )}

            {/* ── BMI TAB ── */}
            {tab === 'bmi' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={lbl}>Height (cm)</label>
                    <input className="prof-input" style={inp} type="number" value={form.height} onChange={e => setForm(f => ({...f, height: e.target.value}))} placeholder="e.g. 170" />
                  </div>
                  <div>
                    <label style={lbl}>Weight (kg)</label>
                    <input className="prof-input" style={inp} type="number" value={form.weight} onChange={e => setForm(f => ({...f, weight: e.target.value}))} placeholder="e.g. 65" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={lbl}>Age</label>
                    <input className="prof-input" style={inp} type="number" value={form.age} onChange={e => setForm(f => ({...f, age: e.target.value}))} placeholder="e.g. 25" />
                  </div>
                  <div>
                    <label style={lbl}>Gender</label>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {(['male','female'] as const).map(g => (
                        <button key={g} onClick={() => setForm(f => ({...f, gender: g}))}
                          style={{ flex:1, padding:'10px 6px', borderRadius:'10px', border:`1px solid ${form.gender===g ? 'rgba(99,102,241,0.6)' : 'rgba(100,180,255,0.15)'}`, background: form.gender===g ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', color: form.gender===g ? '#a5b4fc' : 'rgba(180,210,255,0.5)', fontWeight:600, fontSize:'12px', cursor:'pointer', transition:'all .2s' }}>
                          {g === 'male' ? '♂' : '♀'} {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Goal</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {GOALS.map(g => (
                      <button key={g.value} className="goal-btn" onClick={() => setForm(f => ({...f, goal: g.value as any}))}
                        style={{ padding:'12px 16px', borderRadius:'12px', border:`1.5px solid ${form.goal===g.value ? g.color+'88' : 'rgba(100,180,255,0.12)'}`, background: form.goal===g.value ? `${g.color}18` : 'rgba(255,255,255,0.03)', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow: form.goal===g.value ? `0 0 16px ${g.color}30` : 'none' }}>
                        <div style={{ textAlign:'left' }}>
                          <p style={{ color: form.goal===g.value ? g.color : 'rgba(180,210,255,0.7)', fontWeight:700, fontSize:'13px', margin:0 }}>{g.label}</p>
                          <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'11px', margin:0 }}>{g.sub}</p>
                        </div>
                        {form.goal===g.value && (
                          <div style={{ width:18, height:18, borderRadius:'50%', background:g.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleCompute} disabled={!form.height || !form.weight || !form.age}
                  style={{ padding:'13px', background:'linear-gradient(135deg,#6366f1,#0ea5e9)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', boxShadow:'0 4px 18px rgba(99,102,241,0.3)', transition:'all .2s', opacity: (!form.height || !form.weight || !form.age) ? 0.5 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Calculator size={16} /> Calculate BMI
                </button>
                {profile.bmi && (
                  <div style={{ background:'rgba(8,20,50,0.8)', border:'1px solid rgba(100,180,255,0.15)', borderRadius:'16px', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div style={{ textAlign:'center' }}>
                      <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 8px' }}>Your BMI</p>
                      <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="140" height="80" viewBox="0 0 140 80">
                          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
                          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke={bmiCat?.color} strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${Math.min(((profile.bmi - 10) / 30) * 188, 188)} 188`}
                            style={{ transition:'stroke-dasharray 1s ease', filter:`drop-shadow(0 0 6px ${bmiCat?.color})` }} />
                        </svg>
                        <div style={{ position:'absolute', bottom:0, textAlign:'center' }}>
                          <p style={{ color:bmiCat?.color, fontWeight:900, fontSize:'28px', margin:0, lineHeight:1, textShadow:`0 0 16px ${bmiCat?.color}` }}>{profile.bmi}</p>
                          <p style={{ color:bmiCat?.color, fontWeight:700, fontSize:'12px', margin:'2px 0 0' }}>{bmiCat?.label}</p>
                        </div>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'0 10px', marginTop:'6px' }}>
                        {[{l:'Under',c:'#38bdf8'},{l:'Normal',c:'#22c55e'},{l:'Over',c:'#f59e0b'},{l:'Obese',c:'#ef4444'}].map(s => (
                          <span key={s.l} style={{ color:s.c, fontSize:'9px', fontWeight:600 }}>{s.l}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:'12px', padding:'14px' }}>
                      <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 4px' }}>Recommended Daily Calories</p>
                      <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
                        <span style={{ color:'#a5b4fc', fontWeight:900, fontSize:'32px', lineHeight:1 }}>{profile.recommendedCalories}</span>
                        <span style={{ color:'rgba(180,210,255,0.5)', fontSize:'14px' }}>kcal / day</span>
                      </div>
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'6px 0 0' }}>
                        Based on your BMR of {profile.bmr} kcal · Goal: {form.goal === 'lose' ? 'Weight Loss (−500 kcal)' : form.goal === 'gain' ? 'Weight Gain (+500 kcal)' : 'Maintenance'}
                      </p>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      {[
                        { range:'< 18.5',    label:'Underweight', color:'#38bdf8' },
                        { range:'18.5–24.9', label:'Normal',      color:'#22c55e' },
                        { range:'25–29.9',   label:'Overweight',  color:'#f59e0b' },
                        { range:'≥ 30',      label:'Obese',       color:'#ef4444' },
                      ].map(r => (
                        <div key={r.label} style={{ padding:'8px 10px', background:`${r.color}10`, border:`1px solid ${r.color}30`, borderRadius:'8px' }}>
                          <p style={{ color:r.color, fontWeight:700, fontSize:'11px', margin:0 }}>{r.range}</p>
                          <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'10px', margin:0 }}>{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PASSWORD TAB ── */}
            {tab === 'password' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Info box */}
                <div style={{ background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:'12px', padding:'12px 16px', display:'flex', gap:'10px', alignItems:'flex-start' }}>
                  <Lock size={16} color="#38bdf8" style={{ flexShrink:0, marginTop:2 }} />
                  <div>
                    <p style={{ color:'#38bdf8', fontWeight:700, fontSize:'13px', margin:'0 0 2px' }}>Change your password</p>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'12px', margin:0 }}>Your new password will be required the next time you log in.</p>
                  </div>
                </div>

                {/* Error */}
                {pwError && (
                  <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', padding:'10px 14px', color:'#fca5a5', fontSize:'13px', animation:'shake 0.4s ease' }}>
                    ⚠ {pwError}
                  </div>
                )}

                {/* Success */}
                {pwSuccess && (
                  <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'10px', padding:'10px 14px', color:'#86efac', fontSize:'13px' }}>
                    ✓ Password updated successfully!
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label style={lbl}>Current Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="pw-input"
                      style={{ ...inp, paddingRight:'44px' }}
                      type={showCurrent ? 'text' : 'password'}
                      value={pwForm.currentPassword}
                      onChange={e => setPwForm(f => ({...f, currentPassword: e.target.value}))}
                      placeholder="Enter current password"
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(180,210,255,0.4)', display:'flex', alignItems:'center' }}>
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label style={lbl}>New Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="pw-input"
                      style={{ ...inp, paddingRight:'44px' }}
                      type={showNew ? 'text' : 'password'}
                      value={pwForm.newPassword}
                      onChange={e => setPwForm(f => ({...f, newPassword: e.target.value}))}
                      placeholder="Min. 8 characters"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(180,210,255,0.4)', display:'flex', alignItems:'center' }}>
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Password strength hint */}
                  {pwForm.newPassword && (
                    <div style={{ marginTop:'6px', display:'flex', gap:'4px' }}>
                      {[1,2,3,4].map(i => {
                        const len = pwForm.newPassword.length;
                        const hasUpper = /[A-Z]/.test(pwForm.newPassword);
                        const hasNum   = /[0-9]/.test(pwForm.newPassword);
                        const hasSpec  = /[^A-Za-z0-9]/.test(pwForm.newPassword);
                        const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
                        const color = score <= 1 ? '#ef4444' : score === 2 ? '#f59e0b' : score === 3 ? '#38bdf8' : '#22c55e';
                        return <div key={i} style={{ flex:1, height:'3px', borderRadius:'2px', background: i <= score ? color : 'rgba(255,255,255,0.1)', transition:'all 0.3s' }} />;
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <div>
                  <label style={lbl}>Confirm New Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="pw-input"
                      style={{ ...inp, paddingRight:'44px', borderColor: pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'rgba(239,68,68,0.5)' : inp.border as string }}
                      type={showConfirm ? 'text' : 'password'}
                      value={pwForm.confirmPassword}
                      onChange={e => setPwForm(f => ({...f, confirmPassword: e.target.value}))}
                      placeholder="Repeat new password"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(180,210,255,0.4)', display:'flex', alignItems:'center' }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                    <p style={{ color:'#f87171', fontSize:'11px', margin:'4px 0 0' }}>Passwords don't match</p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  onClick={handleChangePassword}
                  disabled={pwLoading}
                  style={{ padding:'13px', background: pwLoading ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg,#38bdf8,#6366f1)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: pwLoading ? 'not-allowed' : 'pointer', boxShadow:'0 4px 18px rgba(56,189,248,0.25)', transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'4px' }}>
                  <Lock size={15} />
                  {pwLoading ? 'Updating password...' : 'Update Password'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}