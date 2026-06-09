import { useState, useEffect, useRef, memo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);
import { Sidebar }   from '../components/Sidebar';
import { Header }    from '../components/Header';
import { ChatPanel } from '../components/ChatPanel';
import { Footprints, MapPin, Clock, TrendingUp, RefreshCw, Zap, Activity } from 'lucide-react';
import { toast }     from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { databases, DATABASE_ID, COLLECTIONS, ID, account, Query, Permission } from '../../lib/appwrite';
// import { useStravaSteps, type StravaActivity } from '../hooks/useStravaSteps';

const stepsImg  = '/assets/steps.png';
const medalImg  = '/assets/medal.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

/* ══════════════════════════════════════════════════════════════════
   ACCURATE STEP COUNTER — Accelerometer + Gyroscope Fusion (v2)
══════════════════════════════════════════════════════════════════ */
function useStepCounter() {
  const [steps, setSteps]                 = useState(0);
  const [isTracking, setIsTracking]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [supported, setSupported]         = useState(true);
  const [gyroAvailable, setGyroAvailable] = useState(false);

  const stepsRef      = useRef(0);
  const lastStepTime  = useRef(0);
  const peakDetected  = useRef(false);
  const gravityRef    = useRef({ x: 0, y: 0, z: 9.8 });
  const gyroRateRef   = useRef(0);
  const prevOrient    = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const prevOrientTs  = useRef(0);
  const accelHistory  = useRef<number[]>([]);
  const recentSpikes  = useRef<number[]>([]);
  const lastPeaks     = useRef<number[]>([]);
  const stairDirection = useRef<'up' | 'down' | null>(null);
  const prevZ = useRef(0);

  useEffect(() => { stepsRef.current = steps; }, [steps]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('DeviceMotionEvent' in window)) setSupported(false);
    if ('DeviceOrientationEvent' in window) setGyroAvailable(true);
  }, []);

  const startTracking = async () => {
    setError(null);
    const DME = DeviceMotionEvent as any;
    const DOE = DeviceOrientationEvent as any;

    if (typeof DME.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission();
        if (result !== 'granted') {
          setError('Motion access denied. Go to iOS Settings → Safari → Motion & Orientation Access and enable it.');
          return;
        }
      } catch {
        setError('Could not request motion permission. Ensure the app is served over HTTPS.');
        return;
      }
    }
    if (typeof DOE.requestPermission === 'function') {
      try { await DOE.requestPermission(); } catch { /* gyro optional */ }
    }
    if (!('DeviceMotionEvent' in window)) {
      setError('Your device does not support motion detection.');
      setSupported(false);
      return;
    }
    gravityRef.current   = { x: 0, y: 0, z: 9.8 };
    gyroRateRef.current  = 0;
    prevOrientTs.current = 0;
    accelHistory.current = [];
    recentSpikes.current = [];
    lastPeaks.current    = [];
    setIsTracking(true);
    toast.success('Step tracking started! Keep your phone in your pocket or hand.');
  };

  const stopTracking = () => {
    setIsTracking(false);
    toast.success(`Tracking stopped. ${stepsRef.current} steps recorded this session.`);
  };

  const resetSteps = () => { setSteps(0); stepsRef.current = 0; };

  useEffect(() => {
    if (!isTracking) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      const elapsed = now - prevOrientTs.current;
      if (prevOrientTs.current > 0 && elapsed > 0 && elapsed < 250) {
        const da = Math.abs((e.alpha ?? 0) - prevOrient.current.alpha);
        const db = Math.abs((e.beta  ?? 0) - prevOrient.current.beta);
        const dg = Math.abs((e.gamma ?? 0) - prevOrient.current.gamma);
        gyroRateRef.current = Math.sqrt(da * da + db * db + dg * dg) / (elapsed / 1000);
      }
      prevOrient.current   = { alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 };
      prevOrientTs.current = now;
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking) return;
    const ALPHA = 0.1;
    const ACCEL_THRESHOLD  = 3.2;
    const GYRO_THRESHOLD   = 18;
    const GYRO_STALE_MS    = 300;
    const COOLDOWN         = 550;
    const HISTORY_SIZE     = 6;
    const MAX_STEP_RATE    = 2.2;
    const SHAKE_BURST_MS   = 600;
    const SHAKE_BURST_COUNT = 4;

    const handleMotion = (e: DeviceMotionEvent) => {
      const raw = e.acceleration ?? e.accelerationIncludingGravity;
      if (!raw) return;
      const rx = raw.x ?? 0, ry = raw.y ?? 0, rz = raw.z ?? 0;
      let lx = rx, ly = ry, lz = rz;
      const vertical = lz; // Z-axis is vertical (after gravity removal)
      const dz = vertical - prevZ.current;
      prevZ.current = vertical;

      // Detect consistent downward movement
      if (dz < -0.8) {
        stairDirection.current = 'down';
      } else if (dz > 0.8) {
        stairDirection.current = 'up';
      }

      if (!e.acceleration) {
        gravityRef.current.x = ALPHA * rx + (1 - ALPHA) * gravityRef.current.x;
        gravityRef.current.y = ALPHA * ry + (1 - ALPHA) * gravityRef.current.y;
        gravityRef.current.z = ALPHA * rz + (1 - ALPHA) * gravityRef.current.z;
        lx = rx - gravityRef.current.x;
        ly = ry - gravityRef.current.y;
        lz = rz - gravityRef.current.z;
      }
      const accelMag = Math.sqrt(lx * lx + ly * ly + lz * lz);
      const now = Date.now();

      accelHistory.current.push(accelMag);
      if (accelHistory.current.length > HISTORY_SIZE) accelHistory.current.shift();
      const avg = accelHistory.current.reduce((a, b) => a + b, 0) / accelHistory.current.length;
      const dynamicThreshold = Math.max(ACCEL_THRESHOLD, avg * 1.4);

      const gyroFresh    = (now - prevOrientTs.current) < GYRO_STALE_MS;
      const gyroConfirms = gyroFresh && gyroRateRef.current > GYRO_THRESHOLD;
      const effectiveThreshold = gyroConfirms ? dynamicThreshold : dynamicThreshold * 1.8;

      if (accelMag > ACCEL_THRESHOLD) {
        recentSpikes.current.push(now);
        while (recentSpikes.current.length > 0 && now - recentSpikes.current[0] > SHAKE_BURST_MS) {
          recentSpikes.current.shift();
        }
      }
      const isShakeBurst = recentSpikes.current.length >= SHAKE_BURST_COUNT;

      const recentStepTimes = lastPeaks.current.filter(t => now - t < 3000);
      let rhythmOk = true;
      if (recentStepTimes.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < recentStepTimes.length; i++) intervals.push(recentStepTimes[i] - recentStepTimes[i - 1]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (1000 / avgInterval > MAX_STEP_RATE) rhythmOk = false;
      }
      
      const stairBoost =
        stairDirection.current === 'down' ? 0.7 : 1;

      if (
        accelMag > effectiveThreshold * stairBoost &&
        !isShakeBurst && rhythmOk &&
        !peakDetected.current &&
        now - lastStepTime.current > COOLDOWN
      ) {
        peakDetected.current = true;
        lastStepTime.current = now;
        lastPeaks.current.push(now);
        if (lastPeaks.current.length > 4) lastPeaks.current.shift();
        setSteps(s => s + 1);
      }
      if (accelMag < effectiveThreshold * 0.55) peakDetected.current = false;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isTracking]);

  return { steps, isTracking, error, supported, gyroAvailable, startTracking, stopTracking, resetSteps };
}

/* ══════════════════════════════════════════════════════════════════
   STRAVA ACTIVITY CARD
══════════════════════════════════════════════════════════════════ */
// function StravaActivityCard({ activity }: { activity: StravaActivity }) {
//   const icons: Record<string, string> = {
//     Run: '🏃', Walk: '🚶', Hike: '🥾', TrailRun: '⛰️',
//     VirtualRun: '💻', Workout: '💪',
//   };
//   const icon = icons[activity.sport_type || activity.type] ?? '🏃';
//   const km   = (activity.distance / 1000).toFixed(2);
//   const mins = Math.floor(activity.moving_time / 60);
//   const pace = activity.distance > 0
//     ? `${Math.floor(activity.moving_time / 60 / (activity.distance / 1000))}:${String(Math.round((activity.moving_time / 60 / (activity.distance / 1000) % 1) * 60)).padStart(2, '0')} /km`
//     : '—';

//   return (
//     <div style={{ padding: '12px 14px', background: 'rgba(251,130,24,0.06)', border: '1px solid rgba(252,100,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
//       <span style={{ fontSize: '22px' }}>{icon}</span>
//       <div style={{ flex: 1, minWidth: 0 }}>
//         <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '13px', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.name}</p>
//         <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', margin: 0 }}>
//           {km} km · {mins} min · {pace}
//         </p>
//       </div>
//       <div style={{ textAlign: 'right', flexShrink: 0 }}>
//         <p style={{ color: '#fb8218', fontWeight: 800, fontSize: '15px', margin: '0 0 2px' }}>
//           {(activity.steps ?? 0).toLocaleString()}
//         </p>
//         <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '10px', margin: 0 }}>steps</p>
//       </div>
//     </div>
//   );
// }

/* ══════════════════════════════════════════════════════════════════
   STEPS PAGE
══════════════════════════════════════════════════════════════════ */
export function StepsPage() {
  const [showLogModal,  setShowLogModal]  = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const { isMobile, isTablet }            = useResponsive();
  const [currentSteps, setCurrentSteps]   = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [logData, setLogData]             = useState({ steps: '', activity: 'walking', duration: '', notes: '' });
  const [activeTab, setActiveTab]         = useState<'sensor' | 'strava'>('sensor');
  const [profile, setProfile] = useState<any>(null);
  const [weeklySteps, setWeeklySteps] = useState<number[]>([0,0,0,0,0,0,0]);
  const [hourlySteps, setHourlySteps] = useState<number[]>(Array(8).fill(0));
  const [activeMinutes, setActiveMinutes] = useState(Array(8).fill(0));
  const [hourlyDuration, setHourlyDuration] = useState(Array(8).fill(0));
  const loadHourlyDuration = async () => {
  try {
    const user = await account.get();
    const today = getLocalDate();

    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.steps
    );

    const todayDocs = res.documents.filter(
      (d: any) => d.userID === user.$id && d.date === today
    );

    const buckets = Array(8).fill(0);

    todayDocs.forEach((doc: any) => {
      const date = new Date(doc.loggedAt);
      const hour = date.getHours();

      if (hour >= 6 && hour < 22) {
        const index = Math.floor((hour - 6) / 2);

        buckets[index] += doc.duration || 0; // ✅ minutes
      }
    });

    setHourlyDuration(buckets);

  } catch (err) {
    console.error('❌ Hourly duration error:', err);
  }
};
useEffect(() => {
  loadHourlyDuration();
}, []);

const hourlyDurationHours = hourlyDuration.map(min =>
  +(min / 60).toFixed(1)
);

  

  // ── Strava ────────────────────────────────────────────────────────
  // const {
  //   stravaSteps, stravaActivities,
  //   loading: stravaLoading, error: stravaError,
  //   lastSynced, sync: stravaSync, isConnected: stravaConnected,
  // } = useStravaSteps();

  // ── Sensor step counter ───────────────────────────────────────────
  const { steps: sensorSteps, isTracking, error: sensorError, supported: sensorSupported, gyroAvailable, startTracking, stopTracking, resetSteps } = useStepCounter();
  const getBurnGoalFromCalories = (recommendedCalories: number) => {
  // ✅ 20–25% deficit is ideal for fat loss
  const burnGoal = Math.round(recommendedCalories * 0.22);

  const stepGoal = Math.round(burnGoal / 0.04);

  return { burnGoal, stepGoal };
};
  
const hasProfile = !!profile?.recommendedCalories;

  const burnData = hasProfile
    ? getBurnGoalFromCalories(profile.recommendedCalories)
    : { burnGoal: 0, stepGoal: 10000 };

  const { burnGoal, stepGoal } = burnData;
const calculateWeeklyStreak = (docs: any[]) => {
  if (!docs.length) return 0;

  const today = new Date();

  // ✅ start of week (Monday)
  const start = new Date();
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const startStr = start.toLocaleDateString('en-CA');
  const todayStr = today.toLocaleDateString('en-CA');

  const uniqueDays = [...new Set(docs.map(d => d.date))];

  // ✅ filter only THIS WEEK
  const thisWeekDays = uniqueDays.filter(d => d >= startStr && d <= todayStr);

  return thisWeekDays.length;
};
const [streak, setStreak] = useState(0);

  

  // ── Combined totals ───────────────────────────────────────────────
  // DB steps (already saved) + live Strava sync + live sensor
  // const totalSteps  = currentSteps + stravaSteps + sensorSteps;
  const totalSteps  = currentSteps + sensorSteps;
  const goal        = 10000;
  const percentage  = Math.min((totalSteps / goal) * 100, 100);
  const distance    = (totalSteps * 0.0007).toFixed(1);
  const remaining   = Math.max(goal - totalSteps, 0);
  // const streak      = 5;
  const goalMet     = totalSteps >= goal;
  const calories   = Math.round(totalSteps * 0.04);
  useEffect(() => {
  const loadProfile = async () => {
    try {
      const user = await account.get();

      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.users
      );

      const userProfile = res.documents.find(
        (d: any) => d.userID === user.$id
      );

      if (userProfile) setProfile(userProfile);
    } catch (err) {
      console.error('❌ Load profile error:', err);
    }
  };

  loadProfile();
}, []);




  const caloriesBurned = Math.round(totalSteps * 0.04);
  const remainingCalories = Math.max(burnGoal - caloriesBurned, 0);


  // Displayed step count in header depends on active tab
  // const displaySteps = activeTab === 'strava' ? stravaSteps : sensorSteps;
  const displaySteps = sensorSteps;
  const sensorPct    = Math.min((sensorSteps / goal) * 100, 100);
  // const stravaPct    = Math.min((stravaSteps / goal) * 100, 100);
  const remainingBurn = burnGoal - calories;

  useEffect(() => { setMounted(true); loadTodaySteps(); }, []);
  const getLocalDate = () => {
    const now = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day   = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };
  useEffect(() => {
    const today = getLocalDate();
    const last = localStorage.getItem('lastDate');

    if (!last) {
      localStorage.setItem('lastDate', today);
    }
  }, []);

  const loadTodaySteps = async () => {
    try {
      const user      = await account.get();
      const today     = getLocalDate();
      const res       = await databases.listDocuments(DATABASE_ID, COLLECTIONS.steps);
      const todayDocs = res.documents.filter(d => d.userID === user.$id && d.date === today);
      setCurrentSteps(todayDocs.reduce((s, d) => s + (d.steps || 0), 0));
      setStreak(calculateWeeklyStreak(res.documents));
    } catch (err) { console.error('❌ Load steps error:', err); }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const user  = await account.get();
      const steps = parseInt(logData.steps || '0');
      const today = getLocalDate();
      await databases.createDocument(DATABASE_ID, COLLECTIONS.steps, ID.unique(), {
        userID: user.$id, steps,
        distanceKm:     parseFloat((steps * 0.0007).toFixed(2)),
        caloriesBurned: Math.round(steps * 0.04),
        date:           today,
        duration:       logData.duration ? parseInt(logData.duration) : Math.max(1, Math.round(steps / 100)),
        loggedAt:       new Date().toISOString(),
        source:         'manual',
      });
      setCurrentSteps(p => p + steps);
      toast.success('Steps logged!');
      setShowLogModal(false);
      setLogData({ steps: '', activity: 'walking', duration: '', notes: '' });
    } catch (err) { console.error('❌ Save steps error:', err); toast.error('Failed to save steps.'); }
    finally { setSaving(false); }
  };

  /** Save sensor-detected steps to Appwrite */
  const handleSaveSensorSteps = async () => {
    if (sensorSteps === 0) { toast.error('No steps to save yet!'); return; }
    setSaving(true);
    try {
      const user  = await account.get();
      const today = getLocalDate();
      await databases.createDocument(DATABASE_ID, COLLECTIONS.steps, ID.unique(), {
        userID:         user.$id,
        steps:          sensorSteps,
        distanceKm:     parseFloat((sensorSteps * 0.0007).toFixed(2)),
        caloriesBurned: Math.round(sensorSteps * 0.04),
        date:           today,
        loggedAt:       new Date().toISOString(),
        source:         'sensor',
        duration:      Math.max(1, Math.round(sensorSteps / 100)),
      });
      setCurrentSteps(p => p + sensorSteps);
      resetSteps();
      setShowSaveModal(false);
      toast.success(`${sensorSteps} steps saved!`);
    } catch (err) { console.error('❌ Save sensor steps error:', err); toast.error('Failed to save sensor steps.'); }
    finally { setSaving(false); }
  };

  /** Save Strava steps to Appwrite (one doc per activity) */
  // const handleSaveStravaSteps = async () => {
  //   if (stravaSteps === 0) { toast.error('No Strava steps to save!'); return; }
  //   setSaving(true);
  //   try {
  //     const user  = await account.get();
  //     const today = new Date().toISOString().split('T')[0];
  //     for (const act of stravaActivities) {
  //       if ((act.steps ?? 0) === 0) continue;
  //       await databases.createDocument(DATABASE_ID, COLLECTIONS.steps, ID.unique(), {
  //         userID:         user.$id,
  //         steps:          act.steps ?? 0,
  //         distanceKm:     parseFloat((act.distance / 1000).toFixed(2)),
  //         caloriesBurned: Math.round((act.steps ?? 0) * 0.04),
  //         date:           today,
  //         loggedAt:       act.start_date,
  //         source:         'strava',
  //         activityName:   act.name,
  //         activityId:     String(act.id),
  //       });
  //     }
  //     setCurrentSteps(p => p + stravaSteps);
  //     toast.success(`${stravaSteps.toLocaleString()} Strava steps saved!`);
  //   } catch (err) { console.error('❌ Save Strava steps error:', err); toast.error('Failed to save Strava steps.'); }
  //   finally { setSaving(false); }
  // };

  const chatResponses = {
    // steps:    `You've taken ${totalSteps.toLocaleString()} steps today (${stravaSteps > 0 ? `${stravaSteps.toLocaleString()} from Strava + ` : ''}${sensorSteps > 0 ? `${sensorSteps.toLocaleString()} detected live` : `${currentSteps.toLocaleString()} logged`}) — ${remaining.toLocaleString()} to go.`,
    steps:    `You've taken ${totalSteps.toLocaleString()} steps today (${sensorSteps > 0 ? `${sensorSteps.toLocaleString()} detected live` : `${currentSteps.toLocaleString()} logged`}) — ${remaining.toLocaleString()} to go.`,
    walk:     `Great walking! You're at ${totalSteps.toLocaleString()} steps — ${percentage.toFixed(0)}% of your goal.`,
    // strava:   `Your Strava sync shows ${stravaActivities.length} activit${stravaActivities.length === 1 ? 'y' : 'ies'} today totalling ${stravaSteps.toLocaleString()} steps and ${(stravaActivities.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(2)} km.`,
    distance: `You've covered approximately ${distance} km today across all tracked activities.`,
    goal:     `Your daily step goal is ${goal.toLocaleString()}. You're ${percentage.toFixed(0)}% there with ${totalSteps.toLocaleString()} total steps.`,
  };
  const loadWeeklySteps = async () => {
  try {
    const user = await account.get();
    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.steps
    );

    const userDocs = res.documents.filter(
      (d: any) => d.userID === user.$id
    );

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const weekData = Array(7).fill(0);

    userDocs.forEach((doc: any) => {
      const [year, month, day] = doc.date.split('-');
      const date = new Date(Number(year), Number(month) - 1, Number(day));

      const dayIndex = (date.getDay() + 6) % 7;

      weekData[dayIndex] += doc.steps || 0;
    });

    // Replace today with live steps
    
    const todayIndex = (new Date().getDay() + 6) % 7;
    weekData[todayIndex] += sensorSteps;

    setWeeklySteps(weekData);

  } catch (err) {
    console.error('❌ Weekly load error:', err);
  }
};
useEffect(() => {
  loadWeeklySteps();
}, [sensorSteps]);
const prevStepsRef = useRef(0);
useEffect(() => {
  const hour = new Date().getHours();
  

  const indexMap = [
    [6,8], [8,10], [10,12], [12,14],
    [14,16], [16,18], [18,20], [20,22],
  ];

  const index = indexMap.findIndex(
    ([start, end]) => hour >= start && hour < end
  );

  if (index !== -1) {
    const delta = sensorSteps - prevStepsRef.current; // ✅ new steps only

    if (delta > 0) {
      setHourlySteps(prev => {
        const updated = [...prev];
        updated[index] += delta; // ✅ ADD, not replace
        return updated;
      });
    }
  }

  // ✅ update previous steps
  prevStepsRef.current = sensorSteps;

}, [sensorSteps]);


  const weeklyData = {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [{
      label: 'Steps',
      data: weeklySteps,
      backgroundColor: (ctx: any) => ctx.dataIndex === 6 ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,0.35)',
      borderRadius: 8,
    }],
  };
  const hourlyData = {
    labels: ['6am','8am','10am','12pm','2pm','4pm','6pm','8pm'],
    datasets: [{
      label: 'Steps',
      data: hourlyDurationHours,
      borderColor: 'rgba(34,197,94,1)',
      backgroundColor: 'rgba(34,197,94,0.1)',
      fill: true, tension: 0.4,
      pointBackgroundColor: 'rgba(74,222,128,1)',
      pointRadius: 4,
    }],
  };
  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(180,210,255,0.7)', font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(8,20,50,0.95)', titleColor: '#fff', bodyColor: 'rgba(180,210,255,0.85)' },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
      x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
    },
  };

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)', borderRadius: '18px',
    padding: '20px 22px', transition: 'all 0.3s ease',
  };

  const metrics = [
    { label: "Today's Steps", value: totalSteps.toLocaleString(), unit: '',    color: '#22c55e', icon: Footprints, desc: `${percentage.toFixed(0)}% of goal` },
    { label: 'Distance',      value: distance,                    unit: 'km',  color: '#3b82f6', icon: MapPin,    desc: 'Total covered' },
    // { label: 'Active Minutes',value: String(Math.round(stravaActivities.reduce((s,a)=>s+a.moving_time,0)/60)||78), unit: 'min', color: '#f59e0b', icon: Clock, desc: 'Movement time' },
    { label: 'Goal Progress', value: `${percentage.toFixed(0)}%`, unit: '',    color: goalMet ? '#22c55e' : '#fbbf24', icon: Zap, desc: goalMet ? 'Goal met!' : 'Keep going!' },
    { label: 'Remaining',     value: remaining.toLocaleString(), unit: '',    color: '#a78bfa', icon: TrendingUp, desc: 'Steps to goal' },
  ];
  const summaryStats = [
    {
      label: 'Steps',
      value: totalSteps.toLocaleString(),
      color: '#4ade80',
    },
    {
      label: 'Distance',
      value: `${distance} km`,
      color: '#38bdf8',
    },
    // {
    //   label: 'Calories burned',
    //   value: `${calories} cal`,
    //   color: '#f97316',
    // },
    
    {
        label: 'Burn Goal',
        value: `${burnGoal} cal`,
        color: '#22c55e',
      },
      {
        label: 'Calories Burned',
        value: `${calories} cal`,
        color: '#f97316',
      },

    {
      label: ' Steps Remaining',
      value: remaining === 0 ? 'Goal!' : remaining.toLocaleString(),
      color: remaining === 0 ? '#22c55e' : '#facc15',
    },
    {
  label: 'Calories Burn Remaining',
  value: remainingBurn === 0
    ? 'Goal!'
    : `${remainingBurn.toLocaleString()} cal`,
  color: remainingBurn === 0 ? '#22c55e' : '#facc15',
},
  ];

  // Strava status colour
  // const stravaStatusColor = stravaConnected ? '#fb8218' : 'rgba(180,210,255,0.35)';
  // const stravaStatusDot   = stravaConnected ? '#fb8218' : 'rgba(180,210,255,0.2)';

  return (
    <>
      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes ringPulse { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.7);opacity:0} }
        @keyframes shoeStep  { 0%,100%{transform:rotate(-5deg) translateY(0)} 25%{transform:rotate(0deg) translateY(-12px) translateX(6px)} 50%{transform:rotate(4deg) translateY(-6px) translateX(12px)} 75%{transform:rotate(0deg) translateY(-2px) translateX(6px)} }
        @keyframes medalSway { 0%,100%{transform:rotate(-4deg) translateY(0)} 50%{transform:rotate(4deg) translateY(-6px)} }
        @keyframes streakPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 70%{transform:scale(1.1) rotate(4deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes stepDot   { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.4);opacity:1} }
        @keyframes sensorPulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)} 50%{box-shadow:0 0 0 10px rgba(34,197,94,0)} }
        @keyframes stravaPulse { 0%,100%{box-shadow:0 0 0 0 rgba(252,76,2,0.5)} 50%{box-shadow:0 0 0 10px rgba(252,76,2,0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .step-card:hover  { transform:translateY(-3px) !important; box-shadow:0 12px 40px rgba(34,197,94,0.2) !important }
        .organ-card:hover { transform:translateY(-4px) scale(1.015) !important }
        .log-btn:hover    { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(34,197,94,0.45) !important }
        .strava-sync-btn:hover { transform:translateY(-1px) !important; box-shadow:0 4px 18px rgba(252,76,2,0.4) !important }
        .tab-btn { border:none; cursor:pointer; font-weight:700; font-size:12px; border-radius:10px; padding:9px 16px; transition:all .2s }
        .step-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(100,180,255,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s }
        .step-input:focus { border-color:rgba(34,197,94,0.7); background:rgba(255,255,255,0.11); box-shadow:0 0 0 3px rgba(34,197,94,0.15) }
        .step-input::placeholder { color:rgba(180,210,255,0.35) }
        .step-input option { background:#0d1a38 }
        ::-webkit-scrollbar { width:5px } ::-webkit-scrollbar-track { background:transparent } ::-webkit-scrollbar-thumb { background:rgba(34,197,94,0.25); border-radius:10px }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: 0 }}>
          <Header userName="User" />
          <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 320px', gap: '22px', minHeight: 'calc(100vh - 73px)' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── Page Header ─────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', animation: 'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', animation: 'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Footprints size={22} color="#4ade80" /></div>
                  </div>
                  <div>
                    <h1 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '22px', margin: 0, letterSpacing: '-0.3px' }}>Steps Tracker</h1>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '2px 0 0' }}>Keep moving towards your daily goal</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Strava sync button */}
                  {/* <button
                    className="strava-sync-btn"
                    onClick={stravaSync}
                    disabled={stravaLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'linear-gradient(135deg,#fc4c02,#e8440a)', border: 'none', borderRadius: '12px', padding: '11px 18px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: stravaLoading ? 'wait' : 'pointer', boxShadow: '0 4px 16px rgba(252,76,2,0.3)', transition: 'all .2s ease' }}
                  >
                    {stravaLoading
                      ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                      : <RefreshCw size={14} />}
                    Sync Strava
                  </button> */}
                  <button className="log-btn" onClick={() => setShowLogModal(true)} style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '12px', padding: '11px 20px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 18px rgba(34,197,94,0.35)', transition: 'all .2s ease' }}>
                    Log Steps
                  </button>
                </div>
              </div>

              {/* ── Strava Connection Banner ─────────────────────── */}
              {/* {stravaConnected && (
                <div style={{ padding: '12px 16px', background: 'rgba(252,76,2,0.08)', border: '1px solid rgba(252,76,2,0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', animation: mounted ? 'fadeUp 0.4s ease' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fb8218', boxShadow: '0 0 6px #fb8218', flexShrink: 0 }} />
                    <span style={{ color: '#fb8218', fontWeight: 700, fontSize: '12px' }}>Strava Connected</span>
                    <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px' }}>
                      {stravaActivities.length} activit{stravaActivities.length === 1 ? 'y' : 'ies'} today · {stravaSteps.toLocaleString()} steps synced
                    </span>
                  </div>
                  {lastSynced && (
                    <span style={{ color: 'rgba(180,210,255,0.35)', fontSize: '10px' }}>
                      Last sync: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {stravaError && !stravaConnected && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '14px' }}>
                  <p style={{ color: '#f87171', fontSize: '12px', margin: 0 }}>⚠️ Strava: {stravaError}</p>
                </div>
              )} */}

              {/* ── Hero Cards ───────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>
                {/* Steps card — now shows totalSteps */}
                <div style={{ ...card, border: '1px solid rgba(34,197,94,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  {[{ left: '10%', d: 0 },{ left: '30%', d: 0.3 },{ left: '50%', d: 0.6 },{ left: '70%', d: 0.9 }].map((p, i) => (
                    <div key={i} style={{ position: 'absolute', bottom: '18px', left: p.left, width: 7, height: 7, borderRadius: '50%', background: 'rgba(74,222,128,0.5)', animation: 'stepDot 1.5s ease-in-out infinite', animationDelay: `${p.d}s`, pointerEvents: 'none' }} />
                  ))}
                  <img src={stepsImg} alt="Steps" style={{ width: 160, height: 160, objectFit: 'contain', animation: 'shoeStep 2s ease-in-out infinite', filter: 'drop-shadow(0 10px 28px rgba(34,197,94,0.5))' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>Today's Steps</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: goalMet ? '#22c55e' : '#4ade80', boxShadow: `0 0 5px ${goalMet ? '#22c55e' : '#4ade80'}` }} />
                      <span style={{ color: goalMet ? '#22c55e' : '#4ade80', fontSize: '12px', fontWeight: 600 }}>{totalSteps.toLocaleString()} steps</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>{percentage.toFixed(0)}% of {goal.toLocaleString()}</p>
                    {/* Source breakdown */}
                    {/* {(stravaSteps > 0 || sensorSteps > 0) && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                        {stravaSteps > 0 && <span style={{ fontSize: '10px', color: '#fb8218', background: 'rgba(252,76,2,0.12)', border: '1px solid rgba(252,76,2,0.2)', borderRadius: '20px', padding: '2px 8px' }}>🔶 {stravaSteps.toLocaleString()} Strava</span>}
                        {sensorSteps > 0 && <span style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '2px 8px' }}>📱 {sensorSteps.toLocaleString()} Live</span>}
                      </div>
                    )} */}
                  </div>
                </div>
                {/* Streak card */}
                <div style={{ ...card, border: '1px solid rgba(251,191,36,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '28px 20px', position: 'relative', overflow: 'hidden' }} className="organ-card">
                  <div style={{ position: 'relative' }}>
                    <img src={goalMet ? medalImg : streakImg} alt={goalMet ? 'Medal' : 'Streak'} style={{ width: 140, height: 140, objectFit: 'contain', animation: goalMet ? 'medalSway 3.5s ease-in-out infinite' : (mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.3s both' : 'none'), filter: `drop-shadow(0 0 28px rgba(251,191,36,${goalMet ? 0.6 : 0.4}))` }} />
                    <div style={{ position: 'absolute', bottom: 8, right: 0, width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: '3px solid rgba(8,20,50,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.6s ease 0.6s both' : 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 5px' }}>{goalMet ? 'Goal Achieved!' : 'Activity Streak'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 5px #fbbf24' }} />
                      <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600 }}>{streak} days in a row</span>
                    </div>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: '4px 0 0' }}>
                      {goalMet ? 'Daily goal complete' : `${remaining.toLocaleString()} steps remaining`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ══ STEP COUNTER TABS ═══════════════════════════════ */}
              <div style={{ ...card, border: '1px solid rgba(100,180,255,0.15)', animation: mounted ? 'fadeUp 0.5s ease 0.15s both' : 'none' }}>
                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
                  <button
                    className="tab-btn"
                    onClick={() => setActiveTab('sensor')}
                    style={{ flex: 1, background: activeTab === 'sensor' ? 'rgba(34,197,94,0.2)' : 'transparent', color: activeTab === 'sensor' ? '#4ade80' : 'rgba(180,210,255,0.5)', border: activeTab === 'sensor' ? '1px solid rgba(34,197,94,0.35)' : '1px solid transparent' }}
                  >
                    📱 Smart Sensor
                  </button>
                  {/* <button
                    className="tab-btn"
                    onClick={() => setActiveTab('strava')}
                    style={{ flex: 1, background: activeTab === 'strava' ? 'rgba(252,76,2,0.2)' : 'transparent', color: activeTab === 'strava' ? '#fb8218' : 'rgba(180,210,255,0.5)', border: activeTab === 'strava' ? '1px solid rgba(252,76,2,0.35)' : '1px solid transparent' }}
                  >
                    🔶 Strava Sync
                  </button> */}
                </div>

                {/* ── SENSOR TAB ── */}
                {activeTab === 'sensor' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          {isTracking && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'sensorPulse 1.5s ease-in-out infinite' }} />}
                          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }}>{isTracking ? 'Live Tracking' : 'Auto Detect'}</p>
                        </div>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>📱 Smart Step Counter</p>
                      </div>
                      {sensorSteps > 0 && !isTracking && (
                        <button onClick={() => setShowSaveModal(true)} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}>
                          💾 Save to Log
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '20px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                        <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600 }}>Accelerometer</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: gyroAvailable ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${gyroAvailable ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: gyroAvailable ? '#60a5fa' : 'rgba(180,210,255,0.3)' }} />
                        <span style={{ color: gyroAvailable ? '#93c5fd' : 'rgba(180,210,255,0.4)', fontSize: '11px', fontWeight: 600 }}>{gyroAvailable ? 'Gyroscope ✓' : 'No Gyroscope'}</span>
                      </div>
                      {gyroAvailable && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '20px' }}>
                          <span style={{ color: '#c4b5fd', fontSize: '11px', fontWeight: 600 }}>🔒 Shake-proof fusion ON</span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: '20px', padding: '20px', background: 'rgba(34,197,94,0.05)', borderRadius: '14px', border: '1px solid rgba(34,197,94,0.1)' }}>
                      <p style={{ color: '#4ade80', fontWeight: 900, fontSize: isMobile ? '52px' : '64px', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{sensorSteps.toLocaleString()}</p>
                      <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '6px 0 0', fontWeight: 600 }}>steps detected this session</p>
                      {sensorSteps > 0 && <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '4px 0 0' }}>≈ {(sensorSteps * 0.0007).toFixed(2)} km · ~{Math.round(sensorSteps * 0.04)} cal</p>}
                    </div>
                    {sensorSteps > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600 }}>Session progress</span>
                          <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700 }}>{sensorPct.toFixed(0)}% of daily goal</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${sensorPct}%`, background: 'linear-gradient(90deg,#22c55e,#4ade80)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )}
                    {sensorError && (
                      <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', marginBottom: '14px' }}>
                        <p style={{ color: '#f87171', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>⚠️ {sensorError}</p>
                      </div>
                    )}
                    {!sensorSupported && (
                      <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', marginBottom: '14px' }}>
                        <p style={{ color: '#fbbf24', fontSize: '12px', margin: 0 }}>⚠️ Motion sensors not available. Use the manual Log Steps button or sync with Strava instead.</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {!isTracking ? (
                        <button onClick={startTracking} disabled={!sensorSupported} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', cursor: sensorSupported ? 'pointer' : 'not-allowed', background: sensorSupported ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)', color: sensorSupported ? '#fff' : 'rgba(180,210,255,0.3)', fontWeight: 700, fontSize: '14px', boxShadow: sensorSupported ? '0 4px 18px rgba(34,197,94,0.4)' : 'none', transition: 'all 0.2s' }}>
                          🚶 Start Tracking
                        </button>
                      ) : (
                        <button onClick={stopTracking} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s' }}>
                          ⏹ Stop Tracking
                        </button>
                      )}
                      <button onClick={resetSteps} style={{ padding: '13px 16px', borderRadius: '12px', border: '1px solid rgba(100,180,255,0.15)', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: 'rgba(180,210,255,0.6)', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }}>↺ Reset</button>
                    </div>
                    <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '10px' }}>
                      <p style={{ color: 'rgba(147,197,253,0.8)', fontSize: '11px', margin: 0, lineHeight: '1.6' }}>
                        {isTracking ? '🟢 Tracking active — walk naturally. Shaking your phone will NOT count as steps.' : '📱 iOS: tap Start and allow Motion & Orientation access when prompted. Works on iPhone 6s and later.'}
                      </p>
                    </div>
                  </>
                )}

                {/* ── STRAVA TAB ── */}
                {activeTab === 'strava' && (
                  <>
                    {/* Header */}
                    {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          {stravaLoading && <span style={{ width: 8, height: 8, border: '2px solid rgba(252,76,2,0.3)', borderTopColor: '#fb8218', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
                          {!stravaLoading && stravaConnected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fb8218', animation: 'stravaPulse 1.5s ease-in-out infinite' }} />}
                          <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }}>
                            {stravaLoading ? 'Syncing…' : stravaConnected ? 'Connected' : 'Disconnected'}
                          </p>
                        </div>
                        <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>🔶 Strava Activity Sync</p>
                      </div>
                      {stravaSteps > 0 && (
                        <button onClick={handleSaveStravaSteps} disabled={saving} style={{ padding: '8px 16px', background: saving ? 'rgba(252,76,2,0.4)' : 'linear-gradient(135deg,#fc4c02,#e8440a)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(252,76,2,0.35)' }}>
                          💾 Save to Log
                        </button>
                      )}
                    </div> */}

                    {/* Info banner */}
                    {/* <div style={{ padding: '12px 14px', background: 'rgba(252,76,2,0.06)', border: '1px solid rgba(252,76,2,0.15)', borderRadius: '12px', marginBottom: '16px' }}>
                      <p style={{ color: 'rgba(251,130,24,0.9)', fontSize: '11px', margin: 0, lineHeight: '1.7' }}>
                        <strong style={{ color: '#fb8218' }}>How it works:</strong> Steps are calculated from Strava activity distance using sport-specific stride lengths (Walk: 0.75 m, Run: 0.95 m, Hike: 0.70 m). Only today's activities are shown.
                      </p>
                    </div> */}

                    {/* Big Strava step count */}
                    {/* <div style={{ textAlign: 'center', marginBottom: '20px', padding: '20px', background: 'rgba(252,76,2,0.05)', borderRadius: '14px', border: '1px solid rgba(252,76,2,0.1)' }}>
                      {stravaLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 0' }}>
                          <span style={{ width: 20, height: 20, border: '3px solid rgba(252,76,2,0.3)', borderTopColor: '#fb8218', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                          <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '14px' }}>Fetching activities…</span>
                        </div>
                      ) : (
                        <>
                          <p style={{ color: '#fb8218', fontWeight: 900, fontSize: isMobile ? '52px' : '64px', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{stravaSteps.toLocaleString()}</p>
                          <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '6px 0 0', fontWeight: 600 }}>steps from Strava today</p>
                          {stravaSteps > 0 && <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '4px 0 0' }}>≈ {(stravaActivities.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(2)} km · ~{Math.round(stravaSteps * 0.04)} cal</p>}
                        </>
                      )}
                    </div> */}

                    {/* Strava progress bar */}
                    {/* {stravaSteps > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600 }}>Strava contribution</span>
                          <span style={{ color: '#fb8218', fontSize: '11px', fontWeight: 700 }}>{stravaPct.toFixed(0)}% of daily goal</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${stravaPct}%`, background: 'linear-gradient(90deg,#fc4c02,#fb8218)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )} */}

                    {/* Activity list */}
                    {/* {stravaActivities.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Today's Activities</p>
                        {stravaActivities.map(a => <StravaActivityCard key={a.id} activity={a} />)}
                      </div>
                    ) : !stravaLoading && (
                      <div style={{ textAlign: 'center', padding: '28px 0' }}>
                        <p style={{ fontSize: '28px', marginBottom: '8px' }}>🏃</p>
                        <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '13px', margin: 0 }}>
                          {stravaConnected ? 'No Strava activities recorded today yet.' : 'Connect your Strava account to sync activities.'}
                        </p>
                      </div>
                    )} */}

                    {/* {stravaError && (
                      <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', marginTop: '14px' }}>
                        <p style={{ color: '#f87171', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>⚠️ {stravaError}</p>
                      </div>
                    )} */}

                    {/* Manual sync */}
                    {/* <button onClick={stravaSync} disabled={stravaLoading} style={{ width: '100%', marginTop: '16px', padding: '13px', borderRadius: '12px', border: '1px solid rgba(252,76,2,0.3)', cursor: stravaLoading ? 'wait' : 'pointer', background: 'rgba(252,76,2,0.08)', color: '#fb8218', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      {stravaLoading ? <span style={{ width: 14, height: 14, border: '2px solid rgba(252,76,2,0.3)', borderTopColor: '#fb8218', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> : <RefreshCw size={14} />}
                      {stravaLoading ? 'Syncing…' : '↺ Refresh Strava'}
                    </button> */}
                  </>
                )}
              </div>

              {/* ── Metric Cards ─────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '14px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                {metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} style={{ ...card, border: `1px solid ${m.color}22`, cursor: 'default' }} className="step-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '9px', background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={16} color={m.color} />
                        </div>
                        <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{m.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '26px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{m.value}</span>
                        {m.unit && <span style={{ fontSize: '13px', color: m.color, fontWeight: 600 }}>{m.unit}</span>}
                      </div>
                      <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: 0 }}>{m.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* ── Progress Banner ──────────────────────────────── */}
              <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(16,163,74,0.15))', backdropFilter: 'blur(20px)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '18px', padding: '22px 24px', animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Daily Progress</p>
                    <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>{totalSteps.toLocaleString()} <span style={{ color: 'rgba(180,210,255,0.4)', fontWeight: 400 }}>/ {goal.toLocaleString()} steps</span></p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '22px' }}>{percentage.toFixed(0)}%</span>
                    <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '11px', margin: 0 }}>{remaining.toLocaleString()} remaining</p>
                  </div>
                </div>
                {/* Stacked progress bar: DB saved + Strava + sensor */}
                <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex' }}>
                  {currentSteps > 0 && <div title="Saved" style={{ height: '100%', width: `${Math.min((currentSteps / goal) * 100, 100)}%`, background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)', transition: 'width 1.5s cubic-bezier(.4,0,.2,1)' }} />}
                  {/* {stravaSteps  > 0 && <div title="Strava" style={{ height: '100%', width: `${Math.min((stravaSteps  / goal) * 100, 100 - Math.min((currentSteps / goal) * 100, 100))}%`, background: '#fc4c02', transition: 'width 1.5s cubic-bezier(.4,0,.2,1)' }} />} */}
                  {sensorSteps  > 0 && <div title="Live"   style={{ height: '100%', width: `${Math.min((sensorSteps  / goal) * 100, 100 - Math.min((currentSteps / goal) * 100, 100))}%`, background: '#4ade80', transition: 'width 1.5s cubic-bezier(.4,0,.2,1)' }} />}
                </div>
                {(sensorSteps > 0) && (
                  <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {currentSteps > 0 && <span style={{ fontSize: '10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} />Saved ({currentSteps.toLocaleString()})</span>}
                    {/* {stravaSteps  > 0 && <span style={{ fontSize: '10px', color: '#fb8218', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '2px', background: '#fc4c02', display: 'inline-block' }} />Strava ({stravaSteps.toLocaleString()})</span>} */}
                    {sensorSteps  > 0 && <span style={{ fontSize: '10px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '2px', background: '#4ade80', display: 'inline-block' }} />Live ({sensorSteps.toLocaleString()})</span>}
                  </div>
                )}
              </div>

              {/* ── Activity Summary ─────────────────────────────── */}
              <div style={{ ...card, animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Summary</p>
                <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>Activity Overview</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '12px' }}>
                  {summaryStats.map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(100,180,255,0.08)', transition: 'all .2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(34,197,94,0.07)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}>
                      <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>{s.label}</p>
                      <p style={{ color: s.color, fontWeight: 800, fontSize: '18px', margin: 0 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Charts ───────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none' }}>
                <div style={card}>
                  <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Weekly</p>
                  <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>7-Day Steps</p>
                  <div style={{ height: '200px' }}><Bar options={chartOpts} data={weeklyData} /></div>
                </div>
                <div style={card}>
                  <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>Distribution</p>
                  <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: '0 0 16px' }}>Hourly Steps</p>
                  <div style={{ height: '200px' }}><Line options={chartOpts} data={hourlyData} /></div>
                </div>
              </div>
            </div>

            {/* ── Chat Column ─────────────────────────────────────── */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Steps AI"
                moduleKey="steps"
                responses={chatResponses}
                // defaultResponse={`You've taken ${totalSteps.toLocaleString()} steps today${stravaConnected ? ` (includes ${stravaSteps.toLocaleString()} from Strava)` : ''}. Keep moving!`}
                // defaultResponse={`You've taken ${totalSteps.toLocaleString()} steps today — ${percentage.toFixed(0)}% of your ${goal.toLocaleString()} step goal.${sensorSteps > 0 ? ` Strava contributed ${sensorSteps.toLocaleString()} steps.` : ''} What would you like to know?`}
                // autoMessages={[{
                //   text: `You've taken ${totalSteps} steps today — ${percentage.toFixed(0)}% of your ${goal.toLocaleString()} step goal.${sensorSteps > 0 ? ` Strava contributed ${sensorSteps.toLocaleString()} steps.` : ''} What would you like to know?`,
                //   delay: 1500,
                // }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Manual Log Modal ──────────────────────────────────────── */}
      {showLogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }} onClick={() => setShowLogModal(false)}>
          <div style={{ background: '#0d1a38', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '22px', padding: '36px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'fadeUp .3s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(34,197,94,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Footprints size={20} color="#4ade80" /></div>
              <div><h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '18px', margin: 0 }}>Log Steps</h4><p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>Record your activity</p></div>
            </div>
            <form onSubmit={handleLogSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Step Count</label>
                <input type="number" className="step-input" placeholder="e.g. 2000" value={logData.steps} onChange={e => setLogData({ ...logData, steps: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[500,1000,2000,3000,5000].map(n => (
                  <button key={n} type="button" onClick={() => setLogData({ ...logData, steps: String(n) })} style={{ padding: '7px 12px', background: logData.steps === String(n) ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)', border: logData.steps === String(n) ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(100,180,255,0.15)', borderRadius: '8px', color: logData.steps === String(n) ? '#4ade80' : 'rgba(180,210,255,0.5)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>+{n.toLocaleString()}</button>
                ))}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Activity Type</label>
                <select className="step-input" value={logData.activity} onChange={e => setLogData({ ...logData, activity: e.target.value })} style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.25)', borderRadius: '10px', color: '#e0f0ff', fontSize: '14px', outline: 'none' }}>
                  {['Walking','Running','Jogging','Hiking','Other'].map(a => <option key={a} value={a.toLowerCase()} style={{ background: '#0d1a38' }}>{a}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Duration (minutes)</label>
                <input type="number" className="step-input" placeholder="e.g. 30" value={logData.duration} onChange={e => setLogData({ ...logData, duration: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: 'rgba(180,210,255,0.8)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Notes (optional)</label>
                <input type="text" className="step-input" placeholder="e.g. Morning walk in the park" value={logData.notes} onChange={e => setLogData({ ...logData, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 18px rgba(34,197,94,0.35)', transition: 'all .2s' }}>{saving ? 'Saving...' : 'Save Steps'}</button>
                <button type="button" onClick={() => setShowLogModal(false)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'all .2s' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Save Sensor Steps Modal ───────────────────────────────── */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }} onClick={() => setShowSaveModal(false)}>
          <div style={{ background: '#0d1a38', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '22px', padding: '36px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', animation: 'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚶</div>
              <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '20px', margin: '0 0 6px' }}>Save Sensor Steps</h4>
              <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: 0 }}>Add your auto-detected steps to today's log</p>
            </div>
            <div style={{ padding: '20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#4ade80', fontWeight: 900, fontSize: '48px', margin: '0 0 4px', lineHeight: 1 }}>{sensorSteps.toLocaleString()}</p>
              <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: 0 }}>steps · ≈{(sensorSteps * 0.0007).toFixed(2)} km · ~{Math.round(sensorSteps * 0.04)} cal</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSaveSensorSteps} disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 18px rgba(34,197,94,0.35)' }}>{saving ? 'Saving...' : '💾 Save to Log'}</button>
              <button onClick={() => setShowSaveModal(false)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: 'rgba(180,210,255,0.8)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}