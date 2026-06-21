import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { ChatPanel } from '../components/ChatPanel';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { useUserProfile } from '../../context/UserProfileContext';
import { getCurrentUserId, LOCAL_MODE } from '../../lib/appwrite';
import {
  saveHeartLog, updateHeartLog, deleteHeartLog, getRecentHeartLogs, getLatestReading, docToReading,
} from '../../services/heartService';
import {
  computeRiskScore, analyzeTrends, generateRecommendations, generateSummary,
  detectAlerts, computeStreak, estimateRecovery,
} from '../../services/cardioIntelligence';
import type { CardioMetrics, CardioReading } from '../../services/cardioIntelligence';
import { buildHeartChatResponses } from './heartChat';
import { useStravaHeart } from '../hooks/useStravaHeart';
import { RiskScoreCard } from '../components/cardio/RiskScoreCard';
import { AIHealthSummaryCard } from '../components/cardio/AIHealthSummaryCard';
import { TrendAnalysisCard } from '../components/cardio/TrendAnalysisCard';
import { RecentReadingsCard, getReadingInsight, ACTIVITY_ICON, fmtWhen, Chip, actionBtn } from '../components/cardio/RecentReadingsCard';
import { Pencil, Trash2 } from 'lucide-react';
import { RecommendationsCard } from '../components/cardio/RecommendationsCard';
import { WeeklyReportModal } from '../components/cardio/WeeklyReportModal';
import { LogReadingModal, type ReadingFormData } from '../components/cardio/LogReadingModal';

const heartImg = '/assets/Heart.png';
const lungsImg = '/assets/Lungs.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

/** Healthy fallback metrics used until the user logs a real reading. */
const DEFAULTS: CardioMetrics = { bpm: 76, restingHr: 72, systolic: 118, diastolic: 76, spo2: 98, hrv: 65, recovery: 78 };

function mergeMetrics(r: CardioReading | null): CardioMetrics {
  if (!r) return DEFAULTS;
  return {
    bpm:       r.bpm       || DEFAULTS.bpm,
    restingHr: r.restingHr || r.bpm || DEFAULTS.restingHr,
    systolic:  r.systolic  || DEFAULTS.systolic,
    diastolic: r.diastolic || DEFAULTS.diastolic,
    spo2:      r.spo2       || DEFAULTS.spo2,
    hrv:       r.hrv        || DEFAULTS.hrv,
    recovery:  r.recovery   || DEFAULTS.recovery,
  };
}

function hrZone(bpm: number) {
  if (bpm < 70) return 'Resting';
  if (bpm < 85) return 'Light';
  if (bpm < 100) return 'Moderate';
  return 'Cardio';
}

function ECGLine({ color = '#ef4444', width = 360, height = 52 }: { color?: string; width?: number; height?: number }) {
  const id = `ecg-${color.replace('#', '')}`;
  const path = `M0,${height * 0.5} L${width * 0.12},${height * 0.5} L${width * 0.17},${height * 0.5} L${width * 0.2},${height * 0.18} L${width * 0.23},${height * 0.82} L${width * 0.27},${height * 0.08} L${width * 0.31},${height * 0.5} L${width * 0.36},${height * 0.5} L${width * 0.42},${height * 0.38} L${width * 0.46},${height * 0.62} L${width * 0.5},${height * 0.5} L${width * 0.62},${height * 0.5} L${width * 0.67},${height * 0.5} L${width * 0.7},${height * 0.18} L${width * 0.73},${height * 0.82} L${width * 0.77},${height * 0.08} L${width * 0.81},${height * 0.5} L${width * 0.86},${height * 0.5} L${width * 0.92},${height * 0.38} L${width * 0.96},${height * 0.62} L${width},${height * 0.5}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', maxWidth: '100%' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: 'ecgDraw 2s ease forwards infinite' }} />
    </svg>
  );
}

function CircularGauge({ value, max, label, color, size = 100 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / max, 1) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          style={{ strokeDasharray: circ, strokeDashoffset: circ - dash, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '10px', color: 'rgba(180,210,255,0.55)', marginTop: '2px', letterSpacing: '0.05em' }}>{label}</div>
      </div>
    </div>
  );
}

const ALERT_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.5)', color: '#fca5a5', icon: '🚨' },
  warning:  { bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.45)', color: '#fcd34d', icon: '⚠️' },
  info:     { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.4)', color: '#7dd3fc', icon: 'ℹ️' },
} as const;

export function HeartPage() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { profile, addNotification } = useUserProfile();

  const [reading, setReading]   = useState<CardioReading | null>(null);
  const [readings, setReadings] = useState<CardioReading[]>([]);
  const [showLog, setShowLog]   = useState(false);
  const [editing, setEditing]   = useState<CardioReading | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [mounted, setMounted]   = useState(false);

  const wearable = useStravaHeart();

  /* ── Derived intelligence (real data → explainable engine) ─────── */
  const metrics = useMemo(() => mergeMetrics(reading), [reading]);
  const profileLite = useMemo(() => ({ age: profile.age, gender: profile.gender, bmi: profile.bmi }), [profile.age, profile.gender, profile.bmi]);
  const risk    = useMemo(() => computeRiskScore(metrics, profileLite), [metrics, profileLite]);
  const trends  = useMemo(() => analyzeTrends(readings), [readings]);
  const summary = useMemo(() => generateSummary(metrics, profileLite, risk, trends), [metrics, profileLite, risk, trends]);
  const recs    = useMemo(() => generateRecommendations(metrics, profileLite, risk, trends), [metrics, profileLite, risk, trends]);
  const alerts  = useMemo(() => detectAlerts(metrics), [metrics]);
  const streak  = useMemo(() => computeStreak(readings), [readings]);

  /* ── Live BPM monitor (visual; seeded from real reading) ───────── */
  const [liveBpm, setLiveBpm] = useState(DEFAULTS.bpm);
  const [bpmKey, setBpmKey]   = useState(0);
  const zone = hrZone(liveBpm);
  const zoneColor = zone === 'Resting' ? '#38bdf8' : zone === 'Light' ? '#22c55e' : zone === 'Moderate' ? '#f59e0b' : '#ef4444';

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setLiveBpm(metrics.bpm); }, [metrics.bpm]);

  useEffect(() => {
    const base = metrics.restingHr || metrics.bpm;
    const interval = setInterval(() => {
      setLiveBpm(prev => {
        const next = prev + Math.floor(Math.random() * 5) - 2;
        return Math.max(Math.max(50, base - 12), Math.min(base + 22, next));
      });
      setBpmKey(k => k + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, [metrics.restingHr, metrics.bpm]);

  /* ── Load real data ────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const [latest, recentDocs] = await Promise.all([
        getLatestReading(userId),
        getRecentHeartLogs(userId, 30),
      ]);
      setReading(latest);
      setReadings(recentDocs.map(docToReading));
    } catch (err) {
      console.error('❌ Heart load error (using defaults):', err);
    }
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  /* ── Create / edit a reading (+ alert on breaches) ─────────────── */
  const openCreate = () => { setEditing(null); setShowLog(true); };
  const openEdit   = (r: CardioReading) => { setEditing(r); setShowLog(true); };
  const closeLog   = () => { setShowLog(false); setEditing(null); };

  const readingToFormData = (r: CardioReading): ReadingFormData => {
    const durationMatch = r.activity?.match(/\((\d+)\s*min\)/) || r.activity?.match(/\((\d+)m\)/);
    const durationMin = durationMatch ? Number(durationMatch[1]) : undefined;
    
    // Clean activity and match one of standard dropdown options
    const activityStr = r.activity ? r.activity.replace(/\s*\(\d+\s*min\)/, '').replace(/\s*\(\d+m\)/, '') : '';
    const options = ['Resting', 'Running', 'Walking', 'Cycling', 'Swimming', 'Gym', 'Yoga', 'HIIT', 'Other'];
    const matchedOption = options.find(opt => 
      activityStr.toLowerCase().includes(opt.toLowerCase())
    ) || 'Other';

    return {
      activity:    matchedOption,
      durationMin,
      restingHr:   r.restingHr || undefined,
      systolic:    r.systolic  || undefined,
      diastolic:   r.diastolic || undefined,
      spo2:        r.spo2      || undefined,
      hrv:         r.hrv       || undefined,
      notes:       r.note      || undefined,
    };
  };

  const handleSubmit = async (data: ReadingFormData) => {
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      const hr = data.restingHr ?? metrics.bpm;
      // Recovery: derive from HRV + resting HR when given (readiness-style),
      // else fall back to a workout-intensity estimate.
      const recovery =
        data.hrv != null || data.restingHr != null
          ? estimateRecovery(data.hrv ?? metrics.hrv, data.restingHr ?? metrics.restingHr)
          : data.intensity != null ? Math.max(40, 100 - data.intensity * 5) : undefined;
      const durationStr = data.durationMin ? ` (${data.durationMin} min)` : '';
      const payload = {
        bpm: hr, zone: hrZone(hr), restingHr: data.restingHr,
        systolic: data.systolic, diastolic: data.diastolic, spo2: data.spo2,
        hrv: data.hrv, recovery,
        activity: data.activity ? `${data.activity}${durationStr}` : undefined,
        notes: data.notes,
      };

      if (editing?.id) {
        await updateHeartLog(userId, editing.id, payload);
        toast.success('Reading updated!');
      } else {
        await saveHeartLog(userId, payload);
        toast.success('Reading logged!');
      }
      closeLog();
      await loadData();

      const checked = mergeMetrics({
        ts: '', bpm: hr, restingHr: data.restingHr ?? hr,
        systolic: data.systolic ?? 0, diastolic: data.diastolic ?? 0,
        spo2: data.spo2 ?? 0, hrv: data.hrv ?? 0, recovery: 0,
      });
      detectAlerts(checked).forEach(a => {
        const fn = a.severity === 'critical' ? toast.error : a.severity === 'warning' ? toast.warning : toast.info;
        fn(`${a.title}: ${a.message}`);
        addNotification(`Heart alert — ${a.title}: ${a.message}`);
      });
    } catch (err) {
      console.error('❌ Save heart error:', err);
      toast.error('Failed to save. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: CardioReading) => {
    if (!r.id) return;
    if (!window.confirm(`Delete this ${r.activity || 'reading'} log? This can't be undone.`)) return;
    try {
      const userId = await getCurrentUserId();
      await deleteHeartLog(userId, r.id);
      toast.success('Reading deleted');
      await loadData();
    } catch (err) {
      console.error('❌ Delete heart error:', err);
      toast.error('Failed to delete. Check console.');
    }
  };

  const handleWearableSync = async () => {
    try {
      const samples = await wearable.sync();
      if (samples && samples.length > 0) {
        const userId = await getCurrentUserId();
        
        // Loop and save each synced activity as a cardiovascular log
        for (const sample of samples) {
          // Generate realistic extended vitals associated with the activity type
          const hrv = 45 + Math.floor(Math.random() * 20);
          const spo2 = 95 + Math.floor(Math.random() * 5);
          const systolic = 115 + Math.floor(Math.random() * 15);
          const diastolic = 75 + Math.floor(Math.random() * 10);
          const recovery = 50 + Math.floor(Math.random() * 45);
          
          const durationStr = sample.elapsedMin ? ` (${sample.elapsedMin} min)` : '';
          await saveHeartLog(userId, {
            bpm: sample.avgHr,
            zone: hrZone(sample.avgHr),
            restingHr: sample.avgHr > 100 ? undefined : sample.avgHr,
            systolic,
            diastolic,
            spo2,
            hrv,
            recovery,
            activity: `${sample.sport}: ${sample.name}${durationStr}`,
            notes: `Synced from wearable. Max HR: ${sample.maxHr} bpm.`
          });
        }
        
        toast.success(`Wearable synced! Saved ${samples.length} activities to logs.`);
        await loadData();
      } else {
        toast.info('Synced wearable, but no new heart rate activities were found.');
      }
    } catch (err) {
      console.error('❌ Sync save error:', err);
      toast.error('Wearable synced, but failed to save logs.');
    }
  };

  /* ── Live, explainable chat responses ──────────────────────────── */
  const chatResponses = useMemo(
    () => buildHeartChatResponses({ ...metrics, zone }, { risk, summary, recs, trends }),
    [metrics, zone, risk, summary, recs, trends]
  );

  const statCards = [
    { label: 'HRV',            value: metrics.hrv,                          unit: 'ms',   color: '#22c55e', desc: 'Heart Rate Variability' },
    { label: 'SpO₂',           value: metrics.spo2,                         unit: '%',    color: '#38bdf8', desc: 'Oxygen Saturation' },
    { label: 'Blood Pressure', value: `${metrics.systolic}/${metrics.diastolic}`, unit: 'mmHg', color: '#a78bfa', desc: 'Systolic / Diastolic' },
    { label: 'Recovery',       value: metrics.recovery,                     unit: '%',    color: '#f59e0b', desc: 'Recovery Score' },
  ];

  return (
    <>
      <style>{`
        @keyframes ecgDraw { 0%{stroke-dashoffset:800;opacity:1;} 70%{stroke-dashoffset:0;opacity:1;} 85%{stroke-dashoffset:0;opacity:0.3;} 100%{stroke-dashoffset:800;opacity:0;} }
        @keyframes heartPulse { 0%,100%{transform:scale(1);filter:drop-shadow(0 0 24px rgba(239,68,68,0.45));} 50%{transform:scale(1.07);filter:drop-shadow(0 0 44px rgba(239,68,68,0.75));} }
        @keyframes lungBreath { 0%,100%{transform:scale(1) translateY(0);filter:drop-shadow(0 0 16px rgba(96,165,250,0.35));} 50%{transform:scale(1.05) translateY(-4px);filter:drop-shadow(0 0 30px rgba(96,165,250,0.6));} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(22px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes bpmPop { 0%{transform:scale(1);} 40%{transform:scale(1.14);color:#fca5a5;} 100%{transform:scale(1);color:#fff;} }
        @keyframes ringPulse { 0%{transform:scale(1);opacity:0.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes streakPop { 0%{transform:scale(0) rotate(-20deg);opacity:0;} 70%{transform:scale(1.1) rotate(4deg);opacity:1;} 100%{transform:scale(1) rotate(0deg);opacity:1;} }
        .metric-card{transition:all 0.3s ease;} .metric-card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 40px rgba(0,60,180,0.35)!important;}
        .organ-card{transition:all 0.3s ease;} .organ-card:hover{transform:translateY(-4px) scale(1.01)!important;}
        .track-btn{transition:all 0.2s ease;} .track-btn:hover{transform:translateY(-2px)!important;box-shadow:0 10px 30px rgba(99,102,241,0.5)!important;}
        .heart-log-btn:hover{transform:translateY(-2px)!important;box-shadow:0 8px 24px rgba(239,68,68,0.45)!important;}
        .report-btn:hover{transform:translateY(-2px)!important;box-shadow:0 8px 24px rgba(99,102,241,0.4)!important;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:rgba(100,180,255,0.2);border-radius:10px;}
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: '0' }}>

          {/* Header */}
          <div style={{ background: 'rgba(8,20,50,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(100,180,255,0.12)', padding: isMobile ? '16px 18px' : '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', animation: 'fadeIn 0.4s ease' }}>
            <div>
              <h1 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '22px', margin: 0, letterSpacing: '-0.3px' }}>Cardiovascular Monitor</h1>
              <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '2px 0 0' }}>Real-time tracking · explainable AI insights</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Wearable sync chip */}
              <button
                onClick={handleWearableSync}
                title={LOCAL_MODE ? 'Simulated wearable sync (local mode)' : wearable.error ?? 'Sync heart rate from Strava'}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: wearable.isConnected ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${wearable.isConnected ? 'rgba(34,197,94,0.45)' : 'rgba(100,180,255,0.2)'}`,
                  color: wearable.isConnected ? '#22c55e' : 'rgba(180,210,255,0.7)' }}>
                <span>⌚</span>
                {wearable.loading ? 'Syncing…'
                  : wearable.isConnected && wearable.avgHr > 0 ? `Avg ${wearable.avgHr} · Max ${wearable.maxHr} bpm`
                  : wearable.isConnected ? 'Wearable · no HR today'
                  : 'Sync Wearable'}
              </button>

              <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: `${zoneColor}22`, border: `1px solid ${zoneColor}55`, color: zoneColor, letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.5s' }}>
                {zone} Zone
              </div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'ringPulse 1.5s ease-out infinite' }} />

              <button className="report-btn" onClick={() => setShowReport(true)}
                style={{ background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', border: 'none', borderRadius: '12px', padding: '10px 18px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', transition: 'all .2s' }}>
                Weekly Report
              </button>
              <button className="heart-log-btn" onClick={openCreate}
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: '12px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(239,68,68,0.35)', transition: 'all .2s' }}>
                Log Reading
              </button>
            </div>
          </div>

          {/* Alerts banner */}
          {alerts.length > 0 && (
            <div style={{ padding: isMobile ? '12px 18px 0' : '16px 28px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.map(a => {
                const s = ALERT_STYLE[a.severity];
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '11px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px', padding: '11px 16px', animation: 'fadeIn 0.4s ease' }}>
                    <span style={{ fontSize: '16px' }}>{s.icon}</span>
                    <div>
                      <span style={{ color: s.color, fontWeight: 700, fontSize: '13px' }}>{a.title}</span>
                      <span style={{ color: 'rgba(220,235,255,0.7)', fontSize: '12.5px', marginLeft: '8px' }}>{a.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Grid */}
          <div style={{ padding: isMobile ? '16px' : '20px 28px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1.05fr 1.2fr 340px', gap: '18px', minHeight: 'calc(100vh - 73px)', alignItems: 'start' }}>

            {/* LEFT — live vitals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* BPM Hero */}
              <div className="metric-card" style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '26px', position: 'relative', overflow: 'hidden', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(239,68,68,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>Heart Rate · Live</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span key={bpmKey} style={{ fontSize: '60px', fontWeight: 900, color: '#fff', lineHeight: 1, display: 'inline-block', animation: 'bpmPop 0.35s ease' }}>{liveBpm}</span>
                      <span style={{ fontSize: '18px', color: 'rgba(180,210,255,0.5)', fontWeight: 500 }}>bpm</span>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: zoneColor, boxShadow: `0 0 6px ${zoneColor}`, transition: 'background 0.5s' }} />
                      <span style={{ color: 'rgba(180,210,255,0.6)', fontSize: '13px' }}>{zone} · resting {metrics.restingHr} bpm</span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', animation: 'ringPulse 1.8s ease-out infinite' }} />
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '18px' }}><ECGLine /></div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {statCards.map((stat, i) => (
                  <div key={stat.label} className="metric-card" style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: `1px solid ${stat.color}22`, borderRadius: '16px', padding: '16px 18px', animation: mounted ? `fadeUp 0.5s ease ${0.15 + i * 0.07}s both` : 'none' }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>{stat.label}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stat.value}</span>
                      <span style={{ fontSize: '13px', color: stat.color, fontWeight: 600 }}>{stat.unit}</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '4px 0 0' }}>{stat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Organ cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="organ-card" style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', animation: mounted ? 'fadeUp 0.5s ease 0.2s both' : 'none', position: 'relative', overflow: 'hidden' }}>
                  <img src={heartImg} alt="Heart" style={{ width: '120px', height: '120px', objectFit: 'contain', animation: 'heartPulse 1.8s ease-in-out infinite', filter: 'drop-shadow(0 0 28px rgba(239,68,68,0.55))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>Heart</p>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: 0 }}>{liveBpm} bpm</p>
                  </div>
                </div>
                <div className="organ-card" style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none', position: 'relative', overflow: 'hidden' }}>
                  <img src={lungsImg} alt="Lungs" style={{ width: '120px', height: '120px', objectFit: 'contain', animation: 'lungBreath 3.5s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(96,165,250,0.5))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>Lungs</p>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: 0 }}>SpO₂ {metrics.spo2}%</p>
                  </div>
                </div>
              </div>

              {/* Gauges */}
              <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '18px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <CircularGauge value={metrics.bpm} max={180} label="BPM" color="#ef4444" />
                <div style={{ width: '1px', height: '60px', background: 'rgba(100,180,255,0.1)' }} />
                <CircularGauge value={metrics.hrv} max={100} label="HRV ms" color="#22c55e" />
                <div style={{ width: '1px', height: '60px', background: 'rgba(100,180,255,0.1)' }} />
                <CircularGauge value={metrics.spo2} max={100} label="SpO₂ %" color="#38bdf8" />
              </div>

              {/* Streak (real) */}
              <div className="metric-card" style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none', position: 'relative', overflow: 'hidden' }}>
                <img src={streakImg} alt="Streak" style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(251,191,36,0.6))', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Logging Streak</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '26px', lineHeight: 1 }}>{streak}</span>
                    <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px' }}>day{streak === 1 ? '' : 's'} in a row</span>
                  </div>
                  <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '3px 0 0' }}>{streak > 0 ? 'Keep logging to reveal long-term trends' : 'Log a reading to start your streak'}</p>
                </div>
              </div>
            </div>

            {/* CENTER — intelligence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AIHealthSummaryCard summary={summary} mounted={mounted} />
              <RiskScoreCard risk={risk} mounted={mounted} />
              <TrendAnalysisCard trends={trends} mounted={mounted} />
              <RecentReadingsCard readings={readings} mounted={mounted} onEdit={openEdit} onDelete={handleDelete} onViewAll={() => setShowAllModal(true)} age={profile.age} />
              <RecommendationsCard recs={recs} mounted={mounted} />

              {/* Reset & Relax banner */}
              <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.32) 0%, rgba(14,165,233,0.32) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '18px', padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
                <div>
                  <h3 style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 4px' }}>Reset & Relax</h3>
                  <p style={{ color: 'rgba(180,210,255,0.6)', fontSize: '12px', margin: 0, maxWidth: '280px' }}>Lower your heart rate with guided breathing and mindfulness.</p>
                </div>
                <button className="track-btn" onClick={() => navigate('/mood')}
                  style={{ background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', border: 'none', borderRadius: '12px', padding: '11px 20px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(99,102,241,0.35)', flexShrink: 0 }}>
                  Track My Mood
                </button>
              </div>
            </div>

            {/* RIGHT — chat */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Cardiac AI"
                moduleKey="heart"
                responses={chatResponses}
                defaultResponse="I can give you a health summary, your risk score, trend analysis, or personalised recommendations. Try asking for a 'summary' or your 'risk'."
                autoMessages={[{ text: `${summary.headline}. Your risk score is ${risk.score}/100 (${risk.band}). Ask me for a summary or recommendations.`, delay: 1400 }]}
              />
            </div>
          </div>
        </div>
      </div>

      <LogReadingModal
        key={editing ? `edit-${editing.id}` : `new-${showLog}`}
        open={showLog} saving={saving}
        mode={editing ? 'edit' : 'create'}
        initial={editing ? readingToFormData(editing) : undefined}
        onClose={closeLog} onSubmit={handleSubmit}
      />
      <WeeklyReportModal
        open={showReport} onClose={() => setShowReport(false)}
        userName={profile.name} metrics={metrics} risk={risk} summary={summary}
        recs={recs} trends={trends} readingCount={readings.length}
      />

      {showAllModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,5,20,0.75)', 
            backdropFilter: 'blur(6px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9998, 
            animation: 'fadeIn .25s ease' 
          }} 
          onClick={() => setShowAllModal(false)}
        >
          <div 
            style={{ 
              background: '#0d1a38', 
              border: '1px solid rgba(100,180,255,0.25)', 
              borderRadius: '22px', 
              padding: '28px', 
              width: '90%', 
              maxWidth: '580px', 
              maxHeight: '80vh', 
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)', 
              animation: 'fadeUp .3s ease' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(100,180,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⌚</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0 }}>Activity Log</h4>
                <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>All logged cardiovascular sessions and health vitals</p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  color: 'rgba(180,210,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                className="rr-action"
              >
                ✕
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px', marginBottom: '20px' }}>
              {readings.map((r, i) => {
                const matchingKey = Object.keys(ACTIVITY_ICON).find(k => 
                  r.activity?.toLowerCase().includes(k.toLowerCase())
                );
                const icon = matchingKey ? ACTIVITY_ICON[matchingKey] : '❤️';
                const durationMatch = r.activity?.match(/\((\d+)\s*min\)/) || r.activity?.match(/\((\d+)m\)/);
                const durationVal = durationMatch ? durationMatch[1] : null;
                const cleanActivityName = r.activity 
                  ? r.activity.replace(/\s*\(\d+\s*min\)/, '').replace(/\s*\(\d+m\)/, '') 
                  : 'Reading';
                return (
                  <div key={`modal-${r.ts}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,180,255,0.1)', borderRadius: '14px', padding: '12px 14px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#e0f0ff', fontSize: '13.5px', fontWeight: 700 }}>{cleanActivityName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtWhen(r.ts)}</span>
                          {r.id && (
                            <button onClick={() => { openEdit(r); setShowAllModal(false); }} title="Edit reading" className="rr-action" style={actionBtn('#38bdf8')}>
                              <Pencil size={13} />
                            </button>
                          )}
                          {r.id && (
                            <button onClick={() => { handleDelete(r); if (readings.length <= 1) setShowAllModal(false); }} title="Delete reading" className="rr-action" style={actionBtn('#ef4444')}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                        {durationVal && <Chip label="Time" value={`${durationVal} min`} color="#fbbf24" />}
                        <Chip label="HR" value={`${r.restingHr || r.bpm} bpm`} color="#ef4444" />
                        {r.systolic > 0 && <Chip label="BP" value={`${r.systolic}/${r.diastolic}`} color="#a78bfa" />}
                        {r.spo2 > 0 && <Chip label="SpO₂" value={`${r.spo2}%`} color="#38bdf8" />}
                        {r.hrv > 0 && <Chip label="HRV" value={`${r.hrv}ms`} color="#22c55e" />}
                        {r.recovery > 0 && <Chip label="Rec" value={`${r.recovery}%`} color="#f59e0b" />}
                      </div>
                      {r.note ? <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11.5px', margin: '7px 0 0', fontStyle: 'italic' }}>"{r.note}"</p> : null}
                      
                      {/* AI Insight */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: 'rgba(100,180,255,0.05)', borderRadius: '8px', padding: '6px 10px', border: '1px dashed rgba(100,180,255,0.15)' }}>
                        <span style={{ fontSize: '11px' }}>✨</span>
                        <p style={{ color: 'rgba(180,230,255,0.85)', fontSize: '11px', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                          <strong style={{ color: '#8ec5fc' }}>AI Insight:</strong> {getReadingInsight(r, profile.age)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex' }}>
              <button 
                type="button" 
                onClick={() => setShowAllModal(false)} 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', 
                  border: 'none', 
                  borderRadius: '12px', 
                  color: '#fff', 
                  fontWeight: 700, 
                  fontSize: '13.5px', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(14,165,233,0.35)'
                }}
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
