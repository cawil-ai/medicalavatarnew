import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { ChatPanel } from '../components/ChatPanel';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID, account } from '../../lib/appwrite';

const heartImg  = '/assets/Heart.png';
const lungsImg  = '/assets/Lungs.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

function ECGLine({ color = '#ef4444', width = 220, height = 54 }: { color?: string; width?: number; height?: number }) {
  const id = `ecg-${color.replace('#', '')}`;
  const path = `M0,${height * 0.5} L${width * 0.12},${height * 0.5} L${width * 0.17},${height * 0.5} L${width * 0.2},${height * 0.18} L${width * 0.23},${height * 0.82} L${width * 0.27},${height * 0.08} L${width * 0.31},${height * 0.5} L${width * 0.36},${height * 0.5} L${width * 0.42},${height * 0.38} L${width * 0.46},${height * 0.62} L${width * 0.5},${height * 0.5} L${width * 0.62},${height * 0.5} L${width * 0.67},${height * 0.5} L${width * 0.7},${height * 0.18} L${width * 0.73},${height * 0.82} L${width * 0.77},${height * 0.08} L${width * 0.81},${height * 0.5} L${width * 0.86},${height * 0.5} L${width * 0.92},${height * 0.38} L${width * 0.96},${height * 0.62} L${width},${height * 0.5}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: 'ecgDraw 2s ease forwards infinite' }}
      />
    </svg>
  );
}

function CircularGauge({ value, max, label, color, size = 120 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / max, 1) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          style={{ strokeDasharray: circ, strokeDashoffset: circ - dash, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '10px', color: 'rgba(180,210,255,0.55)', marginTop: '2px', letterSpacing: '0.05em' }}>{label}</div>
      </div>
    </div>
  );
}

export function HeartPage() {
  const navigate = useNavigate();
  const [showLogModal, setShowLogModal]   = useState(false);
  const [activityData, setActivityData]   = useState({ type: 'Running', duration: '', intensity: '5', notes: '' });
  const [bpm, setBpm]                     = useState(76);
  const [bpmKey, setBpmKey]               = useState(0);
  const [mounted, setMounted]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const { isMobile, isTablet }            = useResponsive();

  const hrv      = 65;
  const bp       = { sys: 118, dia: 76 };
  const o2       = 98;
  const recovery = 78;

  const [zone, setZone] = useState('Resting');

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setBpm(prev => {
        const next = prev + Math.floor(Math.random() * 5) - 2;
        return Math.max(60, Math.min(95, next));
      });
      setBpmKey(k => k + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bpm < 70)       setZone('Resting');
    else if (bpm < 85)  setZone('Light');
    else if (bpm < 100) setZone('Moderate');
    else                setZone('Cardio');
  }, [bpm]);

  const zoneColor = zone === 'Resting' ? '#38bdf8' : zone === 'Light' ? '#22c55e' : zone === 'Moderate' ? '#f59e0b' : '#ef4444';

  /* ── Save heart log to Appwrite ───────────────────────────────── */
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const user = await account.get();
      const now  = new Date();

      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.heart,
        ID.unique(),
        {
          userID:   user.$id,
          bpmLog:   bpm,
          Zone:     zone,
          Activity: activityData.type,
          Resting:  zone === 'Resting',
          Note:     activityData.notes || '',
          Date:     now.toISOString(),
          loggedAt: now.toISOString(),
        }
      );
      console.log('✅ Heart log saved:', doc);
      toast.success('Activity logged!');
      setShowLogModal(false);
      setActivityData({ type: 'Running', duration: '', intensity: '5', notes: '' });
    } catch (err) {
      console.error('❌ Save heart error:', err);
      toast.error('Failed to save. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const chatResponses = {
    // ── Heart Rate ──────────────────────────────────────────────────────
    'heart':                 `Your heart rate is currently ${bpm} BPM — within the healthy resting range of 60–100 BPM.`,
    'heart rate':            `Your current heart rate is ${bpm} BPM. Normal resting range is 60–100 BPM. You are in the ${zone} zone.`,
    'bpm':                   `Your current BPM is ${bpm}. The healthy resting target is 60–100 BPM. You are in the ${zone} zone.`,
    'heartbeat':             `Your heartbeat is ${bpm} BPM — steady and healthy. Keep monitoring via the weekly trend below.`,
    'pulse':                 `Your pulse is ${bpm} BPM, which is in the normal resting range (60–100 BPM).`,
    'resting heart rate':    `Your resting heart rate is ${bpm} BPM. A healthy resting rate for adults is 60–100 BPM. Athletes may be lower.`,
    'normal heart rate':     'A normal resting heart rate is 60–100 BPM for adults. Highly active individuals can be as low as 40 BPM.',
    'high heart rate':       'A resting heart rate consistently above 100 BPM (tachycardia) may warrant medical attention. Try reducing caffeine, stress, and get adequate sleep.',
    'low heart rate':        'A resting heart rate below 60 BPM (bradycardia) is common in athletes. If you feel dizzy or faint, consult a healthcare provider.',
    'my heart rate':         `Your heart rate right now is ${bpm} BPM. You are currently in the ${zone} zone. Check the weekly trend for patterns.`,
    'is my heart rate normal': `Yes, your current heart rate of ${bpm} BPM is within the healthy range of 60–100 BPM.`,
    'why is my heart rate high': 'Elevated heart rate can be caused by exercise, stress, caffeine, dehydration, or poor sleep. Try relaxing and staying hydrated.',
    'why is my heart rate low':  'A lower heart rate is often a sign of good cardiovascular fitness. If accompanied by dizziness or fatigue, consult a doctor.',
    'heart rate zone':       `You are currently in the ${zone} zone (${bpm} BPM). Zones: Resting (<70), Light (70–84), Moderate (85–99), Cardio (100+).`,
    'zone':                  `Your current heart rate zone is ${zone} at ${bpm} BPM. Zones help guide workout intensity and recovery.`,
    'resting zone':          'Resting zone (below 70 BPM) means your heart is fully relaxed. Great for recovery and sleep.',
    'light zone':            'Light zone (70–84 BPM) is ideal for warm-ups and active recovery. Low intensity, good fat burn.',
    'moderate zone':         'Moderate zone (85–99 BPM) improves aerobic capacity and cardiovascular endurance.',
    'cardio zone':           'Cardio zone (100+ BPM) maximises cardiovascular fitness. Ensure adequate warm-up and cool-down.',
    'heart health':          `Your heart health looks good. BPM is ${bpm}, HRV is ${hrv}ms, Blood Pressure is ${bp.sys}/${bp.dia} mmHg, and SpO₂ is ${o2}%.`,
    'cardiovascular':        'Cardiovascular health depends on regular aerobic exercise, quality sleep, hydration, and a balanced diet. Your metrics are tracking well.',
    'cardio':                'Cardio exercise strengthens your heart over time. Aim for at least 150 minutes of moderate aerobic activity per week.',
    'cardiac':               `Your cardiac metrics today — BPM: ${bpm}, HRV: ${hrv}ms, SpO₂: ${o2}%, BP: ${bp.sys}/${bp.dia} mmHg. All looking healthy.`,

    // ── HRV (Heart Rate Variability) ────────────────────────────────────
    'hrv':                         `Your HRV is ${hrv}ms — a strong score indicating good recovery and low physiological stress.`,
    'heart rate variability':      `HRV measures the variation between heartbeats. Your current HRV is ${hrv}ms — higher is generally better, indicating resilience and recovery.`,
    'what is hrv':                 'HRV (Heart Rate Variability) is the time variation between consecutive heartbeats. Higher HRV means your body handles stress and recovery well.',
    'is my hrv good':              `Your HRV is ${hrv}ms. A score above 50ms is generally considered healthy. Yours looks great!`,
    'improve hrv':                 'To improve HRV: prioritise sleep, manage stress, stay hydrated, exercise regularly, and limit alcohol and caffeine.',
    'low hrv':                     'Low HRV can indicate fatigue, stress, illness, or overtraining. Rest more, sleep better, and reduce stressors.',
    'high hrv':                    `An HRV of ${hrv}ms is strong — it means your body is recovering well and your nervous system is balanced.`,
    'hrv and stress':              'HRV drops when you are stressed or fatigued. Your current HRV of ' + hrv + 'ms suggests low physiological stress.',
    'recovery':                    `Your recovery score is ${recovery}%. A score above 70% means your body is ready for moderate to high intensity activity.`,
    'recovery score':              `Your recovery score is ${recovery}%. This is derived from your HRV, sleep, and resting heart rate trends.`,
    'am i recovered':              `Your recovery score is ${recovery}% — ${recovery >= 70 ? 'you are ready for training today!' : 'consider a lighter session or rest today.'}`,

    // ── Blood Pressure ──────────────────────────────────────────────────
    'blood pressure':              `Your blood pressure is ${bp.sys}/${bp.dia} mmHg — within the normal range. Ideal is below 120/80 mmHg.`,
    'bp':                          `BP reading: ${bp.sys}/${bp.dia} mmHg. Normal range is below 120/80 mmHg. Yours looks healthy.`,
    'systolic':                    `Your systolic pressure (top number) is ${bp.sys} mmHg. Normal is below 120 mmHg.`,
    'diastolic':                   `Your diastolic pressure (bottom number) is ${bp.dia} mmHg. Normal is below 80 mmHg.`,
    'high blood pressure':         'High blood pressure (hypertension) is 130/80 mmHg or above. Reduce sodium, manage stress, exercise regularly, and consult a doctor if persistent.',
    'low blood pressure':          'Low blood pressure (hypotension) is below 90/60 mmHg. Stay hydrated, avoid standing up too quickly, and see a doctor if symptomatic.',
    'is my blood pressure normal': `Your blood pressure is ${bp.sys}/${bp.dia} mmHg. This is within the normal range (below 120/80 mmHg). Great job!`,
    'hypertension':                'Hypertension means your blood pressure is consistently above 130/80 mmHg. Lifestyle changes and medical consultation are important.',
    'blood pressure reading':      `Current reading: ${bp.sys}/${bp.dia} mmHg. Systolic (top): ${bp.sys} mmHg — Diastolic (bottom): ${bp.dia} mmHg. Both within normal range.`,
    'what does blood pressure mean': 'Blood pressure measures the force of blood against artery walls. Systolic (top) is peak pressure; diastolic (bottom) is resting pressure.',

    // ── Oxygen Saturation (SpO₂) ────────────────────────────────────────
    'oxygen':                   `Your SpO₂ is ${o2}% — excellent oxygen saturation. Normal is 95–100%.`,
    'spo2':                     `SpO₂ reading: ${o2}% — your blood oxygen level is excellent.`,
    'oxygen saturation':        `Your blood oxygen saturation is ${o2}%. A healthy range is 95–100%. Yours is excellent.`,
    'blood oxygen':             `Blood oxygen level: ${o2}%. This is in the excellent range (95–100%). Your lungs are doing a great job.`,
    'o2':                       `Your oxygen saturation (SpO₂) is ${o2}% — well within the healthy range of 95–100%.`,
    'low oxygen':               'SpO₂ below 94% may indicate a breathing issue. If you feel short of breath or dizzy, seek medical attention.',
    'is my oxygen level normal': `Yes! Your SpO₂ is ${o2}%, which is excellent. Normal blood oxygen is between 95–100%.`,
    'breathing':                `Your SpO₂ of ${o2}% and lung status both look healthy. Deep, slow breathing can also help lower your heart rate.`,
    'lungs':                    `Your lungs are healthy — SpO₂ is ${o2}%. Breathing exercises and regular cardio help maintain lung capacity.`,
    'lung health':              'Healthy lungs are supported by regular aerobic exercise, avoiding smoking, staying hydrated, and deep breathing practices.',

    // ── Activity & Exercise ─────────────────────────────────────────────
    'activity':           'Log your workout using the "Log Activity" button above. Tracking activities helps monitor how exercise impacts your heart rate over time.',
    'log activity':       'Tap "Log Activity" in the top right to record your workout. You can log Running, Walking, Cycling, Swimming, Gym, Yoga, HIIT, and more.',
    'workout':            'After a workout, your heart rate elevates and HRV may temporarily dip. This is normal — rest and recovery bring both back to baseline.',
    'exercise':           'Regular exercise strengthens your heart, improves HRV, and lowers resting BPM over time. Aim for 150 min of moderate activity per week.',
    'running':            'Running elevates your heart rate into the Moderate or Cardio zone. After your run, monitor how quickly your BPM returns to resting — that is your recovery rate.',
    'walking':            'Walking is excellent for heart health. It keeps your heart in the Light zone, ideal for active recovery and sustained cardiovascular benefit.',
    'cycling':            'Cycling is a great low-impact cardio exercise that elevates your heart rate into the Light or Moderate zone.',
    'swimming':           'Swimming is one of the best full-body cardio exercises. It naturally keeps your heart rate in an efficient aerobic zone.',
    'hiit':               'HIIT (High Intensity Interval Training) pushes your heart into the Cardio zone. Make sure to warm up and allow recovery time afterwards.',
    'yoga':               'Yoga and mindful movement help lower resting heart rate and improve HRV over time by activating the parasympathetic nervous system.',
    'gym':                'Strength training at the gym raises your heart rate to Moderate or Cardio zones. Combine with cardio for best cardiovascular results.',
    'how does exercise affect heart': 'Exercise temporarily raises BPM and lowers HRV. Over time, regular training lowers resting BPM and raises HRV — both signs of better cardiovascular fitness.',
    'after workout':      'Post-workout, expect an elevated BPM and temporarily lower HRV. These return to baseline with proper hydration, nutrition, and rest.',
    'warm up':            'Warming up gradually raises your heart rate, reducing injury risk and preparing your cardiovascular system for higher intensity exercise.',
    'cool down':          'Cooling down after exercise helps your heart rate return to resting gradually. It reduces the risk of dizziness or post-exercise complications.',

    // ── Stress & Recovery ───────────────────────────────────────────────
    'stress':             `Stress directly raises heart rate and lowers HRV. Your current HRV is ${hrv}ms — indicating manageable stress levels. Try the breathing exercises below.`,
    'stressed':           `Feeling stressed? Your HRV of ${hrv}ms is still healthy. Try a 5-minute deep breathing session or visit the mood tracker.`,
    'relax':              'Deep breathing and mindfulness lower your heart rate and raise HRV. Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.',
    'breathing exercise': 'Box breathing: inhale for 4 seconds, hold 4 seconds, exhale 4 seconds, hold 4 seconds. Repeat 4 times. Great for lowering BPM quickly.',
    'meditation':         'Meditation activates the parasympathetic nervous system, lowering BPM and raising HRV over time. Even 5 minutes daily makes a difference.',
    'anxiety':            'Anxiety increases heart rate and suppresses HRV. Regular breathing exercises, movement, and sleep can significantly help manage it.',
    'calm':               `To calm your heart rate, try slow deep breathing. Your current BPM is ${bpm} — a few minutes of breathing exercises can bring it down noticeably.`,
    'mood':               'Your mood and heart health are connected. Stress and negative emotions raise BPM and lower HRV. Track your mood for deeper insights.',
    'rest':               `Rest and sleep are essential for heart recovery. Your recovery score is ${recovery}% — ${recovery >= 70 ? 'you are ready to go!' : 'a rest day might help today.'}`,

    // ── Streak & Motivation ─────────────────────────────────────────────
    'streak':             'You are on a 7-day activity streak! Consistent logging helps you spot heart rate trends and improvements over time.',
    'day streak':         'Amazing — 7 days in a row! Your commitment to tracking your cardiac health is showing in your recovery score.',
    'motivation':         `You have a 7-day streak and a recovery score of ${recovery}%. Keep logging your activities to reveal long-term heart health trends!`,
    'progress':           `Your weekly average BPM is 75. Peak this week was 80 BPM. HRV at ${hrv}ms. All trending positively!`,
    'weekly trend':       'Your weekly BPM ranged from 68–80. A lower average over weeks indicates improving cardiovascular fitness.',
    'trend':              'The weekly trend shows your BPM across the last 7 days. Consistent lows at rest and controlled highs during exercise are signs of a healthy heart.',

    // ── Warning Signs ───────────────────────────────────────────────────
    'chest pain':         'Chest pain can be a serious symptom. If you experience chest tightness, pressure, or pain — especially during or after exercise — seek medical attention immediately.',
    'palpitations':       'Heart palpitations (fluttering or racing heart) are often harmless, but if frequent, prolonged, or accompanied by dizziness, consult a doctor.',
    'dizzy':              'Dizziness can be linked to low blood pressure, dehydration, or an abnormal heart rate. Rest, hydrate, and monitor your BPM. See a doctor if it persists.',
    'dizziness':          'Dizziness can be linked to low blood pressure, dehydration, or an abnormal heart rate. Rest, hydrate, and monitor your BPM. See a doctor if it persists.',
    'fainting':           'Fainting (syncope) can result from a sudden drop in blood pressure or heart rate. This requires medical evaluation.',
    'shortness of breath': 'Shortness of breath during rest may indicate a cardiac or respiratory issue. Monitor your SpO₂ and consult a healthcare provider if it persists.',
    'irregular heartbeat': 'An irregular heartbeat (arrhythmia) should be evaluated by a doctor, especially if combined with dizziness, fatigue, or chest discomfort.',
    'heart attack':       'Heart attack symptoms include chest pain, shortness of breath, arm/jaw pain, and sweating. If you suspect a heart attack, call emergency services immediately.',

    // ── General / Greetings ─────────────────────────────────────────────
    'hello':   'Hello! I\'m your Cardiac AI. Ask me about your heart rate, HRV, blood pressure, SpO₂, recovery, or any heart health topic!',
    'hi':      `Hi! Your heart rate is currently ${bpm} BPM. What would you like to know about your cardiovascular health?`,
    'hey':     'Hey! Ask me anything about your heart health — BPM, HRV, blood pressure, oxygen levels, and more.',
    'help':    'I can help with: heart rate & zones, HRV, blood pressure, SpO₂, recovery score, exercise tips, stress management, and cardiac warning signs. Just ask!',
    'what can you do': 'I can answer questions about your BPM, heart rate zones, HRV, blood pressure, SpO₂, recovery score, activity impact, stress, and general heart health guidance.',
    'tips':    `Today's cardiac tips: your BPM is ${bpm} (${zone} zone), HRV is ${hrv}ms (great recovery), and SpO₂ is ${o2}% (excellent). Stay hydrated and keep up the activity streak!`,
    'advice':  'For a healthy heart: exercise regularly, manage stress, sleep 7–9 hours, stay hydrated, and monitor your metrics consistently. Your numbers look great today!',
  };

  return (
    <>
      <style>{`
        @keyframes ecgDraw {
          0% { stroke-dashoffset: 800; opacity: 1; }
          70% { stroke-dashoffset: 0; opacity: 1; }
          85% { stroke-dashoffset: 0; opacity: 0.3; }
          100% { stroke-dashoffset: 800; opacity: 0; }
        }
        @keyframes heartPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 24px rgba(239,68,68,0.45)); }
          50% { transform: scale(1.07); filter: drop-shadow(0 0 44px rgba(239,68,68,0.75)); }
        }
        @keyframes lungBreath {
          0%, 100% { transform: scale(1) translateY(0); filter: drop-shadow(0 0 16px rgba(96,165,250,0.35)); }
          50% { transform: scale(1.05) translateY(-4px); filter: drop-shadow(0 0 30px rgba(96,165,250,0.6)); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes bpmPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.14); color: #fca5a5; }
          100% { transform: scale(1); color: #ffffff; }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes streakPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.1) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        .metric-card { transition: all 0.3s ease; }
        .metric-card:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 40px rgba(0,60,180,0.35) !important; }
        .organ-card { transition: all 0.3s ease; }
        .organ-card:hover { transform: translateY(-4px) scale(1.01) !important; }
        .track-btn { transition: all 0.2s ease; }
        .track-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 10px 30px rgba(99,102,241,0.5) !important; }
        .heart-log-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(239,68,68,0.45) !important; }
        .activity-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(100,180,255,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .activity-input:focus { border-color:rgba(239,68,68,0.6); background:rgba(255,255,255,0.11); box-shadow:0 0 0 3px rgba(239,68,68,0.12); }
        .activity-input::placeholder { color:rgba(180,210,255,0.35); }
        .activity-range { width:100%; accent-color:#ef4444; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100,180,255,0.2); border-radius: 10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: '0' }}>

          {/* Header */}
          <div style={{ background: 'rgba(8,20,50,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(100,180,255,0.12)', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.4s ease' }}>
            <div>
              <h1 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '22px', margin: 0, letterSpacing: '-0.3px' }}>Cardiovascular Monitor</h1>
              <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '2px 0 0' }}>Real-time cardiac health tracking</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: `${zoneColor}22`, border: `1px solid ${zoneColor}55`, color: zoneColor, letterSpacing: '0.05em', textTransform: 'uppercase' as const, transition: 'all 0.5s' }}>
                {zone} Zone
              </div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'ringPulse 1.5s ease-out infinite' }} />
              <span style={{ color: 'rgba(180,210,255,0.6)', fontSize: '12px' }}>Live</span>
              <button className="heart-log-btn" onClick={() => setShowLogModal(true)}
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: '12px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(239,68,68,0.35)', transition: 'all .2s ease', letterSpacing: '0.02em', marginLeft: '4px' }}>
                Log Activity
              </button>
            </div>
          </div>

          {/* Main Grid */}
          <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 320px', gap: '20px', minHeight: 'calc(100vh - 73px)' }}>

            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* BPM Hero Card */}
              <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '28px', position: 'relative', overflow: 'hidden', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }} className="metric-card">
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(239,68,68,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>Heart Rate</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span key={bpmKey} style={{ fontSize: '64px', fontWeight: 900, color: '#fff', lineHeight: 1, display: 'inline-block', animation: 'bpmPop 0.35s ease' }}>{bpm}</span>
                      <span style={{ fontSize: '18px', color: 'rgba(180,210,255,0.5)', fontWeight: 500 }}>bpm</span>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: zoneColor, boxShadow: `0 0 6px ${zoneColor}`, transition: 'background 0.5s' }} />
                      <span style={{ color: 'rgba(180,210,255,0.6)', fontSize: '13px' }}>{zone} — Normal resting rate</span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', animation: 'ringPulse 1.8s ease-out infinite' }} />
                    <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', background: 'rgba(239,68,68,0.18)', animation: 'ringPulse 1.8s ease-out infinite 0.4s' }} />
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                  <ECGLine color="#ef4444" width={360} height={52} />
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                {[
                  { label: 'HRV',            value: hrv,              unit: 'ms',   color: '#22c55e', desc: 'Heart Rate Variability' },
                  { label: 'SpO₂',           value: o2,               unit: '%',    color: '#38bdf8', desc: 'Oxygen Saturation' },
                  { label: 'Blood Pressure', value: `${bp.sys}/${bp.dia}`, unit: 'mmHg', color: '#a78bfa', desc: 'Systolic / Diastolic' },
                  { label: 'Recovery',       value: recovery,          unit: '%',    color: '#f59e0b', desc: 'Recovery Score' },
                ].map((stat, i) => (
                  <div key={stat.label} style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: `1px solid ${stat.color}22`, borderRadius: '16px', padding: '18px 20px', animation: mounted ? `fadeUp 0.5s ease ${0.15 + i * 0.07}s both` : 'none', cursor: 'default' }} className="metric-card">
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{stat.label}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stat.value}</span>
                      <span style={{ fontSize: '13px', color: stat.color, fontWeight: 600 }}>{stat.unit}</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '4px 0 0' }}>{stat.desc}</p>
                    <div style={{ marginTop: '10px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: '2px', background: stat.color, width: `${typeof stat.value === 'number' ? Math.min(stat.value, 100) : 70}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${stat.color}` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Streak Card */}
              <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '18px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '18px', animation: mounted ? 'fadeUp 0.5s ease 0.28s both' : 'none', position: 'relative', overflow: 'hidden' }} className="metric-card">
                <div style={{ position:'absolute', right:'-20px', top:'-20px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(251,191,36,0.07)', filter:'blur(28px)', pointerEvents:'none' }} />
                <div style={{ position:'relative', flexShrink:0 }}>
                  <img src={streakImg} alt="Streak" style={{ width:64, height:64, objectFit:'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.4s both' : 'none', filter:'drop-shadow(0 0 14px rgba(251,191,36,0.6))' }} />
                  <div style={{ position:'absolute', bottom:-2, right:-4, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'2px solid rgba(8,20,50,0.9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 10px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.5s ease 0.65s both' : 'none' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Active Streak</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
                    <span style={{ color:'#fbbf24', fontWeight:900, fontSize:'28px', lineHeight:1 }}>7</span>
                    <span style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', fontWeight:500 }}>days in a row</span>
                  </div>
                  <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'11px', margin:'3px 0 0' }}>Activity logged every day this week</p>
                </div>
                <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
                  {Array.from({length:7}).map((_,i) => (
                    <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#fbbf24', boxShadow:'0 0 6px rgba(251,191,36,0.6)', transition:`all 0.3s ease ${i*0.05}s` }} />
                  ))}
                </div>
              </div>

              {/* Mood Banner */}
              <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(14,165,233,0.35) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '18px', padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: mounted ? 'fadeUp 0.5s ease 0.5s both' : 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-30px', left: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                <div>
                  <h3 style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '16px', margin: '0 0 4px' }}>Reset & Relax</h3>
                  <p style={{ color: 'rgba(180,210,255,0.6)', fontSize: '12px', margin: 0, maxWidth: '260px' }}>Take a moment to unwind with guided breathing exercises and mindfulness tips.</p>
                </div>
                <button className="track-btn" onClick={() => navigate('/mood')}
                  style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', border: 'none', borderRadius: '12px', padding: '12px 22px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' as const, boxShadow: '0 6px 20px rgba(99,102,241,0.35)', letterSpacing: '0.02em', flexShrink: 0, marginLeft: '16px' }}>
                  Track My Mood
                </button>
              </div>
            </div>

            {/* CENTER COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                {/* Heart Card */}
                <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '24px 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '14px', animation: mounted ? 'fadeUp 0.5s ease 0.2s both' : 'none', cursor: 'default', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '100px', background: 'rgba(239,68,68,0.1)', filter: 'blur(35px)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <img src={heartImg} alt="Heart" style={{ width: '160px', height: '160px', objectFit: 'contain', animation: 'heartPulse 1.8s ease-in-out infinite', filter: 'drop-shadow(0 0 28px rgba(239,68,68,0.55))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Heart</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                      <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>Normal</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>{bpm} bpm</p>
                  </div>
                </div>

                {/* Lungs Card */}
                <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '20px', padding: '24px 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '14px', animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none', cursor: 'default', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '100px', background: 'rgba(96,165,250,0.1)', filter: 'blur(35px)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <img src={lungsImg} alt="Lungs" style={{ width: '160px', height: '160px', objectFit: 'contain', animation: 'lungBreath 3.5s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(96,165,250,0.5))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Lungs</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                      <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>Normal</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>SpO₂ {o2}%</p>
                  </div>
                </div>
              </div>

              {/* Weekly BPM Trend */}
              <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px', animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Weekly Trend</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Heart Rate Overview</p>
                  </div>
                  <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>Last 7 days</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
                  {[68, 72, 76, 74, 80, 78, bpm].map((val, i) => {
                    const h = ((val - 60) / 40) * 80;
                    const isToday = i === 6;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '100%', height: `${h}px`, borderRadius: '4px 4px 2px 2px', background: isToday ? 'linear-gradient(180deg, #ef4444, #7f1d1d)' : 'rgba(100,180,255,0.18)', border: isToday ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(100,180,255,0.1)', transition: 'height 0.8s cubic-bezier(.4,0,.2,1)', boxShadow: isToday ? '0 0 12px rgba(239,68,68,0.3)' : 'none' }} />
                        <span style={{ fontSize: '9px', color: isToday ? '#ef4444' : 'rgba(180,210,255,0.3)', fontWeight: isToday ? 700 : 400 }}>
                          {['M', 'T', 'W', 'T', 'F', 'S', 'T'][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px' }}>
                  <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px' }}>Avg: 75 bpm</span>
                  <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px' }}>Peak: 80 bpm</span>
                </div>
              </div>

              {/* Gauges */}
              <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none' }}>
                <CircularGauge value={bpm} max={180} label="BPM" color="#ef4444" size={100} />
                <div style={{ width: '1px', height: '60px', background: 'rgba(100,180,255,0.1)' }} />
                <CircularGauge value={hrv} max={100} label="HRV ms" color="#22c55e" size={100} />
                <div style={{ width: '1px', height: '60px', background: 'rgba(100,180,255,0.1)' }} />
                <CircularGauge value={o2} max={100} label="SpO₂ %" color="#38bdf8" size={100} />
              </div>
            </div>

            {/* RIGHT COLUMN — Chat */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Cardiac AI"
                moduleKey="heart"
                responses={chatResponses}
                defaultResponse="Your cardiovascular metrics look healthy. Keep up the good work."
                autoMessages={[{ text: `Heart rate is within normal resting range. HRV is strong at ${hrv}ms.`, delay: 1500 }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Log Activity Modal */}
      {showLogModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,5,20,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .25s ease' }} onClick={() => setShowLogModal(false)}>
          <div style={{ background:'#0d1a38', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'22px', padding:'36px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', animation:'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
              <div style={{ width:40, height:40, borderRadius:'12px', background:'rgba(239,68,68,0.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'20px' }}>🏃</span>
              </div>
              <div>
                <h4 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'18px', margin:0 }}>Log Activity</h4>
                <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>Record your workout or activity</p>
              </div>
            </div>
            <form onSubmit={handleLogSubmit}>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Activity Type</label>
                <select className="activity-input" value={activityData.type} onChange={e => setActivityData({...activityData, type: e.target.value})} style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.25)', borderRadius:'10px', color:'#e0f0ff', fontSize:'14px', outline:'none' }}>
                  {['Running','Walking','Cycling','Swimming','Gym','Yoga','HIIT','Other'].map(t => <option key={t} value={t} style={{ background:'#0d1a38' }}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Duration (minutes)</label>
                <input type="number" className="activity-input" placeholder="e.g. 30" value={activityData.duration} onChange={e => setActivityData({...activityData, duration: e.target.value})} required />
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>
                  Intensity — <span style={{ color:'#ef4444' }}>{activityData.intensity} / 10</span>
                </label>
                <input type="range" className="activity-range" min="1" max="10" value={activityData.intensity} onChange={e => setActivityData({...activityData, intensity: e.target.value})} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                  <span style={{ color:'rgba(180,210,255,0.3)', fontSize:'10px' }}>Light</span>
                  <span style={{ color:'rgba(180,210,255,0.3)', fontSize:'10px' }}>Max Effort</span>
                </div>
              </div>
              <div style={{ marginBottom:'24px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Notes (optional)</label>
                <input type="text" className="activity-input" placeholder="e.g. Morning run, felt great" value={activityData.notes} onChange={e => setActivityData({...activityData, notes: e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button type="submit" disabled={saving}
                  style={{ flex:1, padding:'13px', background: saving ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:'0 4px 18px rgba(239,68,68,0.35)', transition:'all .2s' }}
                  onMouseEnter={e => { if(!saving){ e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
                  {saving ? 'Saving...' : 'Save Activity'}
                </button>
                <button type="button" onClick={() => setShowLogModal(false)}
                  style={{ flex:1, padding:'13px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:'12px', color:'rgba(180,210,255,0.8)', fontWeight:700, fontSize:'14px', cursor:'pointer', transition:'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.07)'; }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}