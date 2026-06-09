import { useState, useEffect, useRef, memo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { HeartRateCard } from '../components/HeartRateCard';
import { StepsCard } from '../components/StepsCard';
import { SleepQualityCard } from '../components/SleepQualityCard';
import { HydrationCard } from '../components/HydrationCard';
import { ChatPanel } from '../components/ChatPanel';
import { useNavigate } from 'react-router';
import { useUserProfile } from '../../context/UserProfileContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const MemoSidebar = memo(Sidebar);

/* ── Assets ─────────────────────────────────────────────────────── */
const heartImg  = '/assets/Heart.png';
const stepsImg  = '/assets/steps.png';
const waterImg  = '/assets/water.png';
const moonImg   = '/assets/moon.png';
const streakImg = '/assets/streak.png';
const medalImg  = '/assets/medal.png';
const foodImg   = '/assets/food.png';
const clockImg  = '/assets/clock.png';
const healthImg = '/assets/health.png';

const QUICK_STATS = [
  { img: heartImg, label: 'Heart Rate', value: '76',    unit: 'bpm',   color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   path: '/heart',     anim: 'heartPulse' },
  { img: stepsImg, label: 'Steps',      value: '7,400', unit: 'steps', color: '#22c55e', glow: 'rgba(34,197,94,0.4)',   path: '/steps',     anim: 'stepBounce' },
  { img: waterImg, label: 'Hydration',  value: '1.8',   unit: 'L',     color: '#38bdf8', glow: 'rgba(56,189,248,0.4)',  path: '/hydration', anim: 'waterTilt'  },
  { img: moonImg,  label: 'Sleep',      value: '7.2',   unit: 'hrs',   color: '#a78bfa', glow: 'rgba(167,139,250,0.4)', path: '/sleep',     anim: 'moonFloat'  },
  { img: foodImg,  label: 'Calories',   value: '1,850', unit: 'kcal',  color: '#f97316', glow: 'rgba(249,115,22,0.4)',  path: '/calories',  anim: 'foodBob'    },
  { img: clockImg, label: 'Active',     value: '74',    unit: 'min',   color: '#fbbf24', glow: 'rgba(251,191,36,0.4)',  path: '/steps',     anim: 'clockTick'  },
];

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export function Dashboard() {
  const navigate  = useNavigate();
  const width     = useWindowWidth();
  const isMobile  = width < 768;
  const isTablet  = width < 992;

  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [mounted, setMounted]     = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const [hour]                    = useState(new Date().getHours());

  // ── Username: sourced exclusively from UserProfileContext,
  //    which loads from Appwrite on mount and stays in sync ──────────
  const { profile } = useUserProfile();
  const userName  = profile.name || '';
  const firstName = userName.split(' ')[0] || 'there';

  useEffect(() => {
    // Scroll both window and the inner scrollable container to top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setMounted(true);
  }, []);

  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const outerGrid  = isMobile || isTablet ? '1fr' : '1fr 320px';
  const chipCols   = isMobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)';
  const metricCols = isMobile ? '1fr' : '1fr 1fr';
  const bottomCols = isMobile ? '1fr' : '1fr 1fr';

  const chatResponses = {
    // ── Sleep ──────────────────────────────────────────────────────────
    sleep:          'Your average sleep is 6.8 hrs. Aim for 8 hrs tonight for full recovery.',
    sleeping:       'Your average sleep is 6.8 hrs. Aim for 8 hrs tonight for full recovery.',
    'sleep quality':'Your sleep quality score is moderate. Try sleeping before 11 PM and avoid screens 30 min before bed.',
    'how much sleep':'Adults need 7–9 hours of sleep per night. You averaged 6.8 hrs — try going to bed a little earlier tonight.',
    'not sleeping': 'Trouble sleeping? Try a consistent bedtime, limit caffeine after 2 PM, and keep your room cool and dark.',
    insomnia:       'For better sleep, avoid screens before bed, keep a consistent schedule, and try relaxing breathing exercises.',
    'tired':        'Feeling tired may mean you need more sleep or better sleep quality. Your current average is 6.8 hrs — aim for 8 hrs.',
    'wake up':      'Waking up frequently may indicate poor sleep quality. Check your sleep details in the Sleep module for more insights.',
    'sleep goal':   'Your sleep goal is 8 hrs. You are currently at 7.2 hrs — only 48 minutes away from your goal!',
    nap:            'Short naps (10–20 min) can boost alertness. Avoid napping after 3 PM so it does not affect tonight\'s sleep.',

    // ── Steps / Activity ───────────────────────────────────────────────
    steps:          "You've hit 7,400 steps today — just 2,600 away from your 10k goal!",
    step:           "You've hit 7,400 steps today — just 2,600 away from your 10k goal!",
    walk:           'A brisk 20-minute walk adds roughly 2,000–2,500 steps and burns about 100 kcal. You\'re close to your goal!',
    walking:        'Walking is great low-impact exercise. You are at 7,400 steps — keep it up!',
    'daily steps':  'Your daily step goal is 10,000. You are currently at 7,400 — a short walk will close the gap!',
    'step goal':    'Your step goal is 10,000 steps/day. You are at 7,400 — only 2,600 more to go!',
    run:            'Running counts toward your step goal too! Lace up and close that 2,600-step gap.',
    running:        'Running is a great way to boost your steps and cardio health. Your current step count is 7,400.',
    exercise:       'You have been active for 74 minutes today. Keep moving — your body thanks you!',
    workout:        'You have logged 74 active minutes today. Check the Steps module for detailed activity breakdowns.',
    active:         'You have been active for 74 minutes today — that\'s a solid effort! Aim for at least 30 active minutes per day.',
    activity:       'Your activity today: 7,400 steps and 74 active minutes. Check Activity Trends for a full picture.',
    'how active':   'You have been active for 74 minutes and walked 7,400 steps today. Great progress!',
    distance:       'You have covered 5.2 km today. Keep moving to reach your step goal!',
    'how far':      'You have walked 5.2 km today. A bit more and you\'ll hit your daily distance target.',

    // ── Hydration / Water ──────────────────────────────────────────────
    water:          "You're at 1.8L today — 0.7L left to reach your 2.5L goal. Drink up!",
    hydration:      "You're at 1.8L today — 0.7L left to reach your 2.5L goal. Drink up!",
    hydrate:        'Stay hydrated! You need 0.7L more to hit your 2.5L daily goal.',
    drink:          'Drinking enough water keeps your energy and focus sharp. You are at 1.8L — 0.7L to go!',
    drinking:       'Good hydration supports digestion, energy, and skin health. You are 72% toward your water goal.',
    'water goal':   'Your water goal is 2.5L per day. You are at 1.8L — only 0.7L remaining!',
    dehydrated:     'Signs of dehydration include fatigue, headaches, and dark urine. Drink a glass of water now — you are 0.7L short of your goal.',
    thirsty:        'Thirst is already a sign of mild dehydration. Drink some water now — you still need 0.7L today.',
    'how much water':'The recommended daily intake is about 2–2.5L. You are at 1.8L — keep sipping throughout the day.',
    'water intake':  'Your water intake today is 1.8L. Your goal is 2.5L. Try drinking a glass every hour.',

    // ── Heart Rate ─────────────────────────────────────────────────────
    heart:          'Your resting heart rate is 76 BPM — that\'s within the healthy range of 60–100 BPM.',
    'heart rate':   'Your resting heart rate is 76 BPM — that\'s within the healthy range of 60–100 BPM.',
    bpm:            'Your current BPM is 76, which is a healthy resting heart rate.',
    heartbeat:      'Your heart rate is 76 BPM — steady and healthy. Check the Heart Rate module for detailed trends.',
    pulse:          'Your pulse is 76 BPM, which falls in the normal resting range (60–100 BPM).',
    'high heart rate': 'A resting heart rate above 100 BPM (tachycardia) can be concerning. If yours is consistently high, consult a doctor.',
    'low heart rate': 'A resting heart rate below 60 BPM is common in athletes. If you feel dizzy or faint, check with a healthcare provider.',
    'normal heart rate': 'A normal resting heart rate is 60–100 BPM. Your current rate is 76 BPM — perfectly healthy!',
    cardio:         'Cardio exercise strengthens your heart. Your 74 active minutes today are a great contribution to heart health!',
    cardiovascular: 'Cardiovascular health depends on regular movement, good sleep, and hydration — all things tracked here in your dashboard.',

    // ── Calories / Food / Nutrition ────────────────────────────────────
    calories:       'You have consumed 1,850 kcal today. Your goal is 2,200 kcal. For personalised targets, calculate your BMI in Profile Settings first, then visit the Calories module.',
    calorie:        'You have consumed 1,850 kcal today. Your goal is 2,200 kcal. For personalised targets, calculate your BMI in Profile Settings first, then visit the Calories module.',
    food:           'Wondering if you are eating enough? First calculate your BMI in Profile Settings, then head to the Calories module for an in-depth personalised answer.',
    eating:         'Not sure if your food intake is enough? Calculate your BMI in Profile Settings first, then explore the Calories module for detailed guidance.',
    'how much to eat': 'Your ideal caloric intake depends on your BMI and activity level. Go to Profile Settings to calculate your BMI, then visit the Calories module for a full breakdown.',
    'am i eating enough': 'To know if you are eating enough, first calculate your BMI in Profile Settings. Then head to the Calories module for personalised caloric recommendations.',
    'is the food i eat enough': 'Great question! First, calculate your BMI in Profile Settings. Once that\'s set, go to the Calories module — it will give you a personalised answer based on your body and goals.',
    'is my diet enough': 'Your diet needs depend on your BMI and activity level. Calculate your BMI in Profile Settings first, then the Calories module will give you tailored advice.',
    nutrition:      'Good nutrition supports all your health goals. For personalised caloric needs, calculate your BMI in Profile Settings, then visit the Calories module.',
    diet:           'Your diet plays a huge role in reaching your health goals. Start by calculating your BMI in Profile Settings, then check the Calories module for personalised targets.',
    'calorie goal': 'Your current calorie goal is 2,200 kcal/day. You are at 1,850 kcal. Need a personalised goal? Set up your BMI in Profile Settings, then go to the Calories module.',
    'how many calories': 'You have consumed 1,850 kcal today out of a 2,200 kcal goal. For a target tailored to your body, calculate your BMI in Profile Settings first.',
    'burn calories': 'You have burned approximately 420 kcal through activity today. The Calories module shows a full breakdown — but first make sure your BMI is set in Profile Settings.',
    'lose weight':  'Weight loss depends on a caloric deficit suited to your BMI. Please calculate your BMI in Profile Settings, then visit the Calories module for a personalised plan.',
    'gain weight':  'To gain weight healthily, you need a caloric surplus based on your BMI. Set up your BMI in Profile Settings, then check the Calories module for guidance.',
    'weight goal':  'Reaching your weight goal starts with knowing your BMI. Head to Profile Settings to calculate it, then the Calories module will map out the path.',
    'enough food':  'Whether your food is enough depends on your body stats. First calculate your BMI in Profile Settings, then the Calories module will have your answer.',
    meal:           'Balanced meals throughout the day help maintain energy levels. For personalised calorie targets, check the Calories module after setting up your BMI in Profile Settings.',
    meals:          'Spacing meals evenly helps regulate metabolism. For a personalised caloric plan, calculate your BMI in Profile Settings and visit the Calories module.',
    protein:        'Protein supports muscle repair and satiety. Your ideal intake depends on your body weight — calculate your BMI in Profile Settings, then visit the Calories module for detailed macro guidance.',
    carbs:          'Carbohydrates are your main energy source. For personalised macro targets, calculate your BMI in Profile Settings and check the Calories module.',
    fat:            'Healthy fats support brain and hormone function. For personalised guidance, calculate your BMI in Profile Settings and visit the Calories module.',
    nutrients:      'Balanced nutrients keep your body performing well. For personalised recommendations, calculate your BMI in Profile Settings, then explore the Calories module.',

    // ── BMI ────────────────────────────────────────────────────────────
    bmi:            'Your BMI hasn\'t been set yet. Go to Profile Settings to calculate it — this unlocks personalised recommendations in the Calories module and beyond.',
    'body mass index': 'BMI (Body Mass Index) measures your weight relative to height. Set it up in Profile Settings to unlock personalised health goals.',
    'calculate bmi': 'Head to Profile Settings to calculate your BMI. It only takes a moment and unlocks personalised calorie and health targets.',
    'what is bmi':  'BMI is a measure of body fat based on height and weight. A healthy BMI is typically 18.5–24.9. Calculate yours in Profile Settings.',
    'my bmi':       'Your BMI hasn\'t been recorded yet. Visit Profile Settings to calculate it and get personalised health recommendations.',

    // ── General Health ─────────────────────────────────────────────────
    health:         'Your overall health score looks good! You are at 74% of your daily goals. Keep up the great work.',
    'health score': 'You are at 74% of your daily goals today. Sleep, hydration, and steps are your biggest opportunities.',
    'how am i doing': 'You are doing great! 74% of daily goals completed. Hydration and steps are the closest to completion.',
    'overall health': 'Overall you are doing well — 74% of daily goals met. Focus on hydration and steps to hit 100%.',
    wellness:       'Wellness is about balance. You are tracking sleep, steps, water, and calories — all the right things!',
    'feel better':  'To feel better overall, focus on completing your hydration goal (0.7L left) and getting 8 hrs of sleep tonight.',
    healthy:        'You are on a healthy track today! 74% of your goals are complete. Small consistent habits make a big difference.',
    'tips':         'Top tips for today: drink 0.7L more water, take a 20-min walk for your step goal, and aim for 8 hrs of sleep tonight.',
    'advice':       'Today\'s health advice: you are 2,600 steps short, 0.7L of water behind, and could use a bit more sleep. Small actions now make a big difference.',
    'goal':         'You are at 74% of your daily goals. Your nearest targets: 2,600 more steps, 0.7L more water, and 8 hrs of sleep.',
    goals:          'Your daily goals: Steps 74%, Hydration 72%, Calories 84%, Sleep 90%. You are doing well — keep it up!',

    // ── Stress / Mental Health ─────────────────────────────────────────
    stress:         'High stress can affect your heart rate and sleep. Try deep breathing or a short walk to reset. Your heart rate is currently 76 BPM — healthy range.',
    anxiety:        'Anxiety can impact sleep and heart rate. Regular movement and proper sleep are great natural support. Your activity today looks good!',
    mood:           'Your mood can be influenced by sleep, hydration, and activity. All three are being tracked here — keep them consistent for a better mood.',
    mental:         'Mental wellbeing is tied to physical habits. You are building good ones — sleep, movement, and hydration all matter.',
    relax:          'To relax, try a short mindfulness exercise, a light walk, or ensure you are getting 8 hrs of sleep. You are at 7.2 hrs — almost there!',

    // ── Streak / Motivation ────────────────────────────────────────────
    streak:         'You are on a 5-day streak — amazing consistency! Keep it going by completing your remaining goals today.',
    'day streak':   'You have a 5-day streak! One of your best runs yet. Stay consistent to keep it alive.',
    motivation:     'You are 74% done with your daily goals. A little more effort and you\'ll close it out. You\'ve got this!',
    progress:       'Great progress today! 74% of goals complete. Your most consistent metric has been heart rate — keep it up.',
    achievement:    'You\'ve earned a 5-day streak badge! Check your achievements for more milestones to unlock.',

    // ── Fallback ────────────────────────────────────────────────────────
    hello:          'Hello! I\'m your Health AI. Ask me about your steps, sleep, water, calories, heart rate, or any health topic!',
    hi:             'Hi there! Ask me anything about your health stats — sleep, steps, water, calories, or more.',
    hey:            'Hey! How can I help you with your health today?',
    help:           'I can answer questions about your sleep, steps, hydration, heart rate, calories, BMI, and overall wellness. Just ask!',
  };

  const autoMessages = [
    { text: 'Reminder: Time to drink water! You are at 1.8L of your 2.5L goal.', delay: 10000 },
    { text: 'You are 2,600 steps from your daily goal. A 20-minute walk will close it!', delay: 20000 },
  ];

  const weeklyData = {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [
      { label:'Steps',    data:[8200,6500,9100,7400,10200,5800,8900], borderColor:'rgba(34,197,94,1)',   backgroundColor:'rgba(34,197,94,0.08)',   fill:true, tension:0.4, pointBackgroundColor:'rgba(74,222,128,1)',   pointRadius:4 },
      { label:'Calories', data:[420,380,510,390,550,320,480],          borderColor:'rgba(249,115,22,1)', backgroundColor:'rgba(249,115,22,0.08)', fill:true, tension:0.4, pointBackgroundColor:'rgba(251,146,60,1)',   pointRadius:4 },
    ],
  };
  const dailyData = {
    labels: ['12am','4am','8am','12pm','4pm','8pm'],
    datasets: [
      { label:'Activity', data:[20,15,45,80,95,60], borderColor:'rgba(56,189,248,1)', backgroundColor:'rgba(56,189,248,0.08)', fill:true, tension:0.4, pointBackgroundColor:'rgba(125,211,252,1)', pointRadius:4 },
    ],
  };
  const monthlyData = {
    labels: ['Week 1','Week 2','Week 3','Week 4'],
    datasets: [
      { label:'Avg Steps',    data:[7500,8200,7800,8900], borderColor:'rgba(34,197,94,1)',   backgroundColor:'rgba(34,197,94,0.08)',   fill:true, tension:0.4, pointBackgroundColor:'rgba(74,222,128,1)',   pointRadius:4 },
      { label:'Avg Calories', data:[420,450,430,480],     borderColor:'rgba(249,115,22,1)', backgroundColor:'rgba(249,115,22,0.08)', fill:true, tension:0.4, pointBackgroundColor:'rgba(251,146,60,1)',   pointRadius:4 },
    ],
  };
  const getChartData = () => timeRange === 'daily' ? dailyData : timeRange === 'monthly' ? monthlyData : weeklyData;

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend:  { position:'top' as const, labels:{ color:'rgba(180,210,255,0.7)', font:{ size:12 }, padding:16 } },
      tooltip: { backgroundColor:'rgba(8,20,50,0.95)', titleColor:'#fff', bodyColor:'rgba(180,210,255,0.85)', borderColor:'rgba(100,180,255,0.2)', borderWidth:1 },
    },
    scales: {
      y: { grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'rgba(180,210,255,0.5)' } },
      x: { grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'rgba(180,210,255,0.5)' } },
    },
  };

  const card: React.CSSProperties = {
    background:    'rgba(8,20,50,0.75)',
    backdropFilter:'blur(20px)',
    border:        '1px solid rgba(100,180,255,0.12)',
    borderRadius:  '20px',
    transition:    'all 0.3s ease',
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn    { from{opacity:0;}  to{opacity:1;} }
        @keyframes ringPulse { 0%{transform:scale(1);opacity:.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes heartPulse{ 0%,100%{transform:scale(1);}        50%{transform:scale(1.1);} }
        @keyframes stepBounce{ 0%,100%{transform:rotate(-5deg) translateY(0);} 50%{transform:rotate(5deg) translateY(-6px);} }
        @keyframes waterTilt { 0%,100%{transform:rotate(-4deg) translateY(0);} 50%{transform:rotate(4deg) translateY(-5px);} }
        @keyframes moonFloat { 0%,100%{transform:translateY(0) rotate(-5deg);}  50%{transform:translateY(-8px) rotate(3deg);} }
        @keyframes foodBob   { 0%,100%{transform:translateY(0) rotate(0deg);}   40%{transform:translateY(-6px) rotate(-1deg);} }
        @keyframes clockTick { 0%,100%{transform:rotate(-2deg);}  50%{transform:rotate(2deg);} }
        @keyframes medalSway { 0%,100%{transform:rotate(-4deg) translateY(0);}  50%{transform:rotate(4deg) translateY(-6px);} }
        @keyframes streakPop { 0%{transform:scale(0) rotate(-20deg);opacity:0;} 70%{transform:scale(1.1) rotate(4deg);opacity:1;} 100%{transform:scale(1) rotate(0deg);opacity:1;} }
        @keyframes healthSpin{ 0%,100%{transform:rotate(-5deg) scale(1);}       50%{transform:rotate(5deg) scale(1.05);} }
        @keyframes shimmer   { 0%{transform:translateX(-100%);}  100%{transform:translateX(200%);} }
        @keyframes barFill   { from{width:0%;} }
        .stat-chip { transition:all 0.3s cubic-bezier(.4,0,.2,1); cursor:pointer; }
        .stat-chip:hover { transform:translateY(-4px) scale(1.03) !important; }
        .range-btn:hover { background:rgba(100,180,255,0.15) !important; color:#e0f0ff !important; }
      `}</style>

      <div className="dashboard-page" style={{ overflowX:'hidden' }}>
        <MemoSidebar />

        <div ref={mainRef} className="main-content" style={{ padding: 0, minWidth: 0 }}>
          {/* Pass real userName to Header */}
          <Header userName={userName} />

          <div style={{
            padding: isMobile ? '16px' : '24px 28px',
            display: 'grid',
            gridTemplateColumns: outerGrid,
            gap: '22px',
            minHeight: 'calc(100vh - 73px)',
          }}>

            {/* ── MAIN COLUMN ─────────────────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'20px', minWidth:0 }}>

              {/* Welcome Banner — now shows real name */}
              <div style={{
                ...card,
                border:'1px solid rgba(100,180,255,0.18)',
                padding: isMobile ? '18px' : '24px 28px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                position:'relative', overflow:'hidden',
                
                boxShadow:'0 8px 40px rgba(0,60,180,0.15)',
              }}>
                <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', borderRadius:'20px' }}>
                  <div style={{ position:'absolute', top:0, left:0, width:'50%', height:'100%', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)', animation:'shimmer 5s ease infinite' }} />
                </div>
                <div style={{ position:'absolute', top:'-40px', right:'-40px', width:'200px', height:'200px', borderRadius:'50%', background:'rgba(56,189,248,0.05)', filter:'blur(50px)', pointerEvents:'none' }} />

                <div style={{ position:'relative', zIndex:1 }}>
                  {/* Greeting line */}
                  <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'12px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', margin:'0 0 4px' }}>
                    {greeting}
                  </p>
                  {/* Real user name */}
                  <h1 style={{ color:'#e0f0ff', fontWeight:900, fontSize: isMobile ? '20px' : '26px', margin:'0 0 6px', letterSpacing:'-0.5px' }}>
                    {greeting}, <span style={{ background:'linear-gradient(135deg,#7dd3fc,#38bdf8,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      {firstName || 'there'}!
                    </span>
                  </h1>
                  <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:0 }}>
                    You're doing great — 74% of daily goals completed.
                  </p>
                </div>

                {!isMobile && (
                  <div style={{ display:'flex', gap:'16px', position:'relative', zIndex:1, flexShrink:0 }}>
                    <img src={healthImg} alt="Health" style={{ width:56, height:56, objectFit:'contain', animation:'healthSpin 4s ease-in-out infinite', filter:'drop-shadow(0 0 14px rgba(239,68,68,0.5))' }} />
                    <div style={{ position:'relative' }}>
                      <img src={streakImg} alt="Streak" style={{ width:56, height:56, objectFit:'contain', animation: 'streakPop 0.6s cubic-bezier(.4,0,.2,1) forwards', filter:'drop-shadow(0 0 12px rgba(251,191,36,0.55))' }} />
                      <div style={{ position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'2px solid rgba(8,20,50,0.9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 8px rgba(251,191,36,0.7)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p style={{ color:'#fbbf24', fontSize:'10px', fontWeight:700, textAlign:'center', margin:'4px 0 0' }}>5-day streak</p>
                    </div>
                    <img src={medalImg} alt="Medal" style={{ width:56, height:56, objectFit:'contain', animation:'medalSway 3.5s ease-in-out infinite', filter:'drop-shadow(0 0 12px rgba(251,191,36,0.5))' }} />
                  </div>
                )}
              </div>

              {/* Quick Stats chips */}
              <div style={{ display:'grid', gridTemplateColumns: chipCols, gap:'10px' }}>
                {QUICK_STATS.map((s, i) => (
                  <div key={s.label} className="stat-chip"
                    onClick={() => navigate(s.path)}
                    style={{
                      ...card,
                      border:`1px solid ${s.color}22`,
                      padding: isMobile ? '12px 6px' : '16px 10px',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
                      position:'relative', overflow:'hidden',
                    }}>
                    <div style={{ position:'absolute', bottom:'-12px', left:'50%', transform:'translateX(-50%)', width:'80px', height:'40px', background:s.color, opacity:0.05, filter:'blur(20px)', borderRadius:'50%', pointerEvents:'none' }} />
                    <img src={s.img} alt={s.label}
                      style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, objectFit:'contain', animation:`${s.anim} ${s.label==='Heart Rate'?'1.8s':s.label==='Steps'?'2s':'3.5s'} ease-in-out infinite`, filter:`drop-shadow(0 0 8px ${s.glow})` }} />
                    <div style={{ textAlign:'center' }}>
                      <p style={{ color:'#fff', fontWeight:800, fontSize: isMobile ? '13px' : '16px', margin:0, lineHeight:1 }}>{s.value}</p>
                      <p style={{ color:s.color, fontWeight:600, fontSize:'9px', margin:'2px 0 0' }}>{s.unit}</p>
                      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'8px', fontWeight:500, margin:'1px 0 0', letterSpacing:'0.03em' }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Metric Cards */}
              <div style={{ display:'grid', gridTemplateColumns: metricCols, gap:'16px' }}>
                <HeartRateCard />
                <StepsCard />
                <SleepQualityCard />
                <HydrationCard />
              </div>

              {/* Activity Trends Chart */}
              <div style={{ ...card, padding: isMobile ? '16px' : '24px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
                  <div>
                    <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 2px' }}>Overview</p>
                    <h3 style={{ color:'#e0f0ff', fontWeight:700, fontSize:'16px', margin:0 }}>Activity Trends</h3>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {(['daily','weekly','monthly'] as const).map(r => (
                      <button key={r} className="range-btn" onClick={() => setTimeRange(r)}
                        style={{ padding:'7px 12px', borderRadius:'10px', fontSize:'11px', fontWeight:600, cursor:'pointer', transition:'all .2s', background: timeRange===r ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${timeRange===r ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.08)'}`, color: timeRange===r ? '#38bdf8' : 'rgba(180,210,255,0.45)' }}>
                        {r.charAt(0).toUpperCase()+r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: isMobile ? '220px' : '300px' }}>
                  <Line options={chartOptions} data={getChartData()} />
                </div>
              </div>

              {/* Daily Goals + Today Summary */}
              <div style={{ display:'grid', gridTemplateColumns: bottomCols, gap:'16px' }}>

                <div style={{ ...card, padding:'22px' }}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 16px' }}>Daily Goals</p>
                  {[
                    { label:'Steps',     value:7400, max:10000, color:'#22c55e', img:stepsImg },
                    { label:'Hydration', value:1.8,  max:2.5,   color:'#38bdf8', img:waterImg },
                    { label:'Calories',  value:1850, max:2200,  color:'#f97316', img:foodImg  },
                    { label:'Sleep',     value:7.2,  max:8,     color:'#a78bfa', img:moonImg  },
                  ].map(g => {
                    const pct = Math.min((g.value/g.max)*100, 100);
                    return (
                      <div key={g.label} style={{ marginBottom:'14px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <img src={g.img} alt={g.label} style={{ width:20, height:20, objectFit:'contain', filter:`drop-shadow(0 0 4px ${g.color}60)` }} />
                            <span style={{ color:'rgba(180,210,255,0.7)', fontSize:'13px', fontWeight:500 }}>{g.label}</span>
                          </div>
                          <span style={{ color:g.color, fontSize:'12px', fontWeight:700 }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height:'6px', borderRadius:'3px', background:'rgba(255,255,255,0.06)' }}>
                          <div style={{ height:'100%', borderRadius:'3px', background:g.color, width:`${pct}%`, boxShadow:`0 0 8px ${g.color}60`, transition:'width 1s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ ...card, padding:'22px' }}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 16px' }}>Today's Summary</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    {[
                      { label:'Resting HR',  value:'76',  unit:'bpm', color:'#ef4444', img:heartImg },
                      { label:'Distance',    value:'5.2', unit:'km',  color:'#22c55e', img:stepsImg },
                      { label:'Water Left',  value:'0.7', unit:'L',   color:'#38bdf8', img:waterImg },
                      { label:'Active Time', value:'74',  unit:'min', color:'#fbbf24', img:clockImg },
                    ].map(s => (
                      <div key={s.label} style={{ padding:'12px', background:'rgba(255,255,255,0.04)', borderRadius:'14px', border:`1px solid ${s.color}18` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                          <img src={s.img} alt={s.label} style={{ width:18, height:18, objectFit:'contain', filter:`drop-shadow(0 0 5px ${s.color}60)` }} />
                          <span style={{ color:'rgba(180,210,255,0.45)', fontSize:'9px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:'3px' }}>
                          <span style={{ color:'#e0f0ff', fontWeight:800, fontSize:'18px', lineHeight:1 }}>{s.value}</span>
                          <span style={{ color:s.color, fontSize:'11px', fontWeight:600 }}>{s.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(isMobile || isTablet) && (
                <div style={{ contain: 'layout style' }}>
                  <ChatPanel title="Chat with Health AI" moduleKey="dashboard" responses={chatResponses} autoMessages={autoMessages} />
                </div>
              )}
            </div>

            {!isMobile && !isTablet && (
              <div style={{ contain: 'layout style' }}>
                <ChatPanel title="Chat with Health AI" moduleKey="dashboard" responses={chatResponses} autoMessages={autoMessages} />
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}