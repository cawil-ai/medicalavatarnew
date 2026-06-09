import { useState, useEffect, useRef } from 'react';
import { account } from '../../lib/appwrite';
import { useUserProfile } from '../../context/UserProfileContext';

const medicalLogo = '/assets/AIVA.png';

interface Notification {
  id: number;
  type: string;
  icon: string;
  title: string;
  msg: string;
  time: string;
  read: boolean;
}

interface HeaderProps {
  userName?: string;
}

const NOTIF_POOL = [
  { type:'water',      icon:'💧', title:'Hydration Reminder',  msg:"Time to drink water! Stay on track with your daily goal."             },
  { type:'steps',      icon:'👟', title:'Step Goal Alert',      msg:"Keep moving! You're making great progress on your step count."        },
  { type:'heart',      icon:'❤️', title:'Heart Health Check',   msg:'Your resting heart rate looks healthy. Keep it up!'                  },
  { type:'sleep',      icon:'🌙', title:'Sleep Reminder',       msg:'Winding down soon? Good sleep is key to your health goals.'          },
  { type:'calories',   icon:'🔥', title:'Calorie Milestone',    msg:"Great job logging your meals today. Keep tracking!"                  },
  { type:'streak',     icon:'⚡', title:'Streak Alert',         msg:"You're on a roll! Don't break your streak today."                   },
  { type:'meditation', icon:'🧘', title:'Meditation Time',      msg:'A quick 5-minute breathing session can reduce stress significantly.' },
  { type:'mood',       icon:'😊', title:'Mood Check-in',        msg:"How are you feeling today? Log your mood to track your wellness."   },
];

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day ago`;
}

let notifCounter = 100;



export function Header({ userName: propUserName }: HeaderProps) {
  const [showNotif, setShowNotif]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userName, setUserName]           = useState(propUserName || 'User');
  const panelRef                          = useRef<HTMLDivElement>(null);

  // Sync name from UserProfileContext (updates instantly on profile save)
  const { profile } = useUserProfile();
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    if (profile.name) {
      setUserName(profile.name);
      return;
    }
    account.get()
      .then(user => setUserName(user.name || user.email || 'User'))
      .catch(() => setUserName(propUserName || 'User'));
  }, [profile.name, propUserName]);

  // Seed initial notifications on mount
  useEffect(() => {
    const initial = NOTIF_POOL.slice(0, 3).map((n, i) => ({
      ...n,
      id:   notifCounter++,
      time: timeAgo(new Date(Date.now() - (i + 1) * 8 * 60 * 1000)),
      read: false,
    }));
    setNotifications(initial);
  }, []);

  // Auto-generate a new notification every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const pick = NOTIF_POOL[Math.floor(Math.random() * NOTIF_POOL.length)];
      setNotifications(prev => [{
        ...pick,
        id:   notifCounter++,
        time: 'just now',
        read: false,
      }, ...prev].slice(0, 10));
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click via document listener — no backdrop div
  // (backdrop div was causing scroll jumps and blocking button clicks)
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showNotif]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Click ✕ on a notification → remove it immediately
  const dismissOne = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // "Mark all read" → clears all notifications, badge goes to 0
  const markAllRead = () => {
    setNotifications([]);
  };

  return (
    <>
      <style>{`
        @keyframes bellRing   { 0%,100%{transform:rotate(0deg);} 20%{transform:rotate(12deg);} 40%{transform:rotate(-12deg);} 60%{transform:rotate(7deg);} 80%{transform:rotate(-7deg);} }
        .notif-panel-anim     { }
        .bell-emoji-ring      { display:inline-block; transform-origin:top center; animation: bellRing 0.7s ease; animation-iteration-count:1; }
        .notif-item           { transition: background 0.15s ease, opacity 0.15s ease; cursor:default; }
        .notif-item:hover     { background: rgba(255,255,255,0.07) !important; }
        .mark-all-btn         { background:none; border:none; color:#00e5cc; font-size:12px; font-weight:700; cursor:pointer; padding:4px 8px; border-radius:6px; transition:background 0.15s; }
        .mark-all-btn:hover   { background:rgba(0,229,204,0.12); }
        .dismiss-btn          { background:none; border:none; color:rgba(180,210,255,0.3); font-size:14px; line-height:1; cursor:pointer; padding:2px 5px; border-radius:4px; transition:color 0.15s, background 0.15s; flex-shrink:0; }
        .dismiss-btn:hover    { color:#ef4444; background:rgba(239,68,68,0.1); }
      `}</style>

      <div className="header">
        <div className="container-fluid px-4">
          <div className="d-flex justify-content-between align-items-center">

            {/* Logo */}
            <div className="d-flex align-items-center gap-2">
              <img src={medicalLogo} alt="Health AI Logo"
                style={{ width:'40px', height:'40px', borderRadius:'50%', border:'2px solid rgba(0,229,204,0.6)', objectFit:'cover', boxShadow:'0 0 12px rgba(0,229,204,0.3)' }}
              />
              <h3 className="logo-text-small mb-0">Health AI</h3>
            </div>

            {/* Right side */}
            <div className="d-flex align-items-center gap-3">

              {/* Notification bell + panel — both inside same ref container */}
              <div ref={panelRef} style={{ position:'relative' }}>
                <button
                  onClick={() => setShowNotif(v => !v)}
                  style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', padding:'7px 10px', cursor:'pointer', fontSize:'18px', position:'relative', transition:'background 0.2s' }}
                >
                  {/* Ring animation on emoji span only — prevents page scroll shifts */}
                  <span className={unreadCount > 0 ? 'bell-emoji-ring' : ''}>🔔</span>
                  {unreadCount > 0 && (
                    <span style={{ position:'absolute', top:'2px', right:'2px', background:'#ef4444', borderRadius:'50%', width:'16px', height:'16px', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', pointerEvents:'none' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotif && (
                  <div
                    className="notif-panel-anim"
                    style={{
position: isMobile ? 'fixed' : 'absolute',
    top: isMobile ? '70px' : 'calc(100% + 10px)',
    right: isMobile ? '10px' : 0,
    left: isMobile ? '10px' : 'auto',
    width: isMobile ? 'auto' : '320px',

    background:'rgba(10,20,40,0.97)',
    backdropFilter:'blur(20px)',
    border:'1px solid rgba(255,255,255,0.12)',
    borderRadius:'16px',
    padding:'16px',
    zIndex:10000,
    boxShadow:'0 20px 60px rgba(0,0,0,0.5)'
}}
                  >
                    {/* Panel header row */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                      <h6 style={{ color:'#fff', fontSize:'14px', fontWeight:600, margin:0 }}>🔔 Health Reminders</h6>
                      {notifications.length > 0 && (
                        <button className="mark-all-btn" onClick={markAllRead}>
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Empty state */}
                    {notifications.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'24px 0', color:'rgba(180,210,255,0.35)', fontSize:'13px' }}>
                        ✅ All caught up!
                      </div>
                    ) : (
                      <>
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            className="notif-item"
                            style={{
                              background: n.read ? 'transparent' : 'rgba(0,229,204,0.06)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              marginBottom: '8px',
                                              opacity: n.read ? 0.45 : 1,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                            }}
                          >
                            <span style={{ fontSize:'20px', flexShrink:0, marginTop:'1px' }}>{n.icon}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ margin:0, fontSize:'13px', fontWeight:600, color: n.read ? 'rgba(255,255,255,0.45)' : '#fff' }}>{n.title}</p>
                              <p style={{ margin:'2px 0 0', fontSize:'11px', color:'rgba(255,255,255,0.4)', lineHeight:'1.4' }}>{n.msg}</p>
                              <p style={{ margin:'4px 0 0', fontSize:'10px', color:'rgba(255,255,255,0.25)' }}>{n.time}</p>
                            </div>
                            {/* Unread dot */}
                            {!n.read && (
                              <div style={{ width:8, height:8, borderRadius:'50%', background:'#00e5cc', flexShrink:0, marginTop:'5px' }} />
                            )}
                            {/* ✕ dismiss button */}
                            <button
                              className="dismiss-btn"
                              onClick={() => dismissOne(n.id)}
                              title="Dismiss"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <p style={{ textAlign:'center', color:'rgba(180,210,255,0.2)', fontSize:'11px', margin:'6px 0 0' }}>
                          Click ✕ to dismiss · "Mark all read" to clear all
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Welcome text */}
              <p className="text-white mb-0" style={{ fontSize:'14px' }}>
                Welcome back, <span style={{ color:'#00e5cc', fontWeight:600 }}>{userName}</span>!
              </p>

              <img
                src="https://img.freepik.com/free-psd/3d-rendering-hair-style-avatar-design_23-2151869153.jpg?semt=ais_rp_progressive&w=740&q=80"
                alt="User Avatar"
                className="user-avatar"
                style={{ transition:'transform 0.2s', cursor:'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function useResponsive(): { isMobile: any; } {
  throw new Error('Function not implemented.');
}
