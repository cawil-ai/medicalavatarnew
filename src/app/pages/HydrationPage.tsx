import { useState, useEffect, memo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { ChatPanel } from '../components/ChatPanel';
import { Droplet, Clock, TrendingUp, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID, account, Query, Permission } from '../../lib/appwrite';
import '../styles/dashboard.css';

const waterImg  = '/assets/water.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

export function HydrationPage() {
  const [showLogModal, setShowLogModal]   = useState(false);
  const [mounted, setMounted]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const { isMobile, isTablet }            = useResponsive();
  const [currentIntake, setCurrentIntake] = useState(0);
  const [waterLevel, setWaterLevel]       = useState(0);
  const [logData, setLogData]             = useState({
    amount: '', unit: 'ml', time: new Date().toTimeString().slice(0, 5),
  });
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState(2.5);
  const [lastLogged, setLastLogged] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [weather, setWeather] = useState<{ temperature: number; humidity: number } | null>(null);

  const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sun=0
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfWeek = (start: Date) => {
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};


 const calculateWeeklyStreak = (docs: any[]): number => {
  const uniqueDays = new Set<string>();

  docs.forEach(doc => {
    if (doc.date) {
      uniqueDays.add(doc.date);
    }
  });

  return uniqueDays.size;
};

  // const goal       = 2.5;
  const percentage = Math.min((currentIntake / goal) * 100, 100);
  const remaining  = Math.max(goal - currentIntake, 0);
  // const streak     = 4;
  

  useEffect(() => {
    setMounted(true);
    loadTodayIntake();
  }, []);
// useEffect(() => {
//   const scheduleMidnightReset = () => {
//     const now = new Date();

//     const midnight = new Date();
//     midnight.setHours(24, 0, 0, 0); // next local midnight

//     const timeUntilMidnight = midnight.getTime() - now.getTime();

//     setTimeout(() => {
//       console.log("🌅 New day — resetting intake");

//       loadTodayIntake();
//       setCurrentIntake(0);
//       setWaterLevel(0);

//       // ✅ schedule again for next day
//       scheduleMidnightReset();

//     }, timeUntilMidnight);
//   };

//   scheduleMidnightReset();
// }, []);

  useEffect(() => {
    setWaterLevel(Math.min((currentIntake / goal) * 100, 100));
  }, [currentIntake]);

  /* ── Load today's intake from Appwrite ────────────────────────── */
  // const loadTodayIntake = async () => {
  //   try {
  //     const user  = await account.get();
  //     const today = new Date().toISOString().split('T')[0];
  //     const res   = await databases.listDocuments(DATABASE_ID, COLLECTIONS.hydration);
  //     const todayDocs = res.documents.filter(d =>
  //       d.userID === user.$id && d.date === today
  //     );
  //     const total = todayDocs.reduce((sum, d) => sum + (d.amountL || 0), 0);
  //     setCurrentIntake(parseFloat(total.toFixed(2)));
  //     setTimeout(() => setWaterLevel(Math.min((total / goal) * 100, 100)), 300);
  //   } catch (err) {
  //     console.error('❌ Load hydration error:', err);
  //   }
  // };
  const loadTodayIntake = async () => {
  try {
    const user = await account.get();

    const today = new Date().toLocaleDateString('en-CA');

    // const startOfWeek = getStartOfWeek(now);
    // const endOfWeek = getEndOfWeek(startOfWeek);

    // ✅ 1. Get user profile FIRST
    const userProfile = await getUserProfile();

    // ✅ 2. Get weather data
    const location = await getLocation();
    const weatherData = await fetchWeather(location.lat, location.lon);

    setWeather(weatherData.temperature && weatherData.humidity ? weatherData : { temperature: 30, humidity: 70 });

    const calculatedGoal = calculateHydrationGoal(
      userProfile,
      weatherData.temperature, 
      weatherData.humidity
    );

  setGoal(calculatedGoal);

    console.log(
      "Calculated Goal:",
      calculatedGoal,
      "Temp:",
      weatherData.temperature,
      "Humidity:",
      weatherData.humidity
    );
    console.log(currentIntake, goal, percentage);

    // setGoal(calculatedGoal);

    // console.log(
    //   "Calculated Goal:",
    //   calculatedGoal,
    //   "Temp:",
    //   weather?.temperature,
    //   "Humidity:",
    //   weather?.humidity
    // );

    // ✅ 2. Get hydration data
    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.hydration,
      [
        Query.equal('userID', user.$id),
        Query.orderDesc('date'),
        Query.limit(500),
      ]
    );

    setDocs(res.documents);
    console.log("Fetched hydration docs:", res.documents.length);

    // ✅ 3. Compute today's intake
    const todayLogs = res.documents.filter(d => d.date === today);

    const todayIntake = todayLogs.reduce((sum, d) => sum + (d.amountL || 0), 0);

    setCurrentIntake(todayIntake);
    console.log("Today's total intake (L):", todayIntake);

    if (calculatedGoal > 0) {
      setWaterLevel(Math.min((todayIntake / calculatedGoal) * 100, 100));
    }
    console.log("Computed Intake:", todayIntake);
    console.log("Computed Goal:", calculatedGoal);
    console.log("Computed %:", (todayIntake / calculatedGoal) * 100);
    const latestLog = res.documents.reduce<any | null>(
      (latest, doc) => {
        if (!latest) return doc;

        return new Date(doc.loggedAt) > new Date(latest.loggedAt)
          ? doc
          : latest;
      },
      null
    );
    setLastLogged(latestLog?.loggedAt || null);


    // ✅ 4. Use calculatedGoal (not old goal)

    // ✅ 5. Streak
    const calculatedStreak = calculateWeeklyStreak(res.documents);
    setStreak(calculatedStreak);

    // ✅ Debug
    // console.log("Start:", startOfWeek);
    // console.log("End:", endOfWeek);
    console.log("Docs:", res.documents);

  } catch (err) {
    console.error('❌ Load hydration error:', err);
  }
};
const getUserProfile = async () => {
  const user = await account.get();

  const res = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.users,
    [Query.equal('userID', user.$id)]
  );

  return res.documents[0];
};
const getLocation = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      (err) => reject(err)
    );
  });
};
const fetchWeather = async (lat: number, lon: number) => {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=f20e5cf1073cc5d14568da78dfcd9ab7&units=metric`
    );

    const data = await res.json();

    console.log("Weather API response:", data);

    // ✅ If API fails, DO NOT throw
    if (data.cod !== 200 || !data.main) {
      console.warn("Using fallback weather data");
      return {
        temperature: 30,
        humidity: 70,
      };
    }

    return {
      temperature: data.main.feels_like, // ✅ use this instead
      humidity: data.main.humidity,
    };

  } catch (err) {
    console.warn("Weather fetch failed, using fallback");

    return {
      temperature: 30,
      humidity: 70,
    };
  }
};

navigator.geolocation.getCurrentPosition(
  (position) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    console.log("Lat:", lat, "Lon:", lon);

    fetchWeather(lat, lon);
  },
  (error) => {
    console.error("Location error:", error);
  }
);
const calculateHydrationGoal = (
  user: any,
  temperature: number,
  humidity: number
) => {
  const weight = user.weightKg || 60;
  const gender = user.gender || 'female';

  const baseGoal = gender === 'male' ? 3.7 : 2.7;
  const weightFactor = weight * 0.033;

  const baseHydration = Math.max(baseGoal, weightFactor);

  // ✅ Climate effect
  let climateAdjustment = 0;

  if (temperature >= 40) climateAdjustment += 1.0;
  else if (temperature >= 35) climateAdjustment += 0.8;
  else if (temperature >= 30) climateAdjustment += 0.6;
  else if (temperature >= 25) climateAdjustment += 0.4;
  else if (temperature >= 20) climateAdjustment += 0.2;


  if (humidity > 80) climateAdjustment += 0.3;
  else if (humidity > 70) climateAdjustment += 0.2;
  else if (humidity > 60) climateAdjustment += 0.1;


  const total = Math.min(baseHydration + climateAdjustment, 5);

  return parseFloat(total.toFixed(2));
};

  /* ── Save intake to Appwrite ──────────────────────────────────── */
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const user = await account.get();
      const today = new Date().toLocaleDateString('en-CA');

      const amountML = logData.unit === 'ml'
        ? parseFloat(logData.amount)
        : parseFloat(logData.amount) * 29.5735;
      const amountL = amountML / 1000;

      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.hydration,
        ID.unique(),
        {
          userID:    user.$id,
          amountML:  amountML,
          amountL:   amountL,
          drinkType: 'Water',
          logTime:   logData.time,
          dailyGoalL: goal,
          date:      today,
          loggedAt:  new Date().toISOString(),
        }
      );
      console.log('✅ Hydration saved:', doc);
      setCurrentIntake(prev => parseFloat((prev + amountL).toFixed(2)));
      toast.success('Water intake logged!');
      setShowLogModal(false);
      setLogData({ amount: '', unit: 'ml', time: new Date().toTimeString().slice(0, 5) });
    } catch (err) {
      console.error('❌ Save hydration error:', err);
      toast.error('Failed to save. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const chatResponses = {
    water:     `You've had ${currentIntake.toFixed(1)}L today. You need ${remaining.toFixed(1)}L more.`,
    hydration: `You are ${percentage.toFixed(0)}% to your ${goal}L goal. Keep drinking!`,
    remaining: `${remaining.toFixed(1)}L remaining — about ${Math.ceil(remaining * 4)} glasses.`,
    goal:      `Your daily hydration goal is ${goal}L. You've consumed ${currentIntake.toFixed(1)}L so far.`,
  };

const buildWeeklyIntake = (docs: any[]) => {
  const now = new Date();

  // ✅ get start of week (Monday)
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  // ✅ end of week
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const weekData = [0, 0, 0, 0, 0, 0, 0];

  docs.forEach(doc => {
    if (!doc.loggedAt) return;

    const d = new Date(doc.loggedAt);

    // ✅ filter THIS WEEK only
    if (d < start || d > end) return;

    const jsDay = d.getDay(); // Sun=0
    const index = jsDay === 0 ? 6 : jsDay - 1;

    weekData[index] += doc.amountL || 0;
  });

  return weekData;
};
const buildHourlyData = (docs: any[]) => {
  const now = new Date();

  const today =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  const hours = [6, 8, 10, 12, 14, 16, 18, 20];
  const data = Array(hours.length).fill(0);

  docs.forEach(doc => {
    if (!doc.loggedAt) return;

    const d = new Date(doc.loggedAt);

    // ✅ FILTER: only today
    const docDate =
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    if (docDate !== today) return;

    const hour = d.getHours();

    const index = hours.findIndex(h => hour >= h && hour < h + 2);

    if (index !== -1) {
      data[index] += (doc.amountL || 0) * 1000; // ml
    }
  });

  return data;
};

  const weeklyData = {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [{
      label: 'Liters',
      data: buildWeeklyIntake(docs), // pass actual docs here
      backgroundColor: (ctx: any) => ctx.dataIndex === 6 ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.35)',
      borderRadius: 8,
    }],
  };

  const hourlyData = {
    labels: ['6am','8am','10am','12pm','2pm','4pm','6pm','8pm'],
    datasets: [{
      label: 'ml',
      data: buildHourlyData(docs), // pass actual docs here
      borderColor: 'rgba(59,130,246,1)',
      backgroundColor: 'rgba(59,130,246,0.12)',
      fill: true, tension: 0.4,
      pointBackgroundColor: 'rgba(96,165,250,1)',
      pointRadius: 4,
    }],
  };

  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(180,210,255,0.7)', font: { size: 11 } } },
      tooltip: { backgroundColor:'rgba(8,20,50,0.95)', titleColor:'#fff', bodyColor:'rgba(180,210,255,0.85)' },
    },
    scales: {
      y: { grid:{ color:'rgba(255,255,255,0.06)' }, ticks:{ color:'rgba(180,210,255,0.5)' } },
      x: { grid:{ color:'rgba(255,255,255,0.06)' }, ticks:{ color:'rgba(180,210,255,0.5)' } },
    },
  };

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)',
    borderRadius: '18px',
    padding: '20px 22px',
    transition: 'all 0.3s ease',
  };

const formatTimeParts = (dateStr: string) => {
  const d = new Date(dateStr);

  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  const period = hours >= 12 ? 'PM' : 'AM';

  const formattedHour = hours % 12 || 12;

  return {
    value: `${formattedHour}:${minutes}`, // "3:00"
    unit: period,                         // "PM"
  };
};
  const metrics = [
    { label:"Today's Intake", value: `${currentIntake.toFixed(1)}`, unit:'L',  color:'#3b82f6', icon:Droplet,    desc:`${percentage.toFixed(0)}% of goal` },
    { label:'Remaining',      value: `${remaining.toFixed(1)}`,     unit:'L',  color:'#38bdf8', icon:Target,     desc:`${Math.ceil(remaining*4)} glasses left` },
    { label:'Daily Goal',     value: `${goal}`,                     unit:'L',  color:'#22c55e', icon:TrendingUp, desc:'Recommended intake' },
    { label:'Last Logged',    value: lastLogged ? formatTimeParts(lastLogged).value : formatTimeParts('2023-10-01T15:00:00').value, unit: lastLogged ? formatTimeParts(lastLogged).unit : formatTimeParts('2023-10-01T15:00:00').unit, color:'#a78bfa', icon:Clock,      desc:'45 min ago' },
  ];
// const getAutoMessage = (temperature?: number) => {
//   // ✅ fallback if weather not ready yet
//   const temp = temperature !== undefined ? Math.round(temperature) : 30;

//   if (temp >= 40) {
//     return `🔥 Extremely hot (${temp}°C). Drink water frequently to avoid dehydration!`;
//   }

//   if (temp >= 35) {
//     return `☀️ It's very hot today (${temp}°C). Make sure to drink more water than usual.`;
//   }

//   if (temp >= 30) {
//     return `🌤 Warm weather (${temp}°C). Stay hydrated throughout the day.`;
//   }

//   if (temp >= 25) {
//     return `🙂 Comfortable weather — keep sipping water regularly.`;
//   }

//   return `❄️ Cooler weather today. Don’t forget to stay hydrated!`;
// };

console.log("Current weather:", weather);

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(22px);} to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn   { from{opacity:0;} to{opacity:1;} }
        @keyframes ringPulse{ 0%{transform:scale(1);opacity:.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes waterTilt {
          0%,100%{ transform:rotate(0deg) translateY(0); filter:drop-shadow(0 8px 24px rgba(59,130,246,0.45)); }
          25%    { transform:rotate(-4deg) translateY(-6px); filter:drop-shadow(0 14px 32px rgba(59,130,246,0.6)); }
          75%    { transform:rotate(3deg) translateY(-3px); filter:drop-shadow(0 10px 28px rgba(59,130,246,0.5)); }
        }
        @keyframes ripple {
          0%   { transform:translateX(-100%); }
          100% { transform:translateX(100%); }
        }
        @keyframes streakPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.1) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes drip {
          0%,100%{ transform:translateY(0) scale(1); opacity:.7; }
          50%    { transform:translateY(8px) scale(0.85); opacity:1; }
        }
        @keyframes barFill { from{ width:0%; } }
        .hyd-card:hover  { transform:translateY(-3px) !important; box-shadow:0 12px 40px rgba(59,130,246,0.25) !important; }
        .organ-card:hover{ transform:translateY(-4px) scale(1.015) !important; }
        .log-btn:hover   { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(59,130,246,0.45) !important; }
        .hyd-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(100,180,255,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .hyd-input:focus { border-color:rgba(59,130,246,0.7); background:rgba(255,255,255,0.11); box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
        .hyd-input::placeholder { color:rgba(180,210,255,0.35); }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(59,130,246,0.25); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding:0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 320px', gap:'22px', minHeight:'calc(100vh - 73px)' }}>

            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

              {/* Page Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ position:'relative', width:52, height:52 }}>
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(59,130,246,0.15)', animation:'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position:'absolute', inset:'8px', borderRadius:'50%', background:'rgba(59,130,246,0.2)', animation:'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Droplet size={22} color="#60a5fa" />
                    </div>
                  </div>
                  <div>
                    <h1 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'22px', margin:0, letterSpacing:'-0.3px' }}>Hydration Tracker</h1>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:'2px 0 0' }}>Stay hydrated, stay healthy</p>
                  </div>
                </div>
                <button className="log-btn" onClick={() => setShowLogModal(true)}
                  style={{ background:'linear-gradient(135deg,#3b82f6,#0ea5e9)', border:'none', borderRadius:'12px', padding:'12px 22px', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 18px rgba(59,130,246,0.35)', transition:'all .2s ease', letterSpacing:'0.02em' }}>
                  Log Water
                </button>
              </div>

              {/* Hero Cards */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'16px', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>

                {/* Water Glass Card */}
                <div style={{ ...card, border:'1px solid rgba(59,130,246,0.25)', display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'28px 20px', position:'relative', overflow:'hidden' }} className="organ-card">
                  {[{left:'15%',d:0},{left:'50%',d:0.8},{left:'80%',d:1.4}].map((p,i) => (
                    <div key={i} style={{ position:'absolute', top:'10px', left:p.left, width:6, height:9, borderRadius:'50% 50% 50% 50% / 60% 60% 40% 40%', background:'rgba(96,165,250,0.6)', animation:`drip 2s ease-in-out infinite`, animationDelay:`${p.d}s`, pointerEvents:'none' }} />
                  ))}
                  <div style={{ position:'absolute', bottom:'-20px', left:'50%', transform:'translateX(-50%)', width:'180px', height:'90px', background:'rgba(59,130,246,0.1)', filter:'blur(35px)', borderRadius:'50%', pointerEvents:'none' }} />
                  <img src={waterImg} alt="Water" style={{ width:150, height:150, objectFit:'contain', animation:'waterTilt 4s ease-in-out infinite', filter:'drop-shadow(0 8px 28px rgba(59,130,246,0.55))' }} />
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 5px' }}>Today's Intake</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background: percentage >= 100 ? '#22c55e' : '#38bdf8', boxShadow:`0 0 5px ${percentage >= 100 ? '#22c55e' : '#38bdf8'}` }} />
                      <span style={{ color: percentage >= 100 ? '#22c55e' : '#38bdf8', fontSize:'12px', fontWeight:600 }}>{currentIntake.toFixed(1)}L of {goal}L</span>
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'4px 0 0' }}>{percentage.toFixed(0)}% complete</p>
                  </div>
                </div>

                {/* Streak Card */}
                <div style={{ ...card, border:'1px solid rgba(251,191,36,0.25)', display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'28px 20px', position:'relative', overflow:'hidden' }} className="organ-card">
                  <div style={{ position:'absolute', bottom:'-20px', left:'50%', transform:'translateX(-50%)', width:'180px', height:'90px', background:'rgba(251,191,36,0.08)', filter:'blur(35px)', borderRadius:'50%', pointerEvents:'none' }} />
                  <div style={{ position:'relative' }}>
                    <img src={streakImg} alt="Streak" style={{ width:140, height:140, objectFit:'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.3s both' : 'none', filter:'drop-shadow(0 0 28px rgba(251,191,36,0.55))' }} />
                    <div style={{ position:'absolute', bottom:8, right:0, width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'3px solid rgba(8,20,50,0.9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.6s ease 0.6s both' : 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 5px' }}>Hydration Streak</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#fbbf24', boxShadow:'0 0 5px #fbbf24' }} />
                      <span style={{ color:'#fbbf24', fontSize:'12px', fontWeight:600 }}>{streak} days in a row</span>
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'4px 0 0' }}>Goal met every day</p>
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:'14px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                {metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} style={{ ...card, border:`1px solid ${m.color}22`, cursor:'default' }} className="hyd-card">
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                        <div style={{ width:32, height:32, borderRadius:'9px', background:`${m.color}18`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 10px ${m.color}30` }}>
                          <Icon size={16} color={m.color} />
                        </div>
                        <span style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>{m.label}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'baseline', gap:'4px', marginBottom:'4px' }}>
                        <span style={{ fontSize:'28px', fontWeight:900, color:'#fff', lineHeight:1 }}>{m.value}</span>
                        <span style={{ fontSize:'13px', color:m.color, fontWeight:600 }}>{m.unit}</span>
                      </div>
                      <p style={{ color:'rgba(180,210,255,0.35)', fontSize:'11px', margin:0 }}>{m.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div style={{ background:'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(14,165,233,0.15))', backdropFilter:'blur(20px)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'18px', padding:'22px 24px', animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:'-30px', right:'-20px', width:'140px', height:'140px', borderRadius:'50%', background:'rgba(59,130,246,0.1)', filter:'blur(35px)', pointerEvents:'none' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <div>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Daily Progress</p>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:0 }}>
                      {currentIntake.toFixed(1)}L <span style={{ color:'rgba(180,210,255,0.4)', fontWeight:400 }}>/ {goal}L</span>
                    </p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ color:'#60a5fa', fontWeight:800, fontSize:'22px' }}>{percentage.toFixed(0)}%</span>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:0 }}>{remaining.toFixed(1)}L to go</p>
                  </div>
                </div>
                <div style={{ height:'12px', borderRadius:'6px', background:'rgba(255,255,255,0.07)', overflow:'hidden', position:'relative' }}>
                  <div style={{ height:'100%', borderRadius:'6px', background:'linear-gradient(90deg,#3b82f6,#38bdf8,#7dd3fc)', width:`${waterLevel}%`, boxShadow:'0 0 12px rgba(59,130,246,0.6)', transition:'width 1.5s cubic-bezier(.4,0,.2,1)', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)', animation:'ripple 2s ease-in-out infinite' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'14px', flexWrap:'wrap' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ width:24, height:28, borderRadius:'4px 4px 6px 6px', background: i < Math.floor(currentIntake / 0.25) ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.07)', border: i < Math.floor(currentIntake / 0.25) ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)', transition:'all 0.4s ease', boxShadow: i < Math.floor(currentIntake / 0.25) ? '0 0 8px rgba(59,130,246,0.4)' : 'none', transitionDelay:`${i * 0.05}s` }} />
                  ))}
                  <span style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', alignSelf:'center', marginLeft:'4px' }}>glasses (250ml each)</span>
                </div>
              </div>

              {/* Charts */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'16px', animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <div style={card}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Weekly</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>7-Day Intake</p>
                  <div style={{ height:'200px' }}><Bar options={chartOpts} data={weeklyData} /></div>
                </div>
                <div style={card}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Timeline</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>Hourly Intake</p>
                  <div style={{ height:'200px' }}><Line options={chartOpts} data={hourlyData} /></div>
                </div>
              </div>
            </div>

            {/* Chat */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Hydration AI"
                moduleKey="hydration"
                responses={chatResponses}
                defaultResponse="Staying hydrated is key to energy and focus. Keep sipping throughout the day."
                autoMessages={[{ text: `Staying hydrated is key to energy and focus. Keep drinking water throughout the day.`, delay: 1500 }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Log Water Modal */}
      {showLogModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,5,20,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .25s ease' }} onClick={() => setShowLogModal(false)}>
          <div style={{ background:'#0d1a38', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'22px', padding:'36px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', animation:'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
              <div style={{ width:40, height:40, borderRadius:'12px', background:'rgba(59,130,246,0.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Droplet size={20} color="#60a5fa" />
              </div>
              <div>
                <h4 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'18px', margin:0 }}>Log Water Intake</h4>
                <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>Record your hydration</p>
              </div>
            </div>
            <form onSubmit={handleLogSubmit}>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Amount</label>
                <input type="number" step="1" className="hyd-input" placeholder="e.g. 250" value={logData.amount} onChange={e => setLogData({...logData, amount: e.target.value})} required />
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Unit</label>
                <select className="hyd-input" value={logData.unit} onChange={e => setLogData({...logData, unit: e.target.value})} style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.25)', borderRadius:'10px', color:'#e0f0ff', fontSize:'14px', outline:'none' }}>
                  <option value="ml" style={{ background:'#0d1a38' }}>Milliliters (ml)</option>
                  <option value="oz" style={{ background:'#0d1a38' }}>Ounces (oz)</option>
                </select>
              </div>
              <div style={{ marginBottom:'28px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>Time</label>
                <input type="time" className="hyd-input" value={logData.time} onChange={e => setLogData({...logData, time: e.target.value})} required />
              </div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
                {[150,200,250,350,500].map(ml => (
                  <button key={ml} type="button" onClick={() => setLogData({...logData, amount: String(ml), unit:'ml'})}
                    style={{ padding:'7px 12px', background: logData.amount === String(ml) ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)', border: logData.amount === String(ml) ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(100,180,255,0.15)', borderRadius:'8px', color: logData.amount === String(ml) ? '#60a5fa' : 'rgba(180,210,255,0.5)', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
                    {ml}ml
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button type="submit" disabled={saving}
                  style={{ flex:1, padding:'13px', background: saving ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#0ea5e9)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:'0 4px 18px rgba(59,130,246,0.35)', transition:'all .2s' }}
                  onMouseEnter={e => { if(!saving){ e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
                  {saving ? 'Saving...' : 'Save Intake'}
                </button>
                <button type="button" onClick={() => setShowLogModal(false)}
                  style={{ flex:1, padding:'13px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(100,180,255,0.2)', borderRadius:'12px', color:'rgba(180,210,255,0.8)', fontWeight:700, fontSize:'14px', cursor:'pointer', transition:'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
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