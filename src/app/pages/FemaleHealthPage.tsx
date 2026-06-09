import { useState, useEffect, useRef, memo, JSX } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useResponsive } from '../hooks/useResponsive';
import { toast } from 'sonner';
import { databases, DATABASE_ID, COLLECTIONS, ID, account } from '../../lib/appwrite';


const femaleHealthAvatar  = '/assets/femalehealthavatar.png';
const femaleSymbol        = '/assets/female_symbol.png';
const femalesIcon         = '/assets/females.png';
const follicularImg       = '/assets/follicular.png';
const cycleImg            = '/assets/cycle.png';
const datecalendarImg     = '/assets/datecalendartracker.png';
const ovulationImg        = '/assets/ovulation.png';
const streakImg           = '/assets/streak.png';

/* ── Types ──────────────────────────────────────────────────────── */
type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
type TrackingMode = 'period' | 'pregnancy' | 'nutrition';

interface PeriodLog {
  date: string;
  flow: 'light' | 'medium' | 'heavy';
  symptoms: string[];
  mood: string;
  note: string;
}

interface NutritionEntry {
  name: string;
  calories: number;
  iron: number;
  folate: number;
  calcium: number;
  time: string;
}

interface ChatMessage {
  id: number;
  text: string;
  isAI: boolean;
  time: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
// const TODAY = new Date().toISOString().split('T')[0];
const getLocalDate = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const TODAY = getLocalDate();

function getDayOfCycle(lastPeriodDate: string): number {
  const start = new Date(lastPeriodDate);
  const today = new Date(TODAY);
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getPhase(day: number, cycleLength = 28): { phase: Phase; label: string; color: string; emoji: string; description: string } {
  if (day <= 5)  return { phase: 'menstrual',  label: 'Menstrual',  color: '#f43f5e', emoji: '🩸', description: 'Your body is shedding the uterine lining. Rest, stay warm, and eat iron-rich foods.' };
  if (day <= 13) return { phase: 'follicular', label: 'Follicular', color: '#f59e0b', emoji: '🌱', description: 'Estrogen rises, energy improves. Great time for new projects and intense workouts.' };
  if (day <= 16) return { phase: 'ovulation',  label: 'Ovulation',  color: '#22c55e', emoji: '✨', description: 'Fertility peaks. You may feel more social, confident, and energetic.' };
  return           { phase: 'luteal',      label: 'Luteal',     color: '#a78bfa', emoji: '🌙', description: 'Progesterone rises. You may notice PMS symptoms. Prioritize self-care and magnesium-rich foods.' };
}

function getPregnancyWeekInfo(week: number) {
  if (week <= 13) return { trimester: '1st Trimester', tip: 'Take folic acid daily, stay hydrated, and get plenty of rest. Morning sickness is common — try ginger tea.', color: '#f59e0b' };
  if (week <= 26) return { trimester: '2nd Trimester', tip: 'Energy often returns! Focus on calcium and iron intake. Start light prenatal exercises.', color: '#22c55e' };
  return           { trimester: '3rd Trimester', tip: 'Baby is growing fast. Rest often, track movements, and prepare your birth plan.', color: '#a78bfa' };
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTimeStr() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
const toLocalDateInputValue = (dateString: string) => {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ══════════════════════════════════════════════════════════════════
   FemaleHealthPage
══════════════════════════════════════════════════════════════════ */
export function FemaleHealthPage() {
  const { isMobile, isTablet } = useResponsive();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TrackingMode>('period');
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Period State ─────────────────────────────────────────────── */
  const [lastPeriodDate, setLastPeriodDate] = useState(TODAY);
  const [cycleLength, setCycleLength]       = useState(28);
  const [periodLogs, setPeriodLogs]         = useState<PeriodLog[]>([
    { date: '2025-06-15', flow: 'heavy',  symptoms: ['cramps', 'bloating'], mood: 'tired',    note: 'Day 1, rough start' },
    { date: '2025-06-16', flow: 'heavy',  symptoms: ['cramps'],             mood: 'tired',    note: '' },
    { date: '2025-06-17', flow: 'medium', symptoms: ['bloating'],           mood: 'okay',     note: 'Feeling a bit better' },
    { date: '2025-06-18', flow: 'medium', symptoms: [],                     mood: 'okay',     note: '' },
    { date: '2025-06-19', flow: 'light',  symptoms: [],                     mood: 'good',     note: 'Almost done' },
  ]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [newLog, setNewLog] = useState<PeriodLog>({ date: TODAY, flow: 'medium', symptoms: [], mood: 'okay', note: '' });
  const [saving, setSaving] = useState(false);

  /* ── Pregnancy State ──────────────────────────────────────────── */
  const [pregnancyWeek, setPregnancyWeek]           = useState(24);
  const [isPregnant, setIsPregnant]                 = useState(false);
  const [dueDate, setDueDate]                       = useState('');
  const [babyMovements, setBabyMovements]           = useState(8);

  /* ── Nutrition State ──────────────────────────────────────────── */
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>([
    { name: 'Spinach Omelette',   calories: 320, iron: 4.2,  folate: 58,  calcium: 120, time: '8:00 AM' },
    { name: 'Lentil Soup',        calories: 280, iron: 6.6,  folate: 180, calcium: 38,  time: '12:30 PM' },
    { name: 'Greek Yogurt',       calories: 150, iron: 0.2,  folate: 12,  calcium: 200, time: '3:00 PM' },
    { name: 'Salmon & Broccoli',  calories: 420, iron: 1.8,  folate: 82,  calcium: 62,  time: '7:00 PM' },
  ]);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [newNutrition, setNewNutrition] = useState<NutritionEntry>({ name: '', calories: 0, iron: 0, folate: 0, calcium: 0, time: '' });

  /* ── Chat State ───────────────────────────────────────────────── */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMsgId, setChatMsgId] = useState(100);

  /* ── Computed ─────────────────────────────────────────────────── */
  const dayOfCycle   = getDayOfCycle(lastPeriodDate);
  const phaseInfo    = getPhase(dayOfCycle, cycleLength);
  const nextPeriod   = new Date(new Date(lastPeriodDate).getTime() + cycleLength * 24 * 60 * 60 * 1000);
  const daysUntilNext = Math.ceil((nextPeriod.getTime() - new Date(TODAY).getTime()) / (1000 * 60 * 60 * 24));
  const pregnancyInfo = getPregnancyWeekInfo(pregnancyWeek);
  const totalIron    = nutritionEntries.reduce((s, e) => s + e.iron, 0);
  const totalFolate  = nutritionEntries.reduce((s, e) => s + e.folate, 0);
  const totalCalcium = nutritionEntries.reduce((s, e) => s + e.calcium, 0);
  const totalCals    = nutritionEntries.reduce((s, e) => s + e.calories, 0);

  useEffect(() => {
  loadPeriodLogs();
}, []);
const loadPeriodLogs = async () => {
  try {
    const user = await account.get();

    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.female_health
    );

    const mapped: PeriodLog[] = res.documents
      .filter(d => d.userID === user.$id)
      .map(d => ({
        date: d.date,                  // already YYYY-MM-DD
        flow: d.flow || 'light',
        symptoms: d.symptoms || [],
        mood: d.mood || '',
        note: d.note || ''
      }));

    setPeriodLogs(mapped);
  } catch (err) {
    console.error('❌ Load period logs error:', err);
  }
};
// const latestPeriodDate = periodLogs[0]
//   ? toLocalDateInputValue(periodLogs[0].date)
//   : TODAY;


useEffect(() => {
  if (!periodLogs.length) {
    setLastPeriodDate(TODAY);
    return;
  }

  const latestPeriodLog = [...periodLogs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const latestPeriodDate = latestPeriodLog
    ? `${new Date(latestPeriodLog.date).getFullYear()}-${String(new Date(latestPeriodLog.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(latestPeriodLog.date).getDate()).padStart(2, '0')}`
    : TODAY;

  setLastPeriodDate(latestPeriodDate);
}, [periodLogs]);

// const handleAddPeriodLog = async (e: React.FormEvent) => {
//   e.preventDefault();
//   setSaving(true);

//   try {
//     const user = await account.get();

//     const doc = await databases.createDocument(
//       DATABASE_ID,
//       COLLECTIONS.female_health,
//       ID.unique(),
//       {
//         userID: user.$id,
//         date: newPeriod.date,     // ✅ date-only
//         flow: newPeriod.flow,
//         symptoms: newPeriod.symptoms,
//         mood: newPeriod.mood || '',
//         note: newPeriod.note || ''
//       }
//     );

//     console.log('✅ Period log saved:', doc);

//     toast.success('Period log saved!');

//     // reset form
//     setNewPeriod({
//       date: new Date().toISOString().split('T')[0],
//       flow: 'light',
//       symptoms: [],
//       mood: '',
//       note: ''
//     });

//     // reload logs
//     await loadPeriodLogs();

//   } catch (err) {
//     console.error('❌ Save period error:', err);
//     toast.error('Failed to save period log');
//   } finally {
//     setSaving(false);
//   }
// };

// console.log(periodLogs.map(log => log.date)); 


  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      addAIMessage(`${phaseInfo.emoji} You're on Day ${dayOfCycle} of your cycle — ${phaseInfo.label} phase. ${phaseInfo.description} Ask me anything about your health!`);
    }, 1200);
    setTimeout(() => {
      addAIMessage(`💊 Today's female nutrition check: Iron ${totalIron.toFixed(1)}mg / 18mg goal · Folate ${totalFolate}mcg / 400mcg goal · Calcium ${totalCalcium}mg / 1000mg goal.`);
    }, 3000);
  }, []);

  const [userHasSent, setUserHasSent] = useState(false);

  useEffect(() => {
    if (userHasSent) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping, userHasSent]);

  const addAIMessage = (text: string) => {
    setChatMsgId(id => {
      const newId = id + 1;
      setChatMessages(prev => [...prev, { id: newId, text, isAI: true, time: getTimeStr() }]);
      return newId;
    });
  };

  /* ── Chat responses ───────────────────────────────────────────── */
  const chatResponses: Record<string, string> = {
    'period late':      `Your period is ${daysUntilNext < 0 ? Math.abs(daysUntilNext) + ' days late' : 'expected in ' + daysUntilNext + ' days'}. If it's more than 5 days late, consider taking a pregnancy test or speaking with your doctor.`,
    'late':             `If your period is late, don't panic. You are currently on day ${dayOfCycle} of your cycle (${cycleLength}-day average). Stress, illness, travel, and weight fluctuations can all cause delays.`,
    'period':           `You're on day ${dayOfCycle} of your cycle, currently in the ${phaseInfo.label} phase. ${phaseInfo.description} Your next period is expected ${daysUntilNext > 0 ? 'in ' + daysUntilNext + ' days' : Math.abs(daysUntilNext) + ' days ago'}.`,
    'cycle':            `Your current cycle is ${cycleLength} days. You're on day ${dayOfCycle} — ${phaseInfo.emoji} ${phaseInfo.label} phase. ${phaseInfo.description}`,
    'ovulation':        `Based on your ${cycleLength}-day cycle, ovulation is expected around day 14. You're currently on day ${dayOfCycle}. ${dayOfCycle >= 11 && dayOfCycle <= 16 ? '⚡ You may be in your fertile window right now!' : 'Your fertile window is days 11–16.'}`,
    'fertile':          `Your fertile window is approximately days 11–16 of your cycle. You're on day ${dayOfCycle}. ${dayOfCycle >= 11 && dayOfCycle <= 16 ? '🌟 You may be fertile right now!' : 'Your next fertile window is coming up soon.'}`,
    'cramps':           'For menstrual cramps: apply a warm heating pad, try ibuprofen or naproxen, stay hydrated, and consider gentle yoga. Magnesium supplements (200–400 mg/day) can also reduce cramp severity over time.',
    'pms':              'PMS symptoms are caused by hormonal shifts in the luteal phase. Reduce salt, caffeine, and alcohol. Exercise regularly, eat magnesium-rich foods (dark chocolate, nuts, leafy greens), and practice stress management.',
    'irregular':        'Irregular periods can be caused by stress, PCOS, thyroid issues, weight changes, or perimenopause. Track your cycle consistently and consult your OB-GYN if irregularity persists for 3+ months.',
    'iron':             `Today's iron intake: ${totalIron.toFixed(1)} mg. Women need 18 mg/day (27 mg during pregnancy). ${totalIron < 18 ? 'You\'re under your goal — try adding spinach, lentils, red meat, or fortified cereals.' : 'Great job hitting your iron target!'}`,
    'folate':           `Today's folate: ${totalFolate} mcg. Women need 400 mcg/day. ${totalFolate < 400 ? 'Boost folate with dark leafy greens, beans, citrus, and fortified grains.' : 'Excellent folate intake today!'}`,
    'calcium':          `Today's calcium: ${totalCalcium} mg. Women need 1,000 mg/day. ${totalCalcium < 1000 ? 'Add dairy, fortified plant milk, almonds, or broccoli to hit your goal.' : 'Great calcium intake!'}`,
    'nutrition':        `Female nutrition snapshot today — Calories: ${totalCals} kcal · Iron: ${totalIron.toFixed(1)} mg · Folate: ${totalFolate} mcg · Calcium: ${totalCalcium} mg.`,
    'pcos':             'PCOS is a common hormonal disorder causing irregular periods, excess androgen, and small ovarian cysts. Management includes diet, exercise, metformin, and hormonal contraceptives.',
    'stress':           'Chronic stress elevates cortisol, which can suppress estrogen and disrupt ovulation — leading to irregular or missed periods. Practice mindfulness, yoga, or journaling.',
    'exercise':         `Exercise recommendations vary by cycle phase. ${phaseInfo.phase === 'menstrual' ? 'During menstruation, light yoga and walking are ideal.' : phaseInfo.phase === 'follicular' ? 'Follicular phase is great for high-intensity workouts.' : phaseInfo.phase === 'ovulation' ? 'Ovulation phase — peak strength and endurance. Go for it!' : 'Luteal phase — moderate exercise and pilates work best.'}`,
    'hormone':          'Hormones fluctuate throughout your cycle: estrogen peaks before ovulation, progesterone rises in the luteal phase, and both drop before menstruation.',
    'pregnant':         `${isPregnant ? `You're at week ${pregnancyWeek} — ${pregnancyInfo.trimester}! ${pregnancyInfo.tip}` : 'Track your pregnancy by enabling pregnancy mode. I can help with weekly milestones, nutrition needs, and symptom guidance.'}`,
    'default':          `I'm your Female Health AI. Ask me about your cycle, period symptoms, pregnancy milestones, or female nutrition needs. Try: "Is my period late?", "What to eat during luteal phase?", or "How much iron do I need?"`,
  };

  const handleChatSend = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setUserHasSent(true);
    const newId = chatMsgId + 1;
    setChatMsgId(newId);
    setChatMessages(prev => [...prev, { id: newId, text: msg, isAI: false, time: getTimeStr() }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const lower = msg.toLowerCase();
      let response = chatResponses['default'];
      for (const key of Object.keys(chatResponses)) {
        if (lower.includes(key)) { response = chatResponses[key]; break; }
      }
      addAIMessage(response);
    }, 1200 + Math.random() * 800);
  };

  /* ── Symptom toggle ───────────────────────────────────────────── */
  const toggleSymptom = (s: string) => {
    setNewLog(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s) ? prev.symptoms.filter(x => x !== s) : [...prev.symptoms, s],
    }));
  };

  // const handleAddPeriodLog = () => {
  //   if (!newLog.date) return;
  //   setPeriodLogs(prev => [...prev, newLog].sort((a, b) => a.date.localeCompare(b.date)));
  //   toast.success('Period day logged!');
  //   setShowPeriodModal(false);
  //   setNewLog({ date: TODAY, flow: 'medium', symptoms: [], mood: 'okay', note: '' });
  // };
  const handleAddPeriodLog = async (e?: React.FormEvent) => {
  if (e) e.preventDefault();
  if (!newLog.date) return;

  setSaving(true);

  try {
    const user = await account.get();

    // ✅ Save to Appwrite
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.female_health,
      ID.unique(),
      {
        userID: user.$id,
        date: newLog.date,
        flow: newLog.flow,
        symptoms: newLog.symptoms,
        mood: newLog.mood,
        note: newLog.note
      }
    );

    console.log('✅ Saved:', doc);

    // ✅ Update UI instantly (like your current behavior)
    setPeriodLogs(prev =>
      [...prev, newLog].sort((a, b) => a.date.localeCompare(b.date))
    );

    toast.success('Period day logged!');

    setShowPeriodModal(false);

    // ✅ Reset form
    setNewLog({
      date: TODAY,
      flow: 'medium',
      symptoms: [],
      mood: 'okay',
      note: ''
    });

  } catch (err) {
    console.error('❌ Save error:', err);
    toast.error('Failed to save period log');
  } finally {
    setSaving(false);
  }
};


  const handleAddNutrition = () => {
    if (!newNutrition.name) return;
    const now = new Date();
    const h = now.getHours();
    const time = `${h}:${String(now.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    setNutritionEntries(prev => [...prev, { ...newNutrition, time }]);
    toast.success(`${newNutrition.name} logged!`);
    setShowNutritionModal(false);
    setNewNutrition({ name: '', calories: 0, iron: 0, folate: 0, calcium: 0, time: '' });
  };

  /* ── Calendar grid ────────────────────────────────────────────── */
  const buildCalendar = () => {
    const start = new Date(lastPeriodDate);
    const days: { date: string; type: string; day: number }[] = [];
    for (let i = -7; i < cycleLength + 7; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().split('T')[0];
      const dayNum = i + 1;
      const isToday = ds === TODAY;
      const isPeriod = dayNum >= 1 && dayNum <= 5;
      const isOvulation = dayNum >= 13 && dayNum <= 16;
      const isFertile = dayNum >= 11 && dayNum <= 16;
      const isPredicted = dayNum === cycleLength + 1;
      days.push({
        date: ds,
        type: isToday ? 'today' : isPeriod ? 'period' : isOvulation ? 'ovulation' : isFertile ? 'fertile' : isPredicted ? 'predicted' : 'none',
        day: dayNum,
      });
    }
    return days;
  };

  /* ── Chart data ───────────────────────────────────────────────── */
  const cycleChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      { label: 'Energy Level', data: [40, 70, 85, 60], borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', tension: 0.4, fill: true },
      { label: 'Mood Score',   data: [50, 75, 80, 55], borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', tension: 0.4, fill: true },
    ],
  };

  const nutritionChart = {
    labels: nutritionEntries.map(e => e.name.split(' ')[0]),
    datasets: [
      { label: 'Iron (mg)',        data: nutritionEntries.map(e => e.iron),          backgroundColor: 'rgba(244,63,94,0.7)',   borderRadius: 8 },
      { label: 'Folate (mcg÷10)', data: nutritionEntries.map(e => e.folate / 10),   backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 8 },
      { label: 'Calcium (mg÷10)', data: nutritionEntries.map(e => e.calcium / 10),  backgroundColor: 'rgba(34,197,94,0.7)',   borderRadius: 8 },
    ],
  };

  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(180,210,255,0.6)', font: { size: 10 } } },
      tooltip: { backgroundColor: 'rgba(8,20,50,0.95)', titleColor: '#fff', bodyColor: 'rgba(180,210,255,0.85)' },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(180,210,255,0.5)', font: { size: 10 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(180,210,255,0.5)', font: { size: 10 } } },
    },
  };

  /* ── Styles ───────────────────────────────────────────────────── */
  const isNarrow = isMobile || isTablet;

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)',
    borderRadius: '18px',
    padding: '20px 22px',
    transition: 'all 0.3s ease',
  };

  const accent = '#f43f5e';
  const accentGlow = 'rgba(244,63,94,0.35)';
  const SYMPTOMS = ['cramps', 'bloating', 'headache', 'fatigue', 'mood swings', 'breast tenderness', 'back pain', 'nausea'];
  const MOODS = ['😊 happy', '😐 okay', '😔 sad', '😠 irritable', '😴 tired', '😤 anxious'];
  const phases = [
    { label: 'Menstrual',  days: '1–5',   color: '#f43f5e', emoji: '🩸', active: phaseInfo.phase === 'menstrual'  },
    { label: 'Follicular', days: '6–13',  color: '#f59e0b', emoji: '🌱', active: phaseInfo.phase === 'follicular' },
    { label: 'Ovulation',  days: '13–16', color: '#22c55e', emoji: '✨', active: phaseInfo.phase === 'ovulation'  },
    { label: 'Luteal',     days: '17–28', color: '#a78bfa', emoji: '🌙', active: phaseInfo.phase === 'luteal'     },
  ];

  const cycleProgressPct = Math.min((dayOfCycle / cycleLength) * 100, 100);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes pulse-rose {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.4); }
          50%       { box-shadow: 0 0 0 12px rgba(244,63,94,0); }
        }
        @keyframes floatDrop {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes avatarPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.5), 0 0 20px rgba(167,139,250,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(244,63,94,0), 0 0 30px rgba(167,139,250,0.5); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes slideInMsg {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInMsgRight {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes heroBob {
          0%,100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 14px 30px rgba(244,63,94,0.3)); }
          40%      { transform: translateY(-10px) rotate(-1.5deg); filter: drop-shadow(0 22px 40px rgba(244,63,94,0.4)); }
          70%      { transform: translateY(-5px) rotate(1deg); }
        }
        @keyframes cycleSpin {
          0%,100% { transform: rotate(0deg) scale(1); }
          50%      { transform: rotate(6deg) scale(1.04); }
        }
        @keyframes calendarBob {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes streakPop {
          0%  { transform: scale(0) rotate(-20deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(4deg); opacity: 1; }
          100%{ transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes progressFill {
          from { width: 0%; }
        }
        @keyframes particleFly {
          0%   { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-60px) scale(0); opacity: 0; }
        }

        .fh-tab       { transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); cursor: pointer; }
        .fh-tab:hover { transform: translateY(-2px); }
        .cal-day      { transition: all 0.15s; cursor: default; }
        .cal-day:hover { transform: scale(1.15); z-index: 2; position: relative; }
        .fh-btn       { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .fh-btn:hover { opacity: 0.9; transform: translateY(-2px); }
        .sym-chip     { cursor: pointer; transition: all 0.15s; user-select: none; }
        .sym-chip:hover { transform: scale(1.05); }

        .fem-input {
          width: 100%; padding: 11px 14px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(100,180,255,0.25);
          border-radius: 12px;
          color: #e0f0ff; font-size: 13px; font-family: 'Outfit', inherit;
          box-sizing: border-box; transition: all 0.2s;
        }
        .fem-input:focus {
          outline: none; border-color: rgba(244,63,94,0.5);
          box-shadow: 0 0 0 3px rgba(244,63,94,0.1);
          background: rgba(255,255,255,0.11);
        }
        .fem-input::placeholder { color: rgba(180,210,255,0.35); }
        .fem-input option { background: #0d1a38; }

        .chat-scrollbar::-webkit-scrollbar { width: 4px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(244,63,94,0.3); border-radius: 2px; }
        .quick-q:hover { background: rgba(244,63,94,0.15) !important; transform: translateX(4px) !important; }
        .hero-card:hover { transform: translateY(-4px) scale(1.012) !important; }
        .stat-card:hover { transform: translateY(-4px) !important; }

        .particle {
          position: absolute; width: 4px; height: 4px; border-radius: 50%;
          background: #f43f5e; pointer-events: none;
          animation: particleFly 2s ease-out infinite;
        }
        .particle:nth-child(2) { animation-delay: 0.4s; background: #a78bfa; }
        .particle:nth-child(3) { animation-delay: 0.8s; background: #f59e0b; }
        .particle:nth-child(4) { animation-delay: 1.2s; background: #22c55e; }

        .phase-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2.5s ease-in-out infinite;
        }
        .avatar-ring { animation: avatarPulse 3s ease-in-out infinite; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(244,63,94,0.25); border-radius: 10px; }
      `}</style>

   <Sidebar />

      <div className="dashboard-page" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="main-content" style={{ padding: 0 }}>
        <Header />

        <div style={{ flex: 1, overflowY: 'auto', padding: isNarrow ? '16px' : '24px 28px 40px', minHeight: 'calc(100vh - 73px)', display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 340px', gap: '22px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* ══════════════════════════════════════════════════════════
              HERO SECTION
          ══════════════════════════════════════════════════════════ */}
          <div style={{
            position: 'relative', borderRadius: '24px', overflow: 'hidden',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, rgba(244,63,94,0.18) 0%, rgba(167,139,250,0.12) 50%, rgba(34,197,94,0.08) 100%)',
            border: '1px solid rgba(244,63,94,0.2)',
            boxShadow: '0 8px 48px rgba(244,63,94,0.15), 0 2px 0 rgba(255,255,255,0.05) inset',
            animation: mounted ? 'fadeUp 0.5s ease both' : 'none',
          }}>
            {/* Background glow blobs */}
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-30px', left: '30%', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: isNarrow ? 'wrap' : 'nowrap', padding: isNarrow ? '24px' : '0' }}>

              {/* Left text content */}
              <div style={{ flex: 1, padding: isNarrow ? '0' : '32px 32px 32px 36px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    position: 'relative', width: 44, height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(244,63,94,0.2)', animation: 'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', background: 'rgba(244,63,94,0.25)', animation: 'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <img src={femalesIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.7))' }} />
                    <div className="particle" style={{ bottom: '100%', left: '40%' }} />
                    <div className="particle" style={{ bottom: '90%', left: '70%' }} />
                    <div className="particle" style={{ bottom: '95%', left: '20%' }} />
                  </div>
                  <span style={{ color: 'rgba(244,63,94,0.8)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Women's Health</span>
                </div>

                <h1 style={{
                  margin: '0 0 10px',
                  fontSize: isNarrow ? '24px' : '32px',
                  fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1,
                  background: 'linear-gradient(135deg, #f9a8b8 0%, #e879a0 40%, #c084fc 70%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Female Health Tracker
                </h1>
                <p style={{ color: 'rgba(180,210,255,0.6)', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
                  Track your cycle, pregnancy, and female-specific nutrition — powered by AI.
                </p>

                {/* Quick stats row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Cycle Day', value: `Day ${dayOfCycle}`, color: phaseInfo.color, bg: `${phaseInfo.color}18` },
                    { label: 'Phase',     value: `${phaseInfo.emoji} ${phaseInfo.label}`, color: phaseInfo.color, bg: `${phaseInfo.color}12` },
                    { label: 'Next Period', value: daysUntilNext > 0 ? `${daysUntilNext}d` : 'Now', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: '10px 16px', borderRadius: '14px',
                      background: s.bg, border: `1px solid ${s.color}30`,
                      boxShadow: `0 4px 16px ${s.color}15`,
                    }}>
                      <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>{s.label}</p>
                      <p style={{ color: s.color, fontWeight: 800, fontSize: '14px', margin: 0 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: cycle progress only */}
              {!isNarrow && (
                <div style={{ flexShrink: 0, padding: '32px 36px 32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke={phaseInfo.color} strokeWidth="7"
                        strokeDasharray={`${2 * Math.PI * 34 * cycleProgressPct / 100} ${2 * Math.PI * 34 * (1 - cycleProgressPct / 100)}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${phaseInfo.color})`, transition: 'stroke-dasharray 1s ease' }} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: phaseInfo.color, fontWeight: 900, fontSize: '16px', lineHeight: 1 }}>{dayOfCycle}</span>
                      <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '8px', fontWeight: 600 }}>/ {cycleLength}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Tab Bar ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', animation: mounted ? 'fadeUp 0.5s ease 0.08s both' : 'none', flexWrap: 'wrap' }}>
            {([
              { key: 'period',    label: '🩸 Period & Cycle',  color: '#f43f5e' },
              { key: 'pregnancy', label: '🤰 Pregnancy',        color: '#a78bfa' },
              { key: 'nutrition', label: '🥗 Female Nutrition', color: '#22c55e' },
            ] as const).map(tab => (
              <button key={tab.key} className="fh-tab"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '11px 22px', borderRadius: '14px', border: 'none', fontWeight: 700, fontSize: '13px',
                  fontFamily: "'Outfit', sans-serif",
                  background: activeTab === tab.key
                    ? `linear-gradient(135deg, ${tab.color}40, ${tab.color}20)`
                    : 'rgba(255,255,255,0.05)',
                  color: activeTab === tab.key ? tab.color : 'rgba(180,210,255,0.5)',
                  boxShadow: activeTab === tab.key ? `0 4px 20px ${tab.color}30, inset 0 1px 0 ${tab.color}30, 0 0 0 1px ${tab.color}30` : 'none',
                  cursor: 'pointer',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ═══════════ PERIOD TAB ═══════════════════════════ */}
              {activeTab === 'period' && (
                <>
                  {/* Hero image cards row */}
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>
                    {/* Follicular card */}
                    <div className="hero-card" style={{
                      ...card, padding: '28px 20px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                      border: '1px solid rgba(245,158,11,0.2)', position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '140px', height: '70px', background: 'rgba(245,158,11,0.08)', filter: 'blur(28px)', borderRadius: '50%', pointerEvents: 'none' }} />
                      <img src={follicularImg} alt="Follicular" style={{ width: 110, height: 110, objectFit: 'contain', animation: 'heroBob 4.8s ease-in-out infinite', filter: 'drop-shadow(0 8px 18px rgba(245,158,11,0.3))' }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>Follicular Phase</p>
                        <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, margin: '0 0 2px' }}>Days 6–13</p>
                        <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', margin: 0 }}>Rising energy</p>
                      </div>
                    </div>

                    {/* Ovulation card */}
                    <div className="hero-card" style={{
                      ...card, padding: '28px 20px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                      border: '1px solid rgba(34,197,94,0.2)', position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '140px', height: '70px', background: 'rgba(34,197,94,0.08)', filter: 'blur(28px)', borderRadius: '50%', pointerEvents: 'none' }} />
                      <img src={ovulationImg} alt="Ovulation" style={{ width: 110, height: 110, objectFit: 'contain', animation: 'cycleSpin 5.5s ease-in-out infinite', filter: 'drop-shadow(0 8px 18px rgba(34,197,94,0.35))' }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>Ovulation Phase</p>
                        <p style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600, margin: '0 0 2px' }}>Days 13–16</p>
                        <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', margin: 0 }}>Peak fertility</p>
                      </div>
                    </div>

                    {/* Streak card */}
                    <div className="hero-card" style={{
                      ...card, padding: '28px 20px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                      border: '1px solid rgba(251,191,36,0.22)', position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '140px', height: '70px', background: 'rgba(251,191,36,0.07)', filter: 'blur(28px)', borderRadius: '50%', pointerEvents: 'none' }} />
                      <div style={{ position: 'relative' }}>
                        <img src={streakImg} alt="Streak" style={{ width: 100, height: 100, objectFit: 'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.4s both' : 'none', filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }} />
                        <div style={{ position: 'absolute', bottom: 4, right: -4, width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: '3px solid rgba(8,20,50,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.6s ease 0.7s both' : 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px' }}>Logging Streak</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 5px #fbbf24' }} />
                          <span style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 600 }}>{periodLogs.length} days logged</span>
                        </div>
                        <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', margin: '3px 0 0' }}>Keep it up!</p>
                      </div>
                    </div>
                  </div>

                  {/* Phase Timeline */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.15s both' : 'none', boxShadow: `0 8px 32px rgba(244,63,94,0.1)` }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Current Phase</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '16px', margin: '0 0 18px' }}>Cycle Phase Timeline</p>

                    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
                      {phases.map((p, idx) => (
                        <div key={p.label}
                          className={p.active ? 'phase-shimmer' : ''}
                          style={{
                            padding: '16px 12px', borderRadius: '16px', textAlign: 'center',
                            background: p.active ? `${p.color}20` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${p.active ? p.color + '50' : 'rgba(255,255,255,0.06)'}`,
                            boxShadow: p.active ? `0 0 24px ${p.color}25, inset 0 1px 0 ${p.color}20` : 'none',
                            transition: 'all 0.4s ease',
                            animation: mounted ? `fadeUp 0.5s ease ${0.1 + idx * 0.08}s both` : 'none',
                          }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px', animation: p.active ? 'floatDrop 2.5s ease-in-out infinite' : 'none' }}>{p.emoji}</div>
                          <p style={{ color: p.active ? p.color : 'rgba(180,210,255,0.45)', fontWeight: 700, fontSize: '12px', margin: '0 0 2px' }}>{p.label}</p>
                          <p style={{ color: 'rgba(180,210,255,0.3)', fontSize: '10px', margin: 0 }}>Days {p.days}</p>
                          {p.active && <div style={{ marginTop: '8px', width: '24px', height: '3px', borderRadius: '2px', background: p.color, margin: '8px auto 0', boxShadow: `0 0 8px ${p.color}` }} />}
                        </div>
                      ))}
                    </div>

                    {/* Phase description */}
                    <div style={{
                      padding: '16px', background: `${phaseInfo.color}12`,
                      border: `1px solid ${phaseInfo.color}30`, borderRadius: '14px',
                      animation: mounted ? 'fadeUp 0.5s ease 0.5s both' : 'none',
                    }}>
                      <p style={{ color: phaseInfo.color, fontWeight: 700, fontSize: '13px', margin: '0 0 5px' }}>{phaseInfo.emoji} {phaseInfo.label} Phase — Day {dayOfCycle}</p>
                      <p style={{ color: 'rgba(180,210,255,0.7)', fontSize: '12px', margin: 0, lineHeight: '1.65' }}>{phaseInfo.description}</p>
                    </div>
                  </div>

                  {/* Calendar Tracker */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none', boxShadow: '0 8px 40px rgba(34,197,94,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Cycle Calendar</p>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Period & Fertile Window</p>
                      </div>
                      <button className="fh-btn" onClick={() => setShowPeriodModal(true)}
                        style={{ padding: '10px 18px', background: `linear-gradient(135deg, ${accent}, #e11d48)`, border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: `0 4px 18px ${accentGlow}`, fontFamily: "'Outfit', sans-serif" }}>
                        + Log Day
                      </button>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      {[
                        { color: '#f43f5e', label: 'Period' },
                        { color: '#f59e0b', label: 'Fertile' },
                        { color: '#22c55e', label: 'Ovulation' },
                        { color: '#60a5fa', label: 'Today' },
                        { color: '#a78bfa', label: 'Predicted' },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}80` }} />
                          <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '10px' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
                      {['S','M','T','W','T','F','S'].map((d, i) => (
                        <div key={i} style={{ textAlign: 'center', color: 'rgba(180,210,255,0.3)', fontSize: '9px', fontWeight: 700, padding: '4px 0', letterSpacing: '0.05em' }}>{d}</div>
                      ))}
                      {(() => {
                        const start = new Date(lastPeriodDate + 'T00:00:00');
                        const startDay = start.getDay();
                        const cells: JSX.Element[] = [];
                        for (let p = 0; p < startDay; p++) cells.push(<div key={`pad-${p}`} />);
                        for (let i = 0; i < 35; i++) {
                          const d = new Date(start.getTime() + i * 86400000);
                          const ds = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0');

                          const dayNum = i + 1;
                          const isToday = ds === TODAY;
                          // const isPeriod = dayNum >= 1 && dayNum <= 5;
                          const logForDay = periodLogs.find(l => l.date === ds);
                          const isPeriod = logForDay ? logForDay.date : dayNum >= 1 && dayNum <= 5;
                          const isOvulation = dayNum === 14;
                          const isFertile = dayNum >= 12 && dayNum <= 16 && !isOvulation;
                          const isPredicted = dayNum === cycleLength + 1;
                          const hasLog = periodLogs.some(l => l.date === ds);

                          let bg = 'rgba(255,255,255,0.04)';
                          let col = 'rgba(180,210,255,0.35)';
                          let ring = 'transparent';
                          if (isPeriod)    { bg = 'rgba(244,63,94,0.25)';  col = '#f43f5e'; }
                          if (isFertile)   { bg = 'rgba(245,158,11,0.2)';  col = '#f59e0b'; }
                          if (isOvulation) { bg = 'rgba(34,197,94,0.25)';  col = '#22c55e'; }
                          if (isPredicted) { bg = 'rgba(167,139,250,0.2)'; col = '#a78bfa'; }
                          if (isToday)     { bg = 'rgba(96,165,250,0.3)';  col = '#60a5fa'; ring = '#60a5fa'; }

                          cells.push(
                            <div key={ds} className="cal-day"
                              style={{ textAlign: 'center', padding: '7px 2px', borderRadius: '9px', background: bg, border: `1px solid ${ring === 'transparent' ? 'transparent' : ring + '60'}`, position: 'relative' }}>
                              <span
                              style={{
                                color: col,
                                fontWeight: isToday ? 800 : 600,
                                fontSize: '11px',
                                background: isToday ? 'rgba(96,165,250,0.25)' : 'transparent',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                display: 'inline-block',
                                minWidth: '22px'
                              }}
                            >
                              {d.getDate()}
                            </span>
                            {isToday && (
                              <div style={{
                                fontSize: '8px',
                                color: '#60a5fa',
                                marginTop: '1px'
                              }}>
                                Today
                              </div>
                            )}

                              {hasLog && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f43f5e', margin: '1px auto 0', boxShadow: '0 0 5px #f43f5e' }} />}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>

                    {/* Cycle settings */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ display: 'block', color: 'rgba(180,210,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '5px' }}>Last Period Start</label>
                        <input type="date" className="fem-input" value={lastPeriodDate} onChange={e => setLastPeriodDate(e.target.value)} />
                      </div>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ display: 'block', color: 'rgba(180,210,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '5px' }}>Cycle Length (days)</label>
                        <input type="number" className="fem-input" value={cycleLength} min={21} max={45} onChange={e => setCycleLength(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  {/* Period Log History */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.24s both' : 'none' }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Period Log</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 14px' }}>Logged Days</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {periodLogs.slice().reverse().map((log, i) => (
                        <div key={i}
                          style={{
                            padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(244,63,94,0.12)', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                            animation: mounted ? `fadeUp 0.4s ease ${i * 0.06}s both` : 'none',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.06)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                          <div style={{ minWidth: '80px' }}>
                            <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '10px', margin: '0 0 2px', fontWeight: 600 }}>
                            {new Date(log.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '14px' }}>{log.flow === 'heavy' ? '🔴' : log.flow === 'medium' ? '🟠' : '🟡'}</span>
                              <span style={{ color: log.flow === 'heavy' ? '#f43f5e' : log.flow === 'medium' ? '#f59e0b' : '#fbbf24', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>{log.flow}</span>
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {log.symptoms.map(s => (
                                <span key={s} style={{ padding: '2px 8px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '20px', color: '#f43f5e', fontSize: '10px', fontWeight: 600 }}>{s}</span>
                              ))}
                            </div>
                            {log.note && <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', margin: '4px 0 0' }}>{log.note}</p>}
                          </div>
                          <span style={{ fontSize: '16px' }}>{log.mood.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cycle Energy/Mood Chart */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.30s both' : 'none' }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Cycle Trends</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>Energy & Mood by Phase</p>
                    <div style={{ height: '200px' }}>
                      <Line options={chartOpts} data={cycleChart} />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: '12px', animation: mounted ? 'fadeUp 0.5s ease 0.36s both' : 'none' }}>
                    {[
                      { label: 'Next Period',  value: daysUntilNext > 0 ? `${daysUntilNext}d` : 'Now', sub: formatDate(nextPeriod.toISOString().split('T')[0]), color: '#f43f5e', img: datecalendarImg, imgFilter: 'drop-shadow(0 4px 10px rgba(244,63,94,0.45))' },
                      { label: 'Cycle Length', value: `${cycleLength}d`, sub: 'Average cycle', color: '#a78bfa', img: cycleImg, imgFilter: 'drop-shadow(0 4px 10px rgba(167,139,250,0.45))' },
                      { label: 'Logged Days',  value: periodLogs.length, sub: 'This period',   color: '#22c55e', img: femalesIcon, imgFilter: 'drop-shadow(0 4px 10px rgba(34,197,94,0.45))' },
                    ].map((s, i) => (
                      <div key={s.label} className="stat-card" style={{
                        ...card, padding: '18px', textAlign: 'center',
                        border: `1px solid ${s.color}20`,
                        boxShadow: `0 4px 20px ${s.color}10`,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        animation: mounted ? `fadeUp 0.5s ease ${0.36 + i * 0.08}s both` : 'none',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 12px 30px ${s.color}25`; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${s.color}10`; }}>
                        <div style={{ width: 48, height: 48, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={s.img} alt={s.label} style={{ width: 44, height: 44, objectFit: 'contain', filter: s.imgFilter }} />
                        </div>
                        <p style={{ color: s.color, fontWeight: 800, fontSize: '24px', margin: '0 0 2px' }}>{s.value}</p>
                        <p style={{ color: 'rgba(180,210,255,0.7)', fontSize: '12px', fontWeight: 600, margin: '0 0 2px' }}>{s.label}</p>
                        <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '10px', margin: 0 }}>{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ═══════════ PREGNANCY TAB ════════════════════════ */}
              {activeTab === 'pregnancy' && (
                <>
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.12s both' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Pregnancy</p>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '16px', margin: 0 }}>Pregnancy Tracker</p>
                      </div>
                      <button className="fh-btn"
                        onClick={() => setIsPregnant(p => !p)}
                        style={{
                          padding: '10px 20px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                          background: isPregnant ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                          color: isPregnant ? '#a78bfa' : '#fff',
                          border: isPregnant ? '1px solid rgba(167,139,250,0.4)' : 'none',
                          boxShadow: isPregnant ? 'none' : '0 4px 18px rgba(167,139,250,0.4)',
                          fontFamily: "'Outfit', sans-serif",
                        }}>
                        {isPregnant ? '✓ Tracking Active' : '🤰 Enable Pregnancy Mode'}
                      </button>
                    </div>

                    {isPregnant ? (
                      <>
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ color: 'rgba(180,210,255,0.7)', fontSize: '12px', fontWeight: 600 }}>Pregnancy Week</label>
                            <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: '20px' }}>Week {pregnancyWeek}</span>
                          </div>
                          <input type="range" min={1} max={42} value={pregnancyWeek}
                            onChange={e => setPregnancyWeek(Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#a78bfa' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(180,210,255,0.3)', fontSize: '9px' }}>Week 1</span>
                            <span style={{ color: 'rgba(180,210,255,0.3)', fontSize: '9px' }}>Week 42</span>
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: `${pregnancyInfo.color}15`, border: `1px solid ${pregnancyInfo.color}35`, borderRadius: '14px', marginBottom: '16px' }}>
                          <p style={{ color: pregnancyInfo.color, fontWeight: 800, fontSize: '14px', margin: '0 0 6px' }}>🤰 {pregnancyInfo.trimester} · Week {pregnancyWeek}</p>
                          <p style={{ color: 'rgba(180,210,255,0.7)', fontSize: '12px', margin: 0, lineHeight: '1.65' }}>{pregnancyInfo.tip}</p>
                        </div>

                        {/* Baby movements */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: 'rgba(180,210,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '5px' }}>Baby Movements Today</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="fh-btn" onClick={() => setBabyMovements(m => Math.max(0, m - 1))}
                                style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,180,255,0.15)', color: '#e0f0ff', fontSize: '18px', cursor: 'pointer' }}>-</button>
                              <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: '24px', minWidth: '32px', textAlign: 'center' }}>{babyMovements}</span>
                              <button className="fh-btn" onClick={() => setBabyMovements(m => m + 1)}
                                style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', fontSize: '18px', cursor: 'pointer' }}>+</button>
                              <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px' }}>kicks / movements</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(180,210,255,0.35)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'floatDrop 2.5s ease-in-out infinite' }}>🤰</div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(180,210,255,0.5)' }}>Enable pregnancy mode to start tracking</p>
                        <p style={{ fontSize: '12px' }}>Track weekly milestones, baby movements, and trimester tips.</p>
                      </div>
                    )}
                  </div>

                  {/* Trimester progress */}
                  {isPregnant && (
                    <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr 1fr', gap: '12px', animation: mounted ? 'fadeUp 0.5s ease 0.2s both' : 'none' }}>
                      {[
                        { label: '1st Trimester', weeks: 'Weeks 1–13', color: '#f59e0b', active: pregnancyWeek <= 13 },
                        { label: '2nd Trimester', weeks: 'Weeks 14–26', color: '#22c55e', active: pregnancyWeek >= 14 && pregnancyWeek <= 26 },
                        { label: '3rd Trimester', weeks: 'Weeks 27–42', color: '#a78bfa', active: pregnancyWeek >= 27 },
                      ].map(t => (
                        <div key={t.label} style={{
                          ...card, padding: '18px', textAlign: 'center',
                          background: t.active ? `${t.color}15` : 'rgba(8,20,50,0.75)',
                          border: `1px solid ${t.active ? t.color + '40' : 'rgba(100,180,255,0.12)'}`,
                          boxShadow: t.active ? `0 8px 24px ${t.color}20` : 'none',
                        }}>
                          <p style={{ color: t.active ? t.color : 'rgba(180,210,255,0.4)', fontWeight: 800, fontSize: '13px', margin: '0 0 4px' }}>{t.label}</p>
                          <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: 0 }}>{t.weeks}</p>
                          {t.active && <div style={{ marginTop: '8px', width: '30px', height: '3px', borderRadius: '2px', background: t.color, margin: '8px auto 0', boxShadow: `0 0 8px ${t.color}` }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ═══════════ NUTRITION TAB ════════════════════════ */}
              {activeTab === 'nutrition' && (
                <>
                  {/* Nutrient goals */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.12s both' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px' }}>Female Nutrition</p>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '16px', margin: 0 }}>Daily Micronutrient Goals</p>
                      </div>
                      <button className="fh-btn" onClick={() => setShowNutritionModal(true)}
                        style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 18px rgba(34,197,94,0.35)', fontFamily: "'Outfit', sans-serif" }}>
                        + Log Meal
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {[
                        { label: 'Iron',    value: totalIron,    goal: 18,   unit: 'mg',  color: '#f43f5e' },
                        { label: 'Folate',  value: totalFolate,  goal: 400,  unit: 'mcg', color: '#a78bfa' },
                        { label: 'Calcium', value: totalCalcium, goal: 1000, unit: 'mg',  color: '#22c55e' },
                      ].map(n => {
                        const pct = Math.min((n.value / n.goal) * 100, 100);
                        return (
                          <div key={n.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ color: 'rgba(180,210,255,0.7)', fontSize: '12px', fontWeight: 600 }}>{n.label}</span>
                              <span style={{ color: n.color, fontSize: '12px', fontWeight: 700 }}>{n.value.toFixed(1)} / {n.goal} {n.unit}</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${n.color}80, ${n.color})`, borderRadius: '4px', boxShadow: `0 0 8px ${n.color}60`, animation: 'progressFill 1s ease both', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meal entries */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.2s both' : 'none' }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Today's Meals</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 14px' }}>Nutrition Log</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {nutritionEntries.map((e, i) => (
                        <div key={i} style={{
                          padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(34,197,94,0.12)', borderRadius: '12px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                          transition: 'all 0.2s',
                          animation: mounted ? `fadeUp 0.4s ease ${i * 0.06}s both` : 'none',
                        }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(34,197,94,0.06)'; ev.currentTarget.style.transform = 'translateX(3px)'; }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.03)'; ev.currentTarget.style.transform = 'translateX(0)'; }}>
                          <div>
                            <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '13px', margin: '0 0 2px' }}>{e.name}</p>
                            <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '10px', margin: 0 }}>{e.time}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[
                              { label: `${e.calories} kcal`, color: '#f97316' },
                              { label: `Fe ${e.iron}mg`,    color: '#f43f5e' },
                              { label: `B9 ${e.folate}mcg`, color: '#a78bfa' },
                              { label: `Ca ${e.calcium}mg`, color: '#22c55e' },
                            ].map(tag => (
                              <span key={tag.label} style={{ padding: '3px 8px', background: `${tag.color}15`, border: `1px solid ${tag.color}25`, borderRadius: '6px', color: tag.color, fontSize: '10px', fontWeight: 700 }}>{tag.label}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nutrition chart */}
                  <div style={{ ...card, padding: '24px', animation: mounted ? 'fadeUp 0.5s ease 0.30s both' : 'none' }}>
                    <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Micronutrients</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>Iron · Folate · Calcium by Meal</p>
                    <div style={{ height: '200px' }}>
                      <Bar options={chartOpts} data={nutritionChart} />
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>

            {/* ══ RIGHT COLUMN — CHAT PANEL ═══════════════════════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none' }}>
              {/* ── Chat Panel ── */}
              <div style={{
                background: 'rgba(8,20,50,0.75)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: '18px',
                display: 'flex', flexDirection: 'column',
                height: isNarrow ? '480px' : '600px',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(244,63,94,0.1), 0 2px 0 rgba(255,255,255,0.04) inset',
              }}>
                {/* Chat Header */}
                <div style={{
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(167,139,250,0.1))',
                  borderBottom: '1px solid rgba(244,63,94,0.15)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0,
                }}>
                  <div style={{
                   width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                    border: '2.5px solid rgba(244,63,94,0.6)',
                    boxShadow: '0 0 24px rgba(244,63,94,0.3), 0 0 48px rgba(167,139,250,0.15)',
                    overflow: 'hidden',
                    animation: 'avatarPulse 3s ease-in-out infinite',
                  }}>
                    <img src={femaleHealthAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '5px 14px', borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(244,63,94,0.25), rgba(167,139,250,0.18))',
                    border: '1px solid rgba(244,63,94,0.35)',
                    boxShadow: '0 2px 12px rgba(244,63,94,0.2)',
                  }}>
                    <span style={{ fontSize: '13px' }}>🌸</span>
                    <span style={{ color: '#f9a8b8', fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Female Health AI</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'glowPulse 2s ease-in-out infinite' }} />
                    <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px' }}>Online · Ready to help</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="chat-scrollbar" style={{
                  flex: 1, overflowY: 'auto', padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(180,210,255,0.3)' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'floatDrop 2.5s ease-in-out infinite' }}>💬</div>
                      <p style={{ fontSize: '12px', fontWeight: 500 }}>Ask me anything about your cycle, symptoms, or nutrition!</p>
                    </div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} style={{
                      display: 'flex', gap: '8px', flexDirection: msg.isAI ? 'row' : 'row-reverse',
                      animation: msg.isAI ? 'slideInMsg 0.3s ease both' : 'slideInMsgRight 0.3s ease both',
                    }}>
                      {msg.isAI && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: '1.5px solid rgba(244,63,94,0.5)', boxShadow: '0 0 8px rgba(244,63,94,0.2)', background: 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(167,139,250,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#f9a8b8' }}>
                          <img 
                        src="/assets/femalehealthavatar.png" 
                        alt="avatar" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                            />
                        </div>
                      )}
                      <div style={{
                        maxWidth: '78%', padding: '10px 13px',
                        borderRadius: msg.isAI ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                        background: msg.isAI
                          ? 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(167,139,250,0.08))'
                          : 'linear-gradient(135deg, rgba(244,63,94,0.28), rgba(167,139,250,0.22))',
                        border: msg.isAI ? '1px solid rgba(244,63,94,0.18)' : '1px solid rgba(244,63,94,0.4)',
                        boxShadow: msg.isAI ? 'none' : '0 4px 16px rgba(244,63,94,0.15)',
                      }}>
                        <p style={{ color: 'rgba(220,235,255,0.92)', fontSize: '12px', margin: '0 0 4px', lineHeight: '1.65' }}>{msg.text}</p>
                        <p style={{ color: 'rgba(180,210,255,0.3)', fontSize: '9px', margin: 0, textAlign: msg.isAI ? 'left' : 'right' }}>{msg.time}</p>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div style={{ overflow: 'hidden' }}>
                        <img src={femaleHealthAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.18)', borderRadius: '4px 14px 14px 14px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', animation: `typingBounce 1s ease ${delay}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{
                  padding: '12px 14px', borderTop: '1px solid rgba(244,63,94,0.12)',
                  background: 'rgba(0,0,0,0.25)', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="fem-input"
                      placeholder="Ask about your cycle, symptoms, nutrition..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                      style={{ flex: 1, padding: '10px 14px', fontSize: '12px' }}
                    />
                    <button className="fh-btn"
                      onClick={handleChatSend}
                      style={{
                       width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                        background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                        border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', transition: 'all 0.2s',
                        boxShadow: '0 4px 20px rgba(244,63,94,0.45)',
                      }}>
                      ➤
                    </button>
                  </div>
                  <p style={{ color: 'rgba(180,210,255,0.22)', fontSize: '9px', margin: '6px 0 0', textAlign: 'center' }}>Press Enter to send · AI responses are informational only</p>
                </div>
              </div>

              {/* Quick Questions */}
              <div style={{ ...card, padding: '20px', boxShadow: '0 4px 24px rgba(244,63,94,0.07)' }}>
                <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Quick Questions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Is my period late?',
                    'What phase am I in?',
                    'When is my ovulation?',
                    'How do I reduce cramps?',
                    'Am I getting enough iron?',
                    'What to eat during luteal phase?',
                    'How much folate do I need?',
                    'What is PCOS?',
                    'How does stress affect my cycle?',
                    'What exercises suit my phase?',
                  ].map((q, i) => (
                    <button key={i} className="quick-q"
                      onClick={() => {
                        setUserHasSent(true);
                        setChatInput(q);
                        setTimeout(() => {
                          const lower = q.toLowerCase();
                          const newId2 = chatMsgId + 1;
                          setChatMsgId(newId2);
                          setChatMessages(prev => [...prev, { id: newId2, text: q, isAI: false, time: getTimeStr() }]);
                          setChatInput('');
                          setIsTyping(true);
                          setTimeout(() => {
                            setIsTyping(false);
                            let response = chatResponses['default'];
                            for (const key of Object.keys(chatResponses)) {
                              if (lower.includes(key)) { response = chatResponses[key]; break; }
                            }
                            addAIMessage(response);
                          }, 1000);
                        }, 50);
                      }}
                      style={{
                        padding: '9px 13px', background: 'rgba(244,63,94,0.06)',
                        border: '1px solid rgba(244,63,94,0.12)', borderRadius: '10px',
                        color: 'rgba(220,200,255,0.7)', fontSize: '11px', fontWeight: 500,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        fontFamily: "'Outfit', sans-serif",
                        animation: mounted ? `fadeUp 0.4s ease ${i * 0.04}s both` : 'none',
                      }}>
                      💬 {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
        </div>
        </div>
      </div>

      {/* ══ ADD PERIOD LOG MODAL ══════════════════════════════════════ */}
      {showPeriodModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }}
          onClick={() => setShowPeriodModal(false)}>
          <div style={{ background: 'rgba(8,20,50,0.98)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(244,63,94,0.1)', animation: 'fadeUp .3s ease', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'rgba(244,63,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 0 20px rgba(244,63,94,0.2)' }}>🩸</div>
              <div>
                <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Log Period Day</h4>
                <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>Track your flow & symptoms</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Date</label>
                <input type="date" className="fem-input" value={newLog.date} onChange={e => setNewLog({ ...newLog, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Flow Intensity</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['light', 'medium', 'heavy'] as const).map(f => (
                    <button key={f} className="fh-btn" onClick={() => setNewLog({ ...newLog, flow: f })}
                      style={{
                        flex: 1, padding: '10px 6px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                        fontFamily: "'Outfit', sans-serif",
                        background: newLog.flow === f ? (f === 'heavy' ? 'rgba(244,63,94,0.3)' : f === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(251,191,36,0.3)') : 'rgba(255,255,255,0.05)',
                        color: newLog.flow === f ? (f === 'heavy' ? '#f43f5e' : f === 'medium' ? '#f59e0b' : '#fbbf24') : 'rgba(180,210,255,0.4)',
                        border: `1px solid ${newLog.flow === f ? (f === 'heavy' ? 'rgba(244,63,94,0.4)' : f === 'medium' ? 'rgba(245,158,11,0.4)' : 'rgba(251,191,36,0.4)') : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {f === 'light' ? '🟡' : f === 'medium' ? '🟠' : '🔴'} {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Symptoms</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {SYMPTOMS.map(s => (
                    <button key={s} className="sym-chip" onClick={() => toggleSymptom(s)}
                      style={{
                        padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        background: newLog.symptoms.includes(s) ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.05)',
                        color: newLog.symptoms.includes(s) ? '#f43f5e' : 'rgba(180,210,255,0.45)',
                        border: `1px solid ${newLog.symptoms.includes(s) ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Mood</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {MOODS.map(m => (
                    <button key={m} className="sym-chip" onClick={() => setNewLog({ ...newLog, mood: m })}
                      style={{
                        padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        background: newLog.mood === m ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                        color: newLog.mood === m ? '#a78bfa' : 'rgba(180,210,255,0.45)',
                        border: newLog.mood === m ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Note <span style={{ color: 'rgba(180,210,255,0.3)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input type="text" className="fem-input" placeholder="How are you feeling today?" value={newLog.note} onChange={e => setNewLog({ ...newLog, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button className="fh-btn" 
                  onClick={(e) => handleAddPeriodLog(e)}
                  disabled={saving}
                  style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg,#f43f5e,#e11d48)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: `0 4px 20px ${accentGlow}`, fontFamily: "'Outfit', sans-serif" }}>
                  Save Log
                </button>
                <button onClick={() => setShowPeriodModal(false)}
                  style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD NUTRITION MODAL ════════════════════════════════════════ */}
      {showNutritionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }}
          onClick={() => setShowNutritionModal(false)}>
          <div style={{ background: 'rgba(8,20,50,0.98)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,197,94,0.08)', animation: 'fadeUp .3s ease', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 0 20px rgba(34,197,94,0.2)' }}>🥗</div>
              <div>
                <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Log Meal</h4>
                <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>Track female-focused nutrients</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Meal Name', field: 'name', type: 'text', placeholder: 'e.g. Spinach omelette...' },
                { label: 'Calories (kcal)', field: 'calories', type: 'number', placeholder: 'e.g. 350' },
                { label: 'Iron (mg)', field: 'iron', type: 'number', placeholder: 'e.g. 3.5' },
                { label: 'Folate / Vitamin B9 (mcg)', field: 'folate', type: 'number', placeholder: 'e.g. 80' },
                { label: 'Calcium (mg)', field: 'calcium', type: 'number', placeholder: 'e.g. 150' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ display: 'block', color: 'rgba(180,210,255,0.7)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{f.label}</label>
                  <input type={f.type} className="fem-input" placeholder={f.placeholder}
                    value={(newNutrition as any)[f.field] || ''}
                    onChange={e => setNewNutrition({ ...newNutrition, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button className="fh-btn" onClick={handleAddNutrition}
                  style={{ flex: 1, padding: '13px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(34,197,94,0.35)', fontFamily: "'Outfit', sans-serif" }}>
                  Save Meal
                </button>
                <button onClick={() => setShowNutritionModal(false)}
                  style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}