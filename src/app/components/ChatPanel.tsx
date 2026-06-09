import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Types ──────────────────────────────────────────────────────── */
interface Message {
  id: number;
  from: 'ai' | 'user';
  text: string;
  ts: string;
}

interface ChatPanelProps {
  title?: string;
  avatar?: string;
  responses?: Record<string, string>;
  autoMessages?: { text: string; delay: number }[];
  defaultResponse?: string;
  moduleKey?: string; // unique key per module — drives isolated history
}

/* ── Per-module config ──────────────────────────────────────────── */
const MODULE_CONFIG: Record<string, {
  accent: string;
  glow: string;
  label: string;
  badge: string;
  intro: string;
}> = {
  heart: {
    accent: '#ef4444',
    glow: 'rgba(239,68,68,0.35)',
    label: 'CARDIAC AI',
    badge: '❤️',
    intro: 'Hello! I\'m your Cardiac AI. Ask me about your heart rate, HRV, blood pressure, or SpO₂.',
  },
  steps: {
    accent: '#22c55e',
    glow: 'rgba(34,197,94,0.35)',
    label: 'STEPS AI',
    badge: '👟',
    intro: 'Hey there! I\'m your Steps AI. Ask me about your daily steps, distance, or active minutes.',
  },
  hydration: {
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.35)',
    label: 'HYDRATION AI',
    badge: '💧',
    intro: 'Hi! I\'m your Hydration AI. Ask me about your water intake, hydration goals, or reminders.',
  },
  sleep: {
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.35)',
    label: 'SLEEP AI',
    badge: '🌙',
    intro: 'Good to see you! I\'m your Sleep AI. Ask me about sleep cycles, quality scores, or tips.',
  },
  calories: {
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.35)',
    label: 'NUTRITION AI',
    badge: '🔥',
    intro: 'Hello! I\'m your Nutrition AI. Ask me about your calorie intake, macros, or meal suggestions.',
  },
  dashboard: {
    accent: '#60a5fa',
    glow: 'rgba(96,165,250,0.35)',
    label: 'HEALTH AI',
    badge: '🏥',
    intro: 'Hi! I\'m your Health AI. Ask me about any of your health metrics — steps, sleep, heart rate, and more.',
  },
  female: {
    accent: '#f43f5e',
    glow: 'rgba(244,63,94,0.35)',
    label: 'FEMALE HEALTH AI',
    badge: '♀',
    intro: 'Hello! I\'m your Female Health AI. Ask me about your cycle, period symptoms, pregnancy milestones, ovulation, nutrition, or hormonal health. Try: "Is my period late?", "What phase am I in?", or "How much iron do I need?"',
  },
};

/* ── Avatar map: moduleKey → image path ──────────────────────────── */
const AVATAR_MAP: Record<string, string> = {
  heart:      '/assets/heartavatarpng.png',
  steps:      '/assets/stepsavatarpng.png',
  hydration:  '/assets/hydrationavatarpng.png',
  sleep:      '/assets/sleepavatarpng.png',
  calories:   '/assets/caloriesavatarpng.png',
  dashboard:  '/assets/AIVA.png',
  female:     '/assets/femaleavatarpng.png',
};

/* ── Timestamp helper ───────────────────────────────────────────── */
const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ── Isolated history store (survives re-renders, resets per module) */
const historyStore: Record<string, Message[]> = {};

let globalId = 1;

/* ══════════════════════════════════════════════════════════════════
   ChatPanel Component
══════════════════════════════════════════════════════════════════ */
export function ChatPanel({
  title,
  avatar,
  responses = {},
  autoMessages = [],
  defaultResponse = "I'm here to help with your health data. Ask me anything!",
  moduleKey = 'dashboard',
}: ChatPanelProps) {
  const cfg    = MODULE_CONFIG[moduleKey] ?? MODULE_CONFIG.dashboard;
  const avatarSrc = AVATAR_MAP[moduleKey] ?? avatar ?? '/assets/AIVA.png';

  /* ── Initialise isolated history ─────────────────────────────── */
  if (!historyStore[moduleKey]) {
    historyStore[moduleKey] = [
      { id: globalId++, from: 'ai', text: cfg.intro, ts: now() },
    ];
  }

  const [messages, setMessages] = useState<Message[]>(() => historyStore[moduleKey]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const [isOpen, setIsOpen]     = useState(true);
  const [shake, setShake]       = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const messagesContainerRef    = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  const autoFiredRef            = useRef(false);

  /* ── Sync history on module switch ──────────────────────────── */
  useEffect(() => {
    if (!historyStore[moduleKey]) {
      historyStore[moduleKey] = [
        { id: globalId++, from: 'ai', text: cfg.intro, ts: now() },
      ];
    }
    setMessages([...historyStore[moduleKey]]);
    autoFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  /* ── Persist to store whenever messages change ───────────────── */
  useEffect(() => {
    historyStore[moduleKey] = messages;
  }, [messages, moduleKey]);

  /* ── Auto-scroll: scroll only the messages container, never the page */
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  /* ── Auto-messages (fire once per module mount) ──────────────── */
  useEffect(() => {
    if (autoFiredRef.current || autoMessages.length === 0) return;
    autoFiredRef.current = true;
    autoMessages.forEach(({ text, delay }) => {
      setTimeout(() => {
        const msg: Message = { id: globalId++, from: 'ai', text, ts: now() };
        setMessages(prev => {
          const next = [...prev, msg];
          historyStore[moduleKey] = next;
          return next;
        });
      }, delay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  /* ── Send message ────────────────────────────────────────────── */
  const send = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const userMsg: Message = { id: globalId++, from: 'user', text: trimmed, ts: now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      historyStore[moduleKey] = next;
      return next;
    });
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const lower = trimmed.toLowerCase();
      const reply =
        Object.entries(responses)
          .sort((a, b) => b[0].length - a[0].length) // 🔥 prioritize longer keys
          .find(([k]) => lower.includes(k))?.[1] ??
        defaultResponse;


      const aiMsg: Message = { id: globalId++, from: 'ai', text: reply, ts: now() };
      setMessages(prev => {
        const next = [...prev, aiMsg];
        historyStore[moduleKey] = next;
        return next;
      });
      setTyping(false);
    }, 900 + Math.random() * 600);
  }, [input, moduleKey, responses, defaultResponse]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── Clear history ───────────────────────────────────────────── */
  const clearHistory = () => {
    const fresh: Message[] = [{ id: globalId++, from: 'ai', text: cfg.intro, ts: now() }];
    historyStore[moduleKey] = fresh;
    setMessages(fresh);
  };

  /* ══════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        /* ── Animations ── */
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes msgBubbleIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes avatarFloat {
          0%,100% { transform: translateY(0px);   }
          50%      { transform: translateY(-6px);  }
        }
        @keyframes avatarGlow {
          0%,100% { box-shadow: 0 0 0 0 var(--chat-glow); }
          50%      { box-shadow: 0 0 28px 8px var(--chat-glow); }
        }
        @keyframes typingDot {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40%          { transform: scale(1);   opacity: 1;   }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-5px); }
          40%      { transform: translateX(5px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        @keyframes scanLine {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100%);  }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0;   }
        }

        .chat-panel-wrap {
          --chat-accent: ${cfg.accent};
          --chat-glow:   ${cfg.glow};
          animation: chatSlideIn 0.4s cubic-bezier(.22,1,.36,1) both;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* scrollbar */
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb {
          background: var(--chat-accent);
          opacity: 0.3;
          border-radius: 4px;
        }

        .chat-send-btn {
          transition: all 0.2s ease;
        }
        .chat-send-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 0 20px var(--chat-glow) !important;
        }
        .chat-send-btn:active { transform: scale(0.94); }

        .chat-input-field {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .chat-input-field:focus {
          border-color: var(--chat-accent) !important;
          box-shadow: 0 0 0 2px ${cfg.accent}22 !important;
          outline: none;
        }

        .chat-clear-btn {
          transition: all 0.18s ease;
          opacity: 0.5;
        }
        .chat-clear-btn:hover { opacity: 1; color: var(--chat-accent) !important; }

        .msg-bubble { animation: msgBubbleIn 0.28s cubic-bezier(.22,1,.36,1) both; }

        .typing-dot:nth-child(1) { animation: typingDot 1.2s ease-in-out 0.0s infinite; }
        .typing-dot:nth-child(2) { animation: typingDot 1.2s ease-in-out 0.2s infinite; }
        .typing-dot:nth-child(3) { animation: typingDot 1.2s ease-in-out 0.4s infinite; }
      `}</style>

      <div className="chat-panel-wrap" style={{
        background:    'rgba(6,15,40,0.88)',
        backdropFilter:'blur(24px)',
        border:        `1px solid ${cfg.accent}28`,
        borderRadius:  '24px',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        minHeight:     '0',
        height:        '100%',
        maxHeight:     '580px',
        position:      'relative',
      }}>

        {/* ── Subtle scan-line effect ── */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden',
          borderRadius:'24px', zIndex:0,
        }}>
          <div style={{
            position:'absolute', left:0, right:0, height:'30%',
            background:`linear-gradient(180deg, transparent, ${cfg.accent}06, transparent)`,
            animation:'scanLine 6s linear infinite',
          }} />
        </div>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{
          position:'relative', zIndex:2,
          background:`linear-gradient(135deg, rgba(6,15,40,0.95) 0%, ${cfg.accent}12 100%)`,
          borderBottom:`1px solid ${cfg.accent}22`,
          padding:'0',
        }}>
          {/* Avatar hero zone */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'16px 20px 12px', gap:'0',
            position:'relative',
          }}>
            {/* Ambient glow behind avatar */}
            <div style={{
              position:'absolute', top:'10px', left:'50%', transform:'translateX(-50%)',
              width:'80px', height:'80px',
              background:cfg.accent,
              opacity:0.08,
              filter:'blur(40px)',
              borderRadius:'50%',
              pointerEvents:'none',
            }} />

            {/* Avatar */}
            <div style={{
              position:'relative',
              width:'80px', height:'80px',
              marginBottom:'10px',
              animation:'avatarFloat 4s ease-in-out infinite',
            }}>
              {/* Pulse rings */}
              <div style={{
                position:'absolute', inset:'-8px',
                borderRadius:'50%',
                border:`1px solid ${cfg.accent}40`,
                animation:'pulse-ring 2.5s ease-out infinite',
              }} />
              <div style={{
                position:'absolute', inset:'-14px',
                borderRadius:'50%',
                border:`1px solid ${cfg.accent}20`,
                animation:'pulse-ring 2.5s ease-out 0.8s infinite',
              }} />

              {/* Avatar image */}
              <div style={{
                width:'80px', height:'80px',
                borderRadius:'50%',
                overflow:'hidden',
                border:`2px solid ${cfg.accent}60`,
                boxShadow:`0 0 24px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
                background:'#000',
                animation:'avatarGlow 3s ease-in-out infinite',
                display:'flex', alignItems:'flex-start', justifyContent:'center',
              }}>
                <img
                  src={avatarSrc}
                  alt="AI Avatar"
                  style={{
                    width:'100%',
                    height:'100%',
                    objectFit:'cover',
                    objectPosition:'center 10%',
                    mixBlendMode:'lighten' as React.CSSProperties['mixBlendMode'],
                  }}
                  onError={e => { (e.target as HTMLImageElement).src = '/assets/AIVA.png'; }}
                />
              </div>

              {/* Live indicator */}
              <div style={{
                position:'absolute', bottom:'4px', right:'4px',
                width:'14px', height:'14px',
                background:cfg.accent,
                borderRadius:'50%',
                border:'2px solid rgba(6,15,40,0.9)',
                boxShadow:`0 0 8px ${cfg.accent}`,
              }} />
            </div>

            {/* Title badge */}
            <div style={{
              background:`linear-gradient(135deg, ${cfg.accent}22, ${cfg.accent}0a)`,
              border:`1px solid ${cfg.accent}40`,
              borderRadius:'20px',
              padding:'5px 18px',
              display:'flex', alignItems:'center', gap:'7px',
            }}>
              <span style={{ fontSize:'12px' }}>{cfg.badge}</span>
              <span style={{
                color:cfg.accent,
                fontWeight:800, fontSize:'11px',
                letterSpacing:'0.12em',
              }}>
                {title?.toUpperCase() ?? cfg.label}
              </span>
            </div>

            {/* Online status */}
            <p style={{
              color:'rgba(180,210,255,0.35)',
              fontSize:'10px', fontWeight:500,
              margin:'6px 0 0',
              letterSpacing:'0.05em',
            }}>
              Online · Ready to help
            </p>

            {/* Clear button */}
            <button
              className="chat-clear-btn"
              onClick={clearHistory}
              title="Clear chat history"
              style={{
                position:'absolute', top:'14px', right:'14px',
                background:'transparent',
                border:'none', cursor:'pointer',
                color:'rgba(180,210,255,0.4)',
                fontSize:'11px', fontWeight:600,
                display:'flex', alignItems:'center', gap:'4px',
                padding:'4px 8px',
                borderRadius:'8px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Clear
            </button>
          </div>
        </div>

        {/* ── MESSAGES ──────────────────────────────────────────────── */}
        <div
          ref={messagesContainerRef}
          className="chat-messages"
          style={{
            flex:1, overflowY:'auto',
            padding:'16px 14px',
            display:'flex', flexDirection:'column', gap:'10px',
            position:'relative', zIndex:1,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className="msg-bubble"
              style={{
                display:'flex',
                flexDirection: msg.from === 'user' ? 'row-reverse' : 'row',
                alignItems:'flex-end',
                gap:'8px',
                animationDelay:`${i === messages.length - 1 ? '0ms' : '0ms'}`,
              }}
            >
              {/* Avatar dot for AI */}
              {msg.from === 'ai' && (
                <div style={{
                  width:'28px', height:'28px', borderRadius:'50%',
                  overflow:'hidden', flexShrink:0,
                  border:`1px solid ${cfg.accent}40`,
                  boxShadow:`0 0 8px ${cfg.glow}`,
                  background:'#000',
                }}>
                  <img
                    src={avatarSrc}
                    alt=""
                    style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%', mixBlendMode:'lighten' as React.CSSProperties['mixBlendMode'] }}
                    onError={e => { (e.target as HTMLImageElement).src = '/assets/Medical_Avatar_Logo.png'; }}
                  />
                </div>
              )}

              <div style={{ maxWidth:'78%', display:'flex', flexDirection:'column', alignItems: msg.from === 'user' ? 'flex-end' : 'flex-start', gap:'3px' }}>
                <div style={{
                  padding:'10px 14px',
                  borderRadius: msg.from === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.from === 'user'
                    ? `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}cc)`
                    : 'rgba(255,255,255,0.06)',
                  border: msg.from === 'user'
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: msg.from === 'user'
                    ? `0 4px 16px ${cfg.glow}`
                    : 'none',
                  color: msg.from === 'user' ? '#fff' : 'rgba(220,235,255,0.9)',
                  fontSize:'13px', lineHeight:'1.55', fontWeight:400,
                }}>
                  {msg.text}
                </div>
                <span style={{
                  fontSize:'9px',
                  color:'rgba(180,210,255,0.25)',
                  fontWeight:500,
                  padding:'0 4px',
                }}>
                  {msg.ts}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="msg-bubble" style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
              <div style={{
                width:'28px', height:'28px', borderRadius:'50%',
                overflow:'hidden', flexShrink:0,
                border:`1px solid ${cfg.accent}40`,
                background:'#000',
              }}>
                <img src={avatarSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%', mixBlendMode:'lighten' as React.CSSProperties['mixBlendMode'] }}
                  onError={e => { (e.target as HTMLImageElement).src = '/assets/Medical_Avatar_Logo.png'; }}
                />
              </div>
              <div style={{
                padding:'12px 16px',
                borderRadius:'18px 18px 18px 4px',
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.08)',
                display:'flex', gap:'5px', alignItems:'center',
              }}>
                {[0,1,2].map(i => (
                  <div key={i} className="typing-dot" style={{
                    width:'7px', height:'7px', borderRadius:'50%',
                    background:cfg.accent,
                    opacity:0.7,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT ─────────────────────────────────────────────────── */}
        <div style={{
          position:'relative', zIndex:2,
          padding:'12px 14px 16px',
          borderTop:`1px solid ${cfg.accent}18`,
          background:'rgba(6,15,40,0.6)',
          backdropFilter:'blur(12px)',
        }}>
          <div style={{
            display:'flex', gap:'8px', alignItems:'center',
            animation: shake ? 'shake 0.4s ease' : 'none',
          }}>
            <input
              ref={inputRef}
              className="chat-input-field"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Write a message…"
              style={{
                flex:1,
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(100,180,255,0.15)',
                borderRadius:'14px',
                padding:'11px 16px',
                color:'rgba(220,235,255,0.9)',
                fontSize:'13px',
                fontFamily:'inherit',
              }}
            />

            {/* Send button */}
            <button
              className="chat-send-btn"
              onClick={send}
              style={{
                width:'42px', height:'42px', flexShrink:0,
                borderRadius:'13px',
                background:`linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}bb)`,
                border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:`0 4px 14px ${cfg.glow}`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          {/* Hint row */}
          <p style={{
            textAlign:'center',
            color:'rgba(180,210,255,0.2)',
            fontSize:'10px',
            margin:'8px 0 0',
            letterSpacing:'0.04em',
          }}>
            Press Enter to send · AI responses are informational only
          </p>
        </div>
      </div>
    </>
  );
}