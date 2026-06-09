import { useState, useEffect } from 'react';
import { Activity, Heart, Moon, Flame, Droplet, Footprints, LogOut, ChevronLeft, ChevronRight, BookOpen, Brain, Smile, User, Calculator } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useUserProfile, getBMICategory } from '../../context/UserProfileContext';
import { UserProfileModal } from './UserProfileModal';
const medicalLogo = '/assets/AIVA.png';

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export function VenusIcon({ size = 17, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="9" r="6" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

const FemaleIcon = (props: { size?: number; color?: string }) => <VenusIcon {...props} />;

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const width = useWindowWidth();
  const isMobile = width < 992;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { profile, notifications } = useUserProfile();
  const bmiCat = profile.bmi ? getBMICategory(profile.bmi) : null;

  // Close sidebar when route changes on mobile
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navItems = [
    { icon: Activity,    label: 'Activity',       path: '/dashboard',     color: '#00e5cc' },
    { icon: Heart,       label: 'Heart',           path: '/heart',         color: '#ef4444' },
    { icon: Moon,        label: 'Sleep',           path: '/sleep',         color: '#8b5cf6' },
    { icon: Flame,       label: 'Calories',        path: '/calories',      color: '#f59e0b' },
    { icon: Droplet,     label: 'Hydration',       path: '/hydration',     color: '#3b82f6' },
    { icon: Footprints,  label: 'Steps',           path: '/steps',         color: '#22c55e' },
    { icon: FemaleIcon,  label: 'Female Health',   path: '/female-health', color: '#f43f5e' },
  ];

  const wellnessItems = [
    { icon: BookOpen, label: 'Journal',      path: '/journal',    color: '#f59e0b' },
    { icon: Brain,    label: 'Meditation',   path: '/meditation', color: '#8b5cf6' },
    { icon: Smile,    label: 'Mood Tracker', path: '/mood',       color: '#22c55e' },
  ];

  const handleLogout = () => navigate('/');

  const NavButton = ({ item, i, delay = 0 }: { item: typeof navItems[0]; i: number; delay?: number }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <button
        onClick={() => navigate(item.path)}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : '12px',
          padding: collapsed ? '13px 0' : '12px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          width: '100%', background: isActive ? `${item.color}12` : 'transparent',
          border: 'none',
          borderLeft: `3px solid ${isActive ? item.color : 'transparent'}`,
          borderRadius: collapsed ? '10px' : '0 10px 10px 0',
          color: isActive ? item.color : 'rgba(180,210,255,0.55)',
          fontWeight: isActive ? 700 : 500, fontSize: '13.5px',
          cursor: 'pointer', transition: 'all 0.2s ease',
          position: 'relative',
          animationDelay: `${(i + delay) * 0.06}s`,
          animation: 'navItemPop 0.35s ease both',
          marginLeft: collapsed ? 0 : undefined,
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
            e.currentTarget.style.transform = 'translateX(3px)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(180,210,255,0.55)';
            e.currentTarget.style.transform = 'translateX(0)';
          }
        }}
      >
        {/* Icon with glow when active */}
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
          background: isActive ? `${item.color}20` : 'transparent',
          transition: 'all 0.2s',
          boxShadow: isActive ? `0 0 10px ${item.color}30` : 'none',
        }}>
          <Icon size={17} color={isActive ? item.color : 'currentColor'} />
        </span>
        {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>}

        {/* Active dot for collapsed */}
        {collapsed && isActive && (
          <span style={{
            position: 'absolute', right: '3px', top: '50%', transform: 'translateY(-50%)',
            width: '4px', height: '20px', background: item.color,
            borderRadius: '2px', boxShadow: `0 0 6px ${item.color}`,
          }} />
        )}
      </button>
    );
  };

  return (
    <>
      <style>{`
        @keyframes sidebarSlide {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes navItemPop {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,204,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(0,229,204,0); }
        }
        .sidebar-wrap { animation: sidebarSlide 0.4s cubic-bezier(.4,0,.2,1) forwards; }
        .collapse-btn:hover { background: rgba(255,255,255,0.12) !important; color: #e0f0ff !important; }
      `}</style>

      {/* Hamburger toggle — only visible on mobile */}
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle sidebar"
      >
        <span style={{ transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
        <span style={{ opacity: mobileOpen ? 0 : 1 }} />
        <span style={{ transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
      </button>

      {/* Dark overlay behind sidebar on mobile */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={`sidebar sidebar-wrap${mobileOpen ? ' open' : ''}`}
        style={{
          display: 'flex', flexDirection: 'column', height: '100vh',
          width: isMobile ? '260px' : collapsed ? '68px' : '252px',
          transition: 'width 0.3s cubic-bezier(.4,0,.2,1), transform 0.3s cubic-bezier(.4,0,.2,1)',
          overflow: 'hidden',
          background: 'rgba(6, 15, 40, 0.88)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(100,180,255,0.1)',
          padding: 0,
        }}
      >
        {/* ── Logo ──────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '20px 0' : '20px 16px',
          borderBottom: '1px solid rgba(100,180,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <img
              src={medicalLogo}
              alt="Logo"
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                border: '2px solid rgba(0,229,204,0.45)',
                objectFit: 'cover', flexShrink: 0,
                animation: 'logoPulse 2.5s ease-in-out infinite',
              }}
            />
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <p style={{
                  margin: 0, fontWeight: 800, fontSize: '16px',
                  background: 'linear-gradient(135deg, #7dd3fc, #38bdf8, #818cf8)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', whiteSpace: 'nowrap',
                }}>Health AI</p>
                <p style={{ margin: 0, fontSize: '10px', color: 'rgba(180,210,255,0.35)', letterSpacing: '0.05em' }}>
                  Health Monitor
                </p>
              </div>
            )}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,180,255,0.15)',
              borderRadius: '8px', padding: '5px 7px', cursor: 'pointer',
              color: 'rgba(180,210,255,0.45)', display: 'flex', alignItems: 'center',
              flexShrink: 0, marginLeft: collapsed ? 0 : '4px', transition: 'all 0.2s',
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* ── Nav ───────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: '12px' }}>

          {/* Health Metrics */}
          {!collapsed && (
            <p style={{
              margin: '0 16px 6px', fontSize: '10px', fontWeight: 700,
              color: 'rgba(180,210,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Health Metrics
            </p>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: collapsed ? '0 8px' : '0 8px 0 0' }}>
            {navItems.map((item, i) => <NavButton key={item.label} item={item} i={i} />)}
          </nav>

          {/* Divider */}
          <div style={{ margin: '12px 16px', height: '1px', background: 'rgba(100,180,255,0.07)' }} />

          {/* Wellness */}
          {!collapsed && (
            <p style={{
              margin: '0 16px 6px', fontSize: '10px', fontWeight: 700,
              color: 'rgba(180,210,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Wellness
            </p>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: collapsed ? '0 8px' : '0 8px 0 0' }}>
            {wellnessItems.map((item, i) => <NavButton key={item.label} item={item} i={i} delay={navItems.length + 1} />)}
          </nav>
        </div>

        {/* ── User + Logout ──────────────────────────── */}
        <div style={{
          padding: collapsed ? '12px 8px' : '12px 12px',
          borderTop: '1px solid rgba(100,180,255,0.08)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>

          {/* BMI mini-card — only when computed and not collapsed */}
          {!collapsed && profile.bmi && (
            <div style={{ padding:'10px 12px', borderRadius:'12px', background:`${bmiCat?.color}10`, border:`1px solid ${bmiCat?.color}30`, cursor:'pointer' }}
              onClick={() => setShowProfile(true)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>BMI</p>
                  <p style={{ color:bmiCat?.color, fontWeight:800, fontSize:'16px', margin:0, lineHeight:1 }}>{profile.bmi} <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'10px', fontWeight:500 }}>{bmiCat?.label}</span></p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'9px', margin:'0 0 2px' }}>Daily goal</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'13px', margin:0 }}>{profile.recommendedCalories} <span style={{ color:'rgba(180,210,255,0.35)', fontSize:'10px' }}>kcal</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Clickable User pill */}
          {!collapsed && (
            <button onClick={() => setShowProfile(true)}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(100,180,255,0.1)', cursor:'pointer', width:'100%', textAlign:'left', transition:'all .2s', position:'relative' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(100,180,255,0.1)'; }}>
              {/* Avatar */}
              <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden', border:'2px solid rgba(99,102,241,0.4)' }}>
                {profile.avatar
                  ? <img src={profile.avatar} alt="Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <User size={16} color="#fff" />}
              </div>
              <div style={{ overflow:'hidden', flex:1 }}>
                <p style={{ margin:0, color:'#e0f0ff', fontWeight:600, fontSize:'13px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile.name}</p>
                <p style={{ margin:0, color:'rgba(180,210,255,0.35)', fontSize:'11px', whiteSpace:'nowrap' }}>
                  {profile.bmiEntered ? `BMI: ${profile.bmi}` : 'Health Member'}
                </p>
              </div>
              {/* Notification dot */}
              {/* {notifications.length > 0 && (
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 8px rgba(239,68,68,0.6)', flexShrink:0 }}>
                  <span style={{ color:'#fff', fontSize:'10px', fontWeight:700 }}>{Math.min(notifications.length, 9)}</span>
                </div>
              )} */}
            </button>
          )}

          {/* Collapsed avatar button */}
          {collapsed && (
            <button onClick={() => setShowProfile(true)}
              style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(99,102,241,0.4)', cursor:'pointer', overflow:'hidden', margin:'0 auto', transition:'all .2s' }}
              title="My Profile">
              {profile.avatar
                ? <img src={profile.avatar} alt="Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <User size={16} color="#fff" />}
            </button>
          )}

          <button
            onClick={handleLogout}
            title={collapsed ? 'Log Out' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '10px',
              width: '100%', padding: collapsed ? '12px 0' : '11px 14px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '12px', color: '#f87171', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
          >
            <LogOut size={16} />
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}