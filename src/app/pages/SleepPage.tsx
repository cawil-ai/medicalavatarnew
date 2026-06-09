import { useState, useEffect, memo } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { ChatPanel } from '../components/ChatPanel';
import { useResponsive } from '../hooks/useResponsive';
import { Clock, TrendingUp, Star, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { databases, DATABASE_ID, COLLECTIONS, ID, account, Query, Permission, Role} from '../../lib/appwrite';


const bedImg    = '/assets/bed.png';
const moonImg   = '/assets/moon.png';
const streakImg = '/assets/streak.png';

const MemoSidebar = memo(Sidebar);

export function SleepPage() {
  const [showLogModal, setShowLogModal] = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [avgHours, setAvgHours]         = useState(0);
  const [avgQuality, setAvgQuality]     = useState(0);
  const { isMobile, isTablet } = useResponsive();
  const [logData, setLogData] = useState({
    hours: '', bedtime: '', waketime: '', quality: '5',
  });
  const [avgBedtime, setAvgBedtime] = useState('');
  const [sleepStreak, setSleepStreak] = useState(0);
  const [streakLabel, setStreakLabel] = useState('No streak yet');
  const [bedtimeConsistency, setBedtimeConsistency] = useState('No data');
  const [avgWakeTime, setAvgWakeTime] = useState('');
  const [bedtimeChartData, setBedtimeChartData] = useState<(number | null)[]>([
  null, null, null, null, null, null, null
]);
const [sleepDurationChartData, setSleepDurationChartData] = useState<(number | null)[]>([
  null, null, null, null, null, null, null
]);




  useEffect(() => {
    setMounted(true);
    loadSleepData();
  }, []);

  // const loadSleepData = async () => {
  //   try {
  //     const user = await account.get();
  //     const res  = await databases.listDocuments(DATABASE_ID, COLLECTIONS.sleep);
  //     const mine = res.documents.filter(d => d.userID === user.$id);
  //     if (mine.length > 0) {
  //       const total = mine.reduce((s, d) => s + (d.hoursSlept || 0), 0);
  //       setAvgHours(parseFloat((total / mine.length).toFixed(1)));
  //     }
  //   } catch (err) {
  //     console.error('❌ Load sleep error:', err);
  //   }
  // };

  // const handleLogSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setSaving(true);
  //   try {
  //     const user  = await account.get();
  //     const today = new Date().toISOString().split('T')[0];

  //     const doc = await databases.createDocument(
  //       DATABASE_ID,
  //       COLLECTIONS.sleep,
  //       ID.unique(),
  //       {
  //         userID:       user.$id,
  //         hoursSlept:   parseFloat(logData.hours),
  //         bedTime:      logData.bedtime,
  //         wakeTime:     logData.waketime,
  //         quality:      logData.quality,
  //         date:         today,
  //         loggedAt:     new Date().toISOString(),
  //       }
  //     );
  //     console.log('✅ Sleep saved:', doc);
  //     toast.success('Sleep data logged successfully!');
  //     setShowLogModal(false);
  //     setLogData({ hours: '', bedtime: '', waketime: '', quality: '5' });
  //     await loadSleepData();
  //   } catch (err) {
  //     console.error('❌ Save sleep error:', err);
  //     toast.error('Failed to save sleep log. Check console.');
  //   } finally {
  //     setSaving(false);
  //   }
  // };
const timeToMinutes = (time: string) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesTo12Hour = (mins: number) => {
  const normalized = ((mins % 1440) + 1440) % 1440; // keeps it within 0–1439
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};
const bedtimeToMinutesForAverage = (time: string) => {
  if (!time) return 0;

  const [hours, minutes] = time.split(':').map(Number);
  let total = hours * 60 + minutes;

  // Treat after-midnight bedtimes as part of the same late-night window
  if (hours < 12) {
    total += 1440;
  }

  return total;
};
const calculateSleepStreak = (docs: any[]) => {
  if (!docs.length) return 0;

  // Only count nights with 7+ hours and valid dates
  const qualifyingDocs = docs
    .filter(doc => doc.date && Number(doc.hoursSlept) >= 7)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!qualifyingDocs.length) return 0;

  // Remove duplicate dates
  const uniqueDates = [...new Set(qualifyingDocs.map(doc => doc.date))];

  let streak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);

    const diffInDays =
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);

    if (diffInDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sun=0, Mon=1, ..., Sat=6
  const diff = day === 0 ? -6 : 1 - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfWeek = (startOfWeek: Date) => {
  const end = new Date(startOfWeek);
  end.setDate(startOfWeek.getDate() + 6); // Sunday
  end.setHours(23, 59, 59, 999);
  return end;
};



const loadSleepData = async () => {
  try {
    const user = await account.get();

    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.sleep,
      [Query.equal('userID', user.$id)]
    );

    console.log('hourly sleep data:', res.documents);
    console.log('Current logged in Appwrite user:', user.$id);

    const docs = res.documents;

    if (docs.length === 0) {
      setAvgHours(0);
      setAvgQuality(0);
      setAvgBedtime('');
      setSleepStreak(0);
      setBedtimeConsistency('No data');
      return;
    }

    // ✅ Average hours slept
    const totalHours = docs.reduce(
      (sum, d) => sum + Number(d.hoursSlept || 0),
      0
    );
    const avgHrs = Number((totalHours / docs.length).toFixed(1));
    setAvgHours(avgHrs);

    // ✅ Average quality
    const totalQuality = docs.reduce(
      (sum, d) => sum + Number(d.quality || 0),
      0
    );
    const avgQual = Number((totalQuality / docs.length).toFixed(1));
    setAvgQuality(avgQual);

    // ✅ Average bedtime
    const bedtimeDocs = docs.filter(d => d.bedTime);

    if (bedtimeDocs.length > 0) {
      const totalBedMinutes = bedtimeDocs.reduce(
        (sum, d) => sum + bedtimeToMinutesForAverage(d.bedTime),
        0
      );

      const avgBedMinutes = Math.round(totalBedMinutes / bedtimeDocs.length);
      setAvgBedtime(minutesTo12Hour(avgBedMinutes));
      // Average wake time
      const wakeDocs = docs.filter(d => d.wakeTime);

      if (wakeDocs.length > 0) {
        const totalWakeMinutes = wakeDocs.reduce(
          (sum, d) => sum + timeToMinutes(d.wakeTime),
          0
        );

        const avgWakeMinutes = Math.round(totalWakeMinutes / wakeDocs.length);
        setAvgWakeTime(minutesTo12Hour(avgWakeMinutes));
      } else {
        setAvgWakeTime('');
      }

      // ✅ ✅ NEW: Calculate bedtime consistency (description)
      if (bedtimeDocs.length > 1) {
        const minutesList = bedtimeDocs.map(d =>
          bedtimeToMinutesForAverage(d.bedTime)
        );

        const avg =
          minutesList.reduce((a, b) => a + b, 0) / minutesList.length;

        const variance =
          minutesList.reduce((sum, m) => sum + Math.abs(m - avg), 0) /
          minutesList.length;

        if (variance <= 20) {
          setBedtimeConsistency('Very consistent');
        } else if (variance <= 45) {
          setBedtimeConsistency('Consistent');
        } else if (variance <= 90) {
          setBedtimeConsistency('Slightly irregular');
        } else {
          setBedtimeConsistency('Irregular schedule');
        }
      } else {
        setBedtimeConsistency('Not enough data');
      }
      const weeklyBedtimeData = buildWeeklyBedtimeDataset(docs);
      setBedtimeChartData(weeklyBedtimeData);
      const durationData = buildWeeklySleepDuration(docs);
      setSleepDurationChartData(durationData);

    } else {
      setAvgBedtime('');
      setBedtimeConsistency('No data');
    }

    // ✅ Sleep streak (MOVED OUTSIDE)
    const streak = calculateSleepStreak(docs);
    setSleepStreak(streak);

  } catch (err) {
    console.error('❌ Load sleep error:', err);
    setAvgHours(0);
    setAvgQuality(0);
    setAvgBedtime('');
    setSleepStreak(0);
    setBedtimeConsistency('No data');
    setBedtimeChartData([null, null, null, null, null, null, null]);
  }
};

const getLastNightLocalDate = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const handleLogSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);

  try {
    const user = await account.get();
    // const now = new Date();
    // now.setDate(now.getDate() - 1);

    // const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = getLastNightLocalDate();


    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.sleep,
      ID.unique(),
      {
        userID: user.$id,
        hoursSlept: Number(logData.hours),
        bedTime: logData.bedtime,
        wakeTime: logData.waketime,
        quality: logData.quality,
        date: today,
        loggedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ]
    );

    toast.success('Sleep data logged successfully!');
    setShowLogModal(false);
    setLogData({ hours: '', bedtime: '', waketime: '', quality: '5' });

    await loadSleepData();
  } catch (err) {
    console.error('❌ Save sleep error:', err);
    toast.error('Failed to save sleep log. Check console.');
  } finally {
    setSaving(false);
  }
};
const qualityPercent = avgQuality ? Math.round(avgQuality * 10) : 0;


  const chatResponses: Record<string, string> = {
    // ── Duration / Hours ──────────────────────────────────────────────────────
    sleep:        `Your nightly average is ${avgHours || 7.2} hours. Adults need 7–9 hours for optimal health. You're ${(avgHours || 7.2) >= 7 ? 'hitting the healthy range — great job!' : 'slightly below the recommended minimum. Try getting to bed 30 minutes earlier tonight.'}`,
    hours:        `You're averaging ${avgHours || 7.2} hrs per night. The sweet spot for most adults is 7–9 hours. Consistently sleeping less than 7 hrs increases fatigue, mood issues, and long-term health risks.`,
    duration:     `Your average sleep duration this week is ${avgHours || 7.2} hours. Aim for at least 7 hrs on weeknights and avoid "sleeping in" more than 1 extra hour on weekends to protect your circadian rhythm.`,
    average:      `Your weekly average is ${avgHours || 7.2} hrs/night. A healthy adult average is 7.5–8 hrs. You're ${(avgHours || 7.2) >= 7.5 ? 'right on target!' : 'close — small adjustments to your bedtime routine can get you there.'}`,
    tonight:      `Tonight's target is 8 hours. If you go to bed at 10:30 PM, aim to wake at 6:30 AM. Avoid screens 30 mins before bed and keep your room cool (65–68°F / 18–20°C) for the best rest.`,
    time:         `Your average bedtime is 10:45 PM with a wake time around 6:30 AM — that's a solid 7.75 hrs window. Consistency matters more than perfection; try to keep your schedule within ±30 minutes daily.`,

    // ── Quality ───────────────────────────────────────────────────────────────
    quality:      'Your sleep quality score is 78/100 — above average. Quality is influenced by sleep continuity, time in deep sleep, and how rested you feel on waking. Keep your bedtime consistent to push that score above 80.',
    score:        'Your current quality score is 78/100. Scores above 85 indicate excellent sleep. To improve: reduce alcohol before bed, keep a cool dark room, and finish exercise at least 3 hrs before sleep.',
    rating:       'You rated last night 7/10 for restfulness. Tracking your subjective rating alongside objective data helps spot patterns — like lower scores after late dinners or high-stress days.',
    good:         'Your sleep has been good this week! Quality score is 78/100 and you hit 7+ hours on 5 of 7 nights. Keep your wind-down routine consistent to maintain this.',
    bad:          'Sorry to hear you had a rough night. Common culprits: stress, late caffeine, blue light exposure, or an inconsistent schedule. Try a 10-minute wind-down routine tonight — dim lights, no phone, slow breathing.',
    poor:         'Poor sleep can snowball quickly. Prioritize tonight: no caffeine after 2 PM, dim your lights an hour before bed, and keep your room between 65–68°F. Even one solid night helps reset your body clock.',

    // ── Sleep Stages ──────────────────────────────────────────────────────────
    deep:         'You spent 1.8 hours in deep sleep last night — sitting comfortably within the healthy 20–25% range. Deep sleep (slow-wave) is critical for physical recovery, immune function, and memory consolidation.',
    light:        'Light sleep made up about 45% of your night. This stage bridges deep sleep and REM cycles. It\'s normal and necessary, though too much light sleep at the expense of deep sleep can leave you feeling unrested.',
    rem:          'Your REM sleep was 19% last night (~1.4 hrs), which supports memory consolidation, emotional processing, and creativity. Healthy adults aim for 20–25% REM. Alcohol and late-night eating are the most common REM disruptors.',
    stage:        'Your sleep stages last night: Deep 25% · Light 45% · REM 19% · Awake 5%. This is a healthy distribution. Deep and REM sleep are the most restorative — protect them by keeping a consistent schedule.',
    stages:       'Sleep cycles through Light → Deep → REM roughly every 90 minutes. You complete 4–5 cycles per night. Your breakdown last night (Deep 25%, Light 45%, REM 19%) is well within normal ranges.',
    cycle:        'A full sleep cycle lasts ~90 minutes. You likely completed 4–5 cycles last night. Waking up at the end of a cycle (rather than mid-cycle) reduces grogginess — apps like sleep calculators can help you time your alarm.',
    cycles:       'You completed approximately 5 sleep cycles last night based on your 7.5 hrs. Each cycle ends with a brief REM phase that gets longer as the night goes on — which is why cutting sleep short hits REM the hardest.',

    // ── Bedtime & Wake Time ───────────────────────────────────────────────────
    bedtime:      'Your average bedtime is 10:45 PM. Consistency is the #1 predictor of sleep quality — your body\'s melatonin release is calibrated to your regular sleep window. Aim to be in bed within ±30 minutes of this time every night.',
    schedule:     'Your sleep schedule this week: bedtime ~10:45 PM, wake ~6:30 AM. You had a slight variance on Friday (11:30 PM) and Saturday (midnight). Try to cap weekend drift at 1 hour to avoid "social jet lag" on Monday.',
    wake:         'Your average wake time is 6:30 AM. Waking at the same time every day — even on weekends — is the single most powerful way to anchor your circadian rhythm and improve long-term sleep quality.',
    wakeup:       'Your wake-up time is consistent at around 6:30 AM on weekdays. A steady wake time trains your internal clock and reduces morning grogginess. Even if you go to bed late, try to keep this anchor time.',
    morning:      'Good morning! Your logged wake time was 6:30 AM. Morning sunlight exposure within 30 minutes of waking helps set your circadian clock — even a few minutes outside makes a difference.',
    night:        "Tonight's sleep window target bed by 10:30 PM and wake at 6:30 AM for a full 8-hour rest. Wind down with dim lights and avoid screens starting at 9:30 PM for the best sleep onset.",

    // ── Streak & Consistency ──────────────────────────────────────────────────
    streak:       'You\'re on a 6-night sleep streak of 7+ hours — fantastic! Streaks build momentum and reflect improved sleep hygiene. One poor night won\'t erase your progress, so keep going.',
    consistency:  'Your bedtime consistency score is strong — you\'ve logged sleep within a 45-minute window for 5 of 7 nights. Consistency matters more than any single night\'s duration for long-term energy and health.',
    habit:        'Good sleep habits pay dividends: your current streak and consistent bedtime window are the two biggest factors driving your 78/100 quality score. Keep your pre-sleep routine predictable.',
    routine:      'A consistent wind-down routine signals your brain that sleep is coming. Try: dim lights at 9 PM, no screens at 9:30 PM, light reading or stretching, and bed at 10:30 PM. Repeating this daily builds a strong sleep trigger.',
    improve:      'To improve your sleep: (1) Keep your wake time fixed 7 days a week. (2) Cut caffeine by 2 PM. (3) Make your room dark and cool. (4) Avoid alcohol within 3 hrs of bed. Even one change can bump your quality score noticeably.',
    goal:         `Your sleep goal is 8 hrs/night. You're currently averaging ${avgHours || 7.2} hrs — ${Math.abs(8 - (avgHours || 7.2)).toFixed(1)} hrs ${(avgHours || 7.2) >= 8 ? 'above' : 'below'} target. Small adjustments to your bedtime can close that gap within a week.`,

    // ── Tips & Advice ─────────────────────────────────────────────────────────
    tips:         'Top sleep tips for you: ① Go to bed and wake at the same time daily. ② Keep your room cool (65–68°F). ③ No caffeine after 2 PM. ④ Dim lights 1 hr before bed. ⑤ Avoid alcohol within 3 hrs of sleep — it disrupts REM heavily.',
    advice:       'Based on your data: your consistency is good but bedtime drifts on weekends. Protect your Friday/Saturday schedule — even one late night can push your Monday fatigue noticeably. Also consider a 5-min breathing exercise before bed.',
    help:         'I can help you with: sleep duration & averages, quality scores, deep sleep and REM data, bedtime consistency, sleep streaks, tips to sleep better, and what your weekly trends mean. Just ask!',
    insomnia:     'If you\'re struggling to fall asleep: try stimulus control (bed is only for sleep), keep a consistent wake time even after a bad night, avoid lying awake in bed for more than 20 minutes, and limit daytime naps to 20 min before 3 PM.',
    nap:          'Naps can help if you\'re sleep-deprived, but keep them to 20–30 minutes before 3 PM. Longer or later naps can reduce sleep pressure and make it harder to fall asleep at night — potentially hurting your streak.',
    caffeine:     'Caffeine has a half-life of ~5–6 hrs. A coffee at 3 PM can still be 50% active at 9 PM, making it harder to fall asleep and reducing your deep sleep. Try cutting off caffeine by 1–2 PM for noticeably better rest.',
    alcohol:      'Alcohol may help you fall asleep faster, but it suppresses REM sleep and increases wake-ups in the second half of the night. Even 1–2 drinks can reduce REM by 20–25%. Try a no-alcohol evening and compare your quality score.',
    screen:       'Blue light from screens suppresses melatonin for up to 2 hours after exposure. Try enabling night mode on your devices after 8 PM and putting your phone down 30 mins before bed. Your REM sleep will thank you.',
    stress:       'Stress is one of the top sleep disruptors. High cortisol keeps your brain alert at bedtime. Try a 5-minute body scan or box breathing (4s inhale, 4s hold, 4s exhale, 4s hold) before bed to lower your nervous system activity.',
    exercise:     'Regular exercise improves deep sleep significantly, but timing matters. Exercise within 3 hrs of bedtime can raise core body temperature and delay sleep onset. Morning or afternoon workouts tend to benefit sleep the most.',
    melatonin:    'Melatonin is most effective for shifting your sleep schedule (like jet lag), not as a general sleep aid. A low dose (0.5–1 mg) taken 1–2 hrs before your target bedtime is more effective than higher doses. Darkness triggers natural melatonin production.',

    // ── Trends & Charts ───────────────────────────────────────────────────────
    trend:        'Your 7-day sleep trend shows a dip on Tuesday (6.5 hrs) and a peak on Saturday (8.5 hrs). The weekday dip is common but worth addressing — even 30 extra minutes on weeknights makes a measurable difference by Friday.',
    week:         `This week you averaged ${avgHours || 7.2} hrs/night. Your best night was Saturday at 8.5 hrs and your lowest was Tuesday at 6.5 hrs. Overall a solid week — keep that Saturday momentum going on Sundays too.`,
    weekly:       `Weekly summary: ${avgHours || 7.2} hrs avg · Quality 78/100 · Deep sleep 1.8 hrs · 6-night streak. Your consistency is strong. Focus area: close the weekday gap between Tuesday lows and weekend highs.`,
    chart:        'Your sleep duration chart shows a healthy pattern with 7+ hours on most nights. The slight dip mid-week is normal for many people. Your bedtime tracker shows good consistency — within ~45 minutes across the week.',
    data:         `Here\'s a snapshot of your sleep data: Avg duration ${avgHours || 7.2} hrs · Quality 78/100 · Bedtime ~10:45 PM · Deep sleep 1.8 hrs (25%) · REM 19% · Streak 6 nights. Everything is in a healthy range!`,
    stats:        `Your sleep stats: ${avgHours || 7.2} hrs average · 78/100 quality · 10:45 PM average bedtime · 6:30 AM wake time · 1.8 hrs deep sleep · 6-night streak. You\'re performing above average on all key metrics.`,
    progress:     `Your sleep has improved this week compared to last. Duration is up, quality score held at 78, and your streak is at 6 nights. Keep logging daily — the more data, the more accurately we can spot patterns and give personalized insights.`,

    // ── Logging ───────────────────────────────────────────────────────────────
    log:          'To log your sleep, tap the "Log Sleep" button at the top right. You can record hours slept, bedtime, wake time, and a quality rating from 1–10. Logging daily builds the data needed for accurate trend analysis.',
    record:       'You can record tonight\'s sleep by pressing "Log Sleep" above. Fill in your hours, bedtime, wake time, and rate how rested you feel. Consistent logging unlocks weekly and monthly trend insights.',
    track:        'Sleep tracking works best when logged every day — even after a bad night. Your streaks, averages, and quality scores are all calculated from your logged entries. Tap "Log Sleep" to add tonight\'s session.',
    save:         'To save a sleep entry, click "Log Sleep", fill in your bedtime, wake time, hours slept, and quality rating, then hit "Save Sleep Log". Your data updates instantly across all your charts and metrics.',

    // ── Health & Science ──────────────────────────────────────────────────────
    health:       'Sleep is the foundation of physical and mental health. Chronic poor sleep is linked to increased risk of heart disease, diabetes, obesity, depression, and weakened immunity. Your current 7+ hr average is a strong protective factor.',
    brain:        'During sleep, your brain consolidates memories (REM), clears metabolic waste via the glymphatic system (deep sleep), and processes emotions. Your 1.8 hrs of deep sleep last night gave your brain a thorough "clean sweep."',
    memory:       'REM sleep (19% last night) is directly tied to memory consolidation and learning. If you\'re studying or working on complex tasks, protecting your REM by avoiding late alcohol and maintaining sleep duration pays off cognitively.',
    recovery:     'Deep sleep (25% last night) drives physical recovery — growth hormone is released primarily during this stage, repairing muscle, strengthening the immune system, and regulating metabolism. Your 1.8 hrs is a healthy amount.',
    immune:       'Sleep is one of the most powerful immune regulators. Less than 6 hours of sleep triples your risk of catching a cold. Your current 7+ hr average gives your immune system strong nightly support.',
    mood:         'Poor or disrupted sleep directly impacts mood and emotional regulation. Your 78/100 quality score and consistent REM sleep are likely contributing to better emotional resilience. Keep protecting your sleep window.',
    weight:       'Sleep deprivation increases ghrelin (hunger hormone) and decreases leptin (fullness hormone), making overeating more likely. Consistent 7–8 hr sleep supports healthy metabolism and appetite regulation.',
    heart:        'Regular quality sleep keeps blood pressure in check during the night and lowers cardiovascular risk. Deep sleep in particular is associated with a significant overnight dip in heart rate and blood pressure — your 25% deep sleep is doing great work.',
  };

  const buildWeeklySleepDuration = (docs: any[]): (number | null)[] => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = getEndOfWeek(startOfWeek);

  const weekData: (number | null)[] = [null, null, null, null, null, null, null];
  const today = new Date().getDay(); // Tue = 2

  if (today === 2) {
    const tuesdayIndex = 1;

    for (let i = 0; i < tuesdayIndex; i++) {
      weekData[i] = null;
    }
  }

  const thisWeekDocs = docs.filter(doc => {
    if (!doc.date) return false;
    const d = new Date(doc.date);
    return d >= startOfWeek && d <= endOfWeek;
  });

  const latestPerDay: Record<string, any> = {};

  thisWeekDocs.forEach(doc => {
    if (
      !latestPerDay[doc.date] ||
      new Date(doc.loggedAt) > new Date(latestPerDay[doc.date].loggedAt)
    ) {
      latestPerDay[doc.date] = doc;
    }
  });

  Object.values(latestPerDay).forEach((doc: any) => {
    const d = new Date(doc.date);

    const day = d.getDay();
    const index = day === 0 ? 6 : day - 1;

    weekData[index] = Number(doc.hoursSlept || 0);
  });

  return weekData;
};

const sleepDurationData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{
    label: 'Hours',
    data: sleepDurationChartData,
    backgroundColor: 'rgba(139,92,246,0.75)',
    borderRadius: 8,
  }],
};
const sleepStagesPercent =
  avgHours && avgHours > 0
    ? {
        deep: 25,
        light: 50,
        rem: 20,
        awake: 5,
      }
    : null;

const sleepStagesData = {
  labels: ['Deep Sleep', 'Light Sleep', 'REM', 'Awake'],
  datasets: [
    {
      data: sleepStagesPercent
        ? [
            sleepStagesPercent.deep,
            sleepStagesPercent.light,
            sleepStagesPercent.rem,
            sleepStagesPercent.awake
          ]
        : [0, 0, 0, 0],
      backgroundColor: [
        'rgba(99,102,241,0.85)',
        'rgba(139,92,246,0.85)',
        'rgba(168,85,247,0.85)',
        'rgba(192,132,252,0.3)',
      ],
      borderWidth: 0,
    },
  ],
};


  const buildWeeklyBedtimeDataset = (docs: any[]): (number | null)[] => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = getEndOfWeek(startOfWeek);

  // Default values = null (so missing days show as gaps)
  const weekData: (number | null)[] = [null, null, null, null, null, null, null];
  const today = new Date().getDay(); // Tue = 2

  if (today === 2) {
    const tuesdayIndex = 1;

    // Clear everything before Tuesday (i.e., Monday)
    for (let i = 0; i < tuesdayIndex; i++) {
      weekData[i] = null;
    }
  }

  // Filter only docs from current week
  const thisWeekDocs = docs.filter(doc => {
    if (!doc.date || !doc.bedTime) return false;
    const docDate = new Date(doc.date);
    return docDate >= startOfWeek && docDate <= endOfWeek;
  });

  // Keep latest log per date
  const latestPerDate: Record<string, any> = {};

  thisWeekDocs.forEach(doc => {
    if (
      !latestPerDate[doc.date] ||
      new Date(doc.loggedAt).getTime() > new Date(latestPerDate[doc.date].loggedAt).getTime()
    ) {
      latestPerDate[doc.date] = doc;
    }
  });

  Object.values(latestPerDate).forEach((doc: any) => {
    const docDate = new Date(doc.date);
    const jsDay = docDate.getDay(); // Sun=0
    const index = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6

    const [hours, minutes] = doc.bedTime.split(':').map(Number);

    // Convert to decimal time for chart
    // Example: 22:30 -> 22.5
    let bedtimeValue = hours + minutes / 60;

    // Optional: if after midnight, shift it forward so chart stays in "night range"
    if (hours < 12) {
      bedtimeValue += 24;
    }

    weekData[index] = bedtimeValue;
  });

  return weekData;
};

  const bedtimeData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Bedtime',
      data: bedtimeChartData,
      borderColor: 'rgba(139,92,246,1)',
      backgroundColor: 'rgba(139,92,246,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgba(168,85,247,1)',
      pointRadius: 4,
      spanGaps: false,
    },
  ],
};

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(220,220,255,0.7)', font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(8,20,50,0.95)', titleColor: '#fff', bodyColor: 'rgba(180,210,255,0.85)' },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
      x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(180,210,255,0.5)' } },
    },
  };

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: 'rgba(180,210,255,0.7)', font: { size: 11 }, padding: 14 } },
      tooltip: { backgroundColor: 'rgba(8,20,50,0.95)', titleColor: '#fff', bodyColor: 'rgba(180,210,255,0.85)' },
    },
    cutout: '68%',
  };
  const deepSleepHours =
  avgHours !== null && avgHours > 0
    ? (Math.round(avgHours * 0.25 * 10) / 10).toFixed(1)
    : '--';


  const metrics = [
    { label: 'Avg Duration',  value: String(avgHours || 7.2), unit: 'hrs',  color: '#8b5cf6', icon: Moon,       desc:
  avgHours >= 8
    ? 'Optimal sleep duration'
    : avgHours >= 7
    ? 'Healthy sleep range'
    : avgHours > 0
    ? 'Below recommended'
    : 'No data yet' },
    { label: 'Quality Score', value: avgQuality ? `${Math.round(avgQuality * 10)}` : '0/100', unit: '/100', color: '#a78bfa', icon: TrendingUp, desc:
  qualityPercent >= 85
    ? 'Excellent sleep quality'
    : qualityPercent >= 70
    ? 'Above average'
    : qualityPercent >= 50
    ? 'Average quality'
    : qualityPercent > 0
    ? 'Needs improvement'
    : 'No data yet'
 },
    { label: 'Avg Bedtime',   value: avgBedtime || '--:-- --',   color: '#38bdf8', icon: Clock,      desc: bedtimeConsistency },
    { label: 'Deep Sleep',    value: deepSleepHours,                   unit: 'hrs', color: '#f59e0b', icon: Star,       desc: `${deepSleepHours !== '--' ? `${Math.round(25)}%` : ''} of total sleep` },
  ];

  const card: React.CSSProperties = {
    background: 'rgba(8,20,50,0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100,180,255,0.12)',
    borderRadius: '18px',
    padding: '20px 22px',
    transition: 'all 0.3s ease',
  };

  const sleepGoalMessage =
  avgHours >= 8
    ? "You're hitting your sleep goal — keep your routine consistent!"
    : avgHours >= 7
    ? "You're close to your target — try going to bed a bit earlier."
    : avgHours > 0
    ? "You're below the recommended sleep — aim for at least 7–8 hours tonight."
    : "Log your sleep to get personalized targets and insights.";

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes ringPulse { 0%{ transform:scale(1); opacity:.6; } 100%{ transform:scale(1.7); opacity:0; } }
        @keyframes moonFloat {
          0%,100% { transform: translateY(0) rotate(-5deg); filter: drop-shadow(0 0 22px rgba(250,204,21,0.5)); }
          50%      { transform: translateY(-10px) rotate(2deg); filter: drop-shadow(0 0 38px rgba(250,204,21,0.8)); }
        }
        @keyframes bedSettle {
          0%,100% { transform: rotate(0deg) translateY(0); filter: drop-shadow(0 8px 20px rgba(0,0,0,0.4)); }
          30%     { transform: rotate(-1.5deg) translateY(-4px); filter: drop-shadow(0 12px 28px rgba(0,0,0,0.5)); }
          60%     { transform: rotate(1deg) translateY(-2px); }
        }
        @keyframes twinkle {
          0%,100% { opacity:.2; transform:scale(1); }
          50%      { opacity:.9; transform:scale(1.3); }
        }
        @keyframes streakPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          70% { transform:scale(1.1) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        .sleep-card:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 40px rgba(80,0,200,0.25) !important; }
        .organ-card:hover { transform: translateY(-4px) scale(1.015) !important; }
        .log-btn:hover    { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(139,92,246,0.45) !important; }
        .sleep-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(100,180,255,0.25); border-radius:10px; color:#e0f0ff; font-size:14px; outline:none; box-sizing:border-box; transition:all .2s; }
        .sleep-input:focus { border-color:rgba(139,92,246,0.7); background:rgba(255,255,255,0.11); box-shadow:0 0 0 3px rgba(139,92,246,0.15); }
        .sleep-input::placeholder { color:rgba(180,210,255,0.35); }
        .sleep-range { width:100%; accent-color:#8b5cf6; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(139,92,246,0.3); border-radius:10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: 0 }}>
          <Header userName="User" />

          <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 320px', gap: '22px', minHeight: 'calc(100vh - 73px)' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Page Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: mounted ? 'fadeIn 0.4s ease' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(139,92,246,0.15)', animation:'ringPulse 2.2s ease-out infinite' }} />
                    <div style={{ position:'absolute', inset:'8px', borderRadius:'50%', background:'rgba(139,92,246,0.2)', animation:'ringPulse 2.2s ease-out infinite 0.5s' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Moon size={22} color="#a78bfa" />
                    </div>
                  </div>
                  <div>
                    <h1 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'22px', margin:0, letterSpacing:'-0.3px' }}>Sleep Tracker</h1>
                    <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'13px', margin:'2px 0 0' }}>Monitor your sleep quality and patterns</p>
                  </div>
                </div>
                <button className="log-btn" onClick={() => setShowLogModal(true)}
                  style={{ background:'linear-gradient(135deg,#8b5cf6,#6366f1)', border:'none', borderRadius:'12px', padding:'12px 22px', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 18px rgba(139,92,246,0.35)', transition:'all .2s ease', letterSpacing:'0.02em' }}>
                  Log Sleep
                </button>
              </div>

              {/* Organ Cards */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:'16px', animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none' }}>

                {/* Moon Card */}
                <div style={{ ...card, border:'1px solid rgba(250,204,21,0.2)', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', padding:'28px 20px', position:'relative', overflow:'hidden' }} className="organ-card">
                  {[{top:'12%',left:'8%',d:.7},{top:'18%',right:'12%',d:1.1},{top:'8%',right:'30%',d:1.8},{top:'30%',left:'20%',d:2.3}].map((s,i)=>(
                    <div key={i} style={{ position:'absolute', top:s.top, left:(s as any).left, right:(s as any).right, width:4, height:4, borderRadius:'50%', background:'#fde68a', animation:`twinkle ${1.4+i*0.5}s ease-in-out infinite`, animationDelay:`${s.d}s` }} />
                  ))}
                  <div style={{ position:'absolute', bottom:'-24px', left:'50%', transform:'translateX(-50%)', width:'160px', height:'80px', background:'rgba(250,204,21,0.08)', filter:'blur(32px)', borderRadius:'50%', pointerEvents:'none' }} />
                  <img src={moonImg} alt="Moon" style={{ width:150, height:150, objectFit:'contain', animation:'moonFloat 4s ease-in-out infinite', filter:'drop-shadow(0 0 28px rgba(250,204,21,0.55))' }} />
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 5px' }}>Sleep Quality</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 5px #22c55e' }} />
                      <span style={{ color:'#22c55e', fontSize:'12px', fontWeight:600 }}>{avgQuality ? Math.round(avgQuality * 10) : 0} / 100</span>
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'4px 0 0' }}>
{qualityPercent >= 80
    ? 'Excellent'
    : qualityPercent >= 60
    ? 'Above average'
    : qualityPercent >= 40
    ? 'Average'
    : 'Poor'}
</p>
                  </div>
                </div>

                {/* Bed Card */}
                <div style={{ ...card, border:'1px solid rgba(196,130,89,0.25)', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', padding:'28px 20px', position:'relative', overflow:'hidden' }} className="organ-card">
                  <div style={{ position:'absolute', bottom:'-24px', left:'50%', transform:'translateX(-50%)', width:'160px', height:'80px', background:'rgba(196,130,89,0.08)', filter:'blur(32px)', borderRadius:'50%', pointerEvents:'none' }} />
                  <img src={bedImg} alt="Bed" style={{ width:150, height:150, objectFit:'contain', animation:'bedSettle 5s ease-in-out infinite', filter:'drop-shadow(0 8px 20px rgba(0,0,0,0.4))' }} />
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 5px' }}>Rest Duration</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 5px #22c55e' }} />
                      <span style={{ color:'#22c55e', fontSize:'12px', fontWeight:600 }}>{avgHours || 7.2} hrs avg</span>
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'4px 0 0' }}>Bedtime {avgBedtime || '--:-- --'}</p>
                  </div>
                </div>

                {/* Streak Card */}
                <div style={{ ...card, border:'1px solid rgba(251,191,36,0.25)', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', padding:'24px 16px', position:'relative', overflow:'hidden' }} className="organ-card">
                  <div style={{ position:'absolute', bottom:'-20px', left:'50%', transform:'translateX(-50%)', width:'140px', height:'70px', background:'rgba(251,191,36,0.08)', filter:'blur(30px)', borderRadius:'50%', pointerEvents:'none' }} />
                  <div style={{ position:'relative' }}>
                    <img src={streakImg} alt="Streak" style={{ width:120, height:120, objectFit:'contain', animation: mounted ? 'streakPop 0.6s cubic-bezier(.4,0,.2,1) 0.4s both' : 'none', filter:'drop-shadow(0 0 24px rgba(251,191,36,0.55))' }} />
                    <div style={{ position:'absolute', bottom:4, right:-4, width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'3px solid rgba(8,20,50,0.9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 12px rgba(251,191,36,0.7)', animation: mounted ? 'streakPop 0.6s ease 0.7s both' : 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'14px', margin:'0 0 5px' }}>
                      Sleep Streak
                    </p>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' }}>
                      <div
                        style={{
                          width:7,
                          height:7,
                          borderRadius:'50%',
                          background: sleepStreak > 0 ? '#fbbf24' : 'rgba(180,210,255,0.35)',
                          boxShadow: sleepStreak > 0 ? '0 0 5px #fbbf24' : 'none'
                        }}
                      />
                      <span
                        style={{
                          color: sleepStreak > 0 ? '#fbbf24' : 'rgba(180,210,255,0.45)',
                          fontSize:'12px',
                          fontWeight:600
                        }}
                      >
                        {sleepStreak} {sleepStreak === 1 ? 'night' : 'nights'}
                      </span>
                    </div>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:'4px 0 0' }}>
                      {sleepStreak > 0 ? '7+ hrs each night' : 'No active streak yet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:'14px', animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none' }}>
                {metrics.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} style={{ ...card, border:`1px solid ${m.color}22`, animationDelay:`${i*0.07}s`, cursor:'default' }} className="sleep-card">
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
                      <div style={{ marginTop:'10px', height:'3px', borderRadius:'2px', background:'rgba(255,255,255,0.06)' }}>
                        <div style={{ height:'100%', borderRadius:'2px', background:m.color, width: m.label === 'Quality Score' ? '78%' : m.label === 'Avg Duration' ? '90%' : m.label === 'Deep Sleep' ? '60%' : '85%', boxShadow:`0 0 6px ${m.color}`, transition:'width 1s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reminder Banner */}
              {/* <div style={{ background:'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(99,102,241,0.3))', backdropFilter:'blur(20px)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:'18px', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:'-30px', left:'-30px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(139,92,246,0.12)', filter:'blur(30px)', pointerEvents:'none' }} />
                <div>
                  <p style={{ color:'rgba(180,210,255,0.5)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Tonight's Target</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:0 }}>Aim for 8 hours — keep a consistent bedtime for better sleep quality</p>
                </div>
                <div style={{ display:'flex', gap:'16px', flexShrink:0, marginLeft:'20px' }}>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#a78bfa', fontWeight:800, fontSize:'20px', margin:0 }}>22:30</p>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:0 }}>Bedtime</p>
                  </div>
                  <div style={{ width:'1px', background:'rgba(180,210,255,0.1)' }} />
                  <div style={{ textAlign:'center' }}>
                    <p style={{ color:'#38bdf8', fontWeight:800, fontSize:'20px', margin:0 }}>06:30</p>
                    <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:0 }}>Wake time</p>
                  </div>
                </div>
              </div> */}
              <div style={{
  background:'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(99,102,241,0.3))',
  backdropFilter:'blur(20px)',
  border:'1px solid rgba(139,92,246,0.35)',
  borderRadius:'18px',
  padding:'18px 24px',
  display:'flex',
  alignItems:'center',
  justifyContent:'space-between',
  animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none',
  position:'relative',
  overflow:'hidden'
}}>
  <div style={{
    position:'absolute',
    top:'-30px',
    left:'-30px',
    width:'120px',
    height:'120px',
    borderRadius:'50%',
    background:'rgba(139,92,246,0.12)',
    filter:'blur(30px)',
    pointerEvents:'none'
  }} />

  <div>
    <p style={{
      color:'rgba(180,210,255,0.5)',
      fontSize:'11px',
      fontWeight:600,
      letterSpacing:'0.1em',
      textTransform:'uppercase',
      margin:'0 0 2px'
    }}>
      Tonight's Target
    </p>

    <p style={{
      color:'#e0f0ff',
      fontWeight:700,
      fontSize:'15px',
      margin:0
    }}>
      {sleepGoalMessage}
    </p>
  </div>

  <div style={{ display:'flex', gap:'16px', flexShrink:0, marginLeft:'20px' }}>

    {/* Bedtime */}
    <div style={{ textAlign:'center' }}>
      <p style={{ color:'#a78bfa', fontWeight:800, fontSize:'20px', margin:0 }}>
        {avgBedtime ? (
          <>
            {avgBedtime.split(' ')[0]}
            <span style={{ color:'#38bdf8', marginLeft:'4px' }}>
              {avgBedtime.split(' ')[1]}
            </span>
          </>
        ) : '--:--'}
      </p>
      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:0 }}>
        Bedtime
      </p>
    </div>

    <div style={{ width:'1px', background:'rgba(180,210,255,0.1)' }} />

    {/* Wake Time */}
    <div style={{ textAlign:'center' }}>
      <p style={{ color:'#a78bfa', fontWeight:800, fontSize:'20px', margin:0 }}>
        {avgWakeTime ? (
          <>
            {avgWakeTime.split(' ')[0]}
            <span style={{ color:'#38bdf8', marginLeft:'4px' }}>
              {avgWakeTime.split(' ')[1]}
            </span>
          </>
        ) : '--:--'}
      </p>
      <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'11px', margin:0 }}>
        Wake time
      </p>
    </div>

  </div>
</div>

              {/* Charts Row */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'16px', animation: mounted ? 'fadeUp 0.5s ease 0.3s both' : 'none' }}>
                <div style={card}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Weekly Trend</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>7-Day Sleep Duration</p>
                  <div style={{ height:'200px' }}><Bar options={chartOpts} data={sleepDurationData} /></div>
                </div>
                <div style={card}>
                  <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Breakdown</p>
                  <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>Sleep Stages</p>
                  <div style={{ height:'200px' }}><Doughnut options={doughnutOpts} data={sleepStagesData} /></div>
                </div>
              </div>

              {/* Bedtime Consistency */}
              <div style={{ ...card, animation: mounted ? 'fadeUp 0.5s ease 0.35s both' : 'none' }}>
                <p style={{ color:'rgba(180,210,255,0.45)', fontSize:'11px', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:'0 0 2px' }}>Consistency</p>
                <p style={{ color:'#e0f0ff', fontWeight:700, fontSize:'15px', margin:'0 0 16px' }}>Bedtime Tracker</p>
                <div style={{ height:'160px' }}><Line options={chartOpts} data={bedtimeData} /></div>
              </div>
            </div>

            {/* Chat */}
            <div style={{ animation: mounted ? 'fadeUp 0.5s ease 0.4s both' : 'none' }}>
              <ChatPanel
                title="Sleep AI"
                moduleKey="sleep"
                responses={chatResponses}
                defaultResponse="I can help with your sleep data, trends, tips, and health insights. Try asking about your quality score, deep sleep, REM, bedtime, streak, weekly trends, or how to improve your rest!"
                autoMessages={[{ text: `I can help with your sleep data, trends, tips, and health insights. Try asking about your quality score, deep sleep, REM, bedtime, streak, weekly trends, or how to improve your rest!`, delay: 1500 }]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Log Sleep Modal */}
      {showLogModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,5,20,0.7)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .25s ease' }} onClick={() => setShowLogModal(false)}>
          <div style={{ background:'#0d1a38', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'22px', padding:'36px', width:'100%', maxWidth:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', animation:'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
              <div style={{ width:40, height:40, borderRadius:'12px', background:'rgba(139,92,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Moon size={20} color="#a78bfa" />
              </div>
              <div>
                <h4 style={{ color:'#e0f0ff', fontWeight:800, fontSize:'18px', margin:0 }}>Log Sleep</h4>
                <p style={{ color:'rgba(180,210,255,0.4)', fontSize:'12px', margin:0 }}>Record tonight's rest</p>
              </div>
            </div>

            <form onSubmit={handleLogSubmit}>
              {[
                { label:'Hours Slept', key:'hours',    type:'number', placeholder:'e.g. 7.5', step:'0.1' },
                { label:'Bedtime',     key:'bedtime',  type:'time',   placeholder:'' },
                { label:'Wake Time',   key:'waketime', type:'time',   placeholder:'' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>{f.label}</label>
                  <input
                    type={f.type} step={(f as any).step} className="sleep-input"
                    value={logData[f.key as keyof typeof logData]}
                    onChange={e => setLogData({...logData, [f.key]: e.target.value})}
                    required placeholder={f.placeholder}
                  />
                </div>
              ))}

              <div style={{ marginBottom:'24px' }}>
                <label style={{ display:'block', color:'rgba(180,210,255,0.8)', fontSize:'12px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:'6px' }}>
                  Quality Rating — <span style={{ color:'#a78bfa' }}>{logData.quality} / 10</span>
                </label>
                <input type="range" className="sleep-range" min="1" max="10" value={logData.quality} onChange={e => setLogData({...logData, quality: e.target.value})} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                  <span style={{ color:'rgba(180,210,255,0.3)', fontSize:'10px' }}>Poor</span>
                  <span style={{ color:'rgba(180,210,255,0.3)', fontSize:'10px' }}>Excellent</span>
                </div>
              </div>

              <div style={{ display:'flex', gap:'10px' }}>
                <button type="submit" disabled={saving}
                  style={{ flex:1, padding:'13px', background: saving ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:700, fontSize:'14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow:'0 4px 18px rgba(139,92,246,0.35)', transition:'all .2s' }}
                  onMouseEnter={e => { if(!saving){ e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
                  {saving ? 'Saving...' : 'Save Sleep Log'}
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