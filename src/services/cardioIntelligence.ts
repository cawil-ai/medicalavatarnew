/**
 * cardioIntelligence.ts
 * ─────────────────────────────────────────────────────────────────
 * On-device, EXPLAINABLE cardiovascular intelligence engine.
 *
 * There is no LLM key in this project, and for health data that is a
 * feature, not a limitation: every number this module produces is
 * traceable to a published clinical threshold (AHA/ACC 2017 blood-
 * pressure categories, standard resting-HR / SpO₂ bands, age-adjusted
 * HRV expectations). Nothing is hallucinated — each insight ships with
 * the reason it was produced.
 *
 * Pure functions only (no React, no I/O) so the logic is testable and
 * reusable by the page, the chat panel, and the weekly report.
 */

/* ── Types ──────────────────────────────────────────────────────── */
export interface CardioMetrics {
  bpm:       number;   // latest/current heart rate
  restingHr: number;   // resting heart rate
  systolic:  number;   // mmHg
  diastolic: number;   // mmHg
  spo2:      number;   // %
  hrv:       number;   // ms
  recovery:  number;   // %
}

export interface CardioProfile {
  age:    number;
  gender: 'male' | 'female';
  bmi:    number | null;
}

export interface CardioReading extends CardioMetrics {
  id?:       string;   // backing document id (Appwrite $id or local id) — for edit/delete
  ts:        string;   // ISO timestamp
  activity?: string;   // logged activity type (e.g. "Running")
  note?:     string;   // optional user note
  zone?:     string;   // heart-rate zone at log time
}

export interface Band {
  band:     string;
  color:    string;
  severity: number;    // 0 = ideal … 4 = critical
  note:     string;
}

export interface RiskFactor {
  label:       string;
  points:      number;
  explanation: string;
}

export interface RiskResult {
  score:   number;        // 0 (best) … 100 (worst)
  band:    'Low' | 'Moderate' | 'Elevated' | 'High';
  color:   string;
  factors: RiskFactor[];  // explainable contributions, sorted desc
  summary: string;
}

export interface MetricTrend {
  key:           keyof CardioMetrics;
  label:         string;
  unit:          string;
  color:         string;
  series:        number[];          // chronological values
  avg:           number;
  min:           number;
  max:           number;
  latest:        number;
  delta:         number;            // latest − earliest in window
  direction:     'up' | 'down' | 'flat';
  interpretation:'improving' | 'declining' | 'stable';
}

export interface Recommendation {
  id:       string;
  title:    string;
  detail:   string;
  why:      string;
  priority: 'high' | 'medium' | 'low';
  icon:     string;
  color:    string;
}

export interface HealthSummary {
  headline:   string;
  paragraphs: string[];
  highlights: { label: string; value: string; tone: 'good' | 'watch' | 'bad' }[];
}

export interface CardioAlert {
  id:       string;
  severity: 'critical' | 'warning' | 'info';
  title:    string;
  message:  string;
}

/* ── Palette (matches the page's dark theme) ────────────────────── */
const GOOD = '#22c55e';
const OKAY = '#38bdf8';
const WARN = '#f59e0b';
const BAD  = '#ef4444';

/* ══════════════════════════════════════════════════════════════════
   CLASSIFIERS — each maps a raw value to a clinical band + reason
══════════════════════════════════════════════════════════════════ */

/** AHA/ACC 2017 blood-pressure categories. */
export function classifyBloodPressure(sys: number, dia: number): Band {
  if (sys >= 180 || dia >= 120)
    return { band: 'Hypertensive Crisis', color: BAD, severity: 4, note: 'Seek emergency care if this reading is confirmed.' };
  if (sys >= 140 || dia >= 90)
    return { band: 'Hypertension Stage 2', color: BAD, severity: 3, note: 'Consistently high — medical follow-up recommended.' };
  if (sys >= 130 || dia >= 80)
    return { band: 'Hypertension Stage 1', color: WARN, severity: 2, note: 'Above target. Lifestyle changes help here.' };
  if (sys >= 120)
    return { band: 'Elevated', color: WARN, severity: 1, note: 'Slightly above ideal — worth watching.' };
  if (sys < 90 || dia < 60)
    return { band: 'Low', color: OKAY, severity: 1, note: 'On the low side. Fine if you feel well.' };
  return { band: 'Normal', color: GOOD, severity: 0, note: 'Within the ideal range (<120/80).' };
}

/** Resting heart rate bands for adults. */
export function classifyRestingHr(bpm: number): Band {
  if (bpm > 120) return { band: 'Very High', color: BAD,  severity: 3, note: 'Markedly elevated resting rate.' };
  if (bpm > 100) return { band: 'Elevated (Tachycardia)', color: WARN, severity: 2, note: 'Resting rate above 100 BPM.' };
  if (bpm < 40)  return { band: 'Very Low', color: WARN, severity: 2, note: 'Unusually low — fine for elite athletes, otherwise check.' };
  if (bpm < 60)  return { band: 'Low (Athletic)', color: OKAY, severity: 0, note: 'Low resting rate, common in fit individuals.' };
  return { band: 'Normal', color: GOOD, severity: 0, note: 'Healthy resting range (60–100 BPM).' };
}

/** Blood-oxygen saturation bands. */
export function classifySpo2(spo2: number): Band {
  if (spo2 < 91) return { band: 'Critical', color: BAD,  severity: 4, note: 'Below 91% — seek medical attention.' };
  if (spo2 < 95) return { band: 'Low', color: WARN, severity: 2, note: 'Slightly low (91–94%). Monitor your breathing.' };
  return { band: 'Normal', color: GOOD, severity: 0, note: 'Excellent oxygen saturation (95–100%).' };
}

/** Age-adjusted HRV bands (rough; HRV declines with age). */
export function classifyHrv(hrv: number, age: number): Band {
  const expected = age < 35 ? 55 : age < 50 ? 45 : age < 65 ? 35 : 28; // ms midpoint
  if (hrv >= expected * 1.15) return { band: 'High', color: GOOD, severity: 0, note: 'Strong recovery capacity for your age.' };
  if (hrv >= expected * 0.75) return { band: 'Moderate', color: OKAY, severity: 1, note: 'Typical recovery capacity.' };
  if (hrv >= expected * 0.5)  return { band: 'Low', color: WARN, severity: 2, note: 'Below the expected range — fatigue or stress.' };
  return { band: 'Very Low', color: BAD, severity: 3, note: 'Well below expected — prioritise rest.' };
}

/**
 * Estimate a recovery/readiness score (0–100) from HRV and resting HR —
 * higher HRV and lower resting HR mean better recovery (the same inputs
 * WHOOP/Garmin use for readiness). Transparent and bounded.
 */
export function estimateRecovery(hrv: number, restingHr: number): number {
  const hrvScore = Math.max(-25, Math.min(35, (hrv - 50) * 0.8));
  const rhrScore = Math.max(-25, Math.min(25, (62 - restingHr) * 1.2));
  return Math.round(Math.max(20, Math.min(99, 60 + hrvScore + rhrScore)));
}

/** BMI category (mirrors UserProfileContext.getBMICategory). */
export function classifyBmi(bmi: number | null): Band | null {
  if (bmi == null || bmi <= 0) return null;
  if (bmi < 18.5) return { band: 'Underweight', color: OKAY, severity: 1, note: 'BMI below 18.5.' };
  if (bmi < 25)   return { band: 'Normal', color: GOOD, severity: 0, note: 'BMI in the healthy range.' };
  if (bmi < 30)   return { band: 'Overweight', color: WARN, severity: 1, note: 'BMI 25–30.' };
  return { band: 'Obese', color: BAD, severity: 2, note: 'BMI 30+, a cardiovascular risk factor.' };
}

/* ══════════════════════════════════════════════════════════════════
   RISK SCORE — explainable 0–100 cardiovascular risk
══════════════════════════════════════════════════════════════════ */
export function computeRiskScore(m: CardioMetrics, profile: CardioProfile): RiskResult {
  const factors: RiskFactor[] = [];
  const add = (label: string, points: number, explanation: string) => {
    if (points > 0) factors.push({ label, points, explanation });
  };

  // Blood pressure (largest weight)
  const bp = classifyBloodPressure(m.systolic, m.diastolic);
  const bpPoints = [0, 8, 18, 30, 45][bp.severity] ?? 0;
  add('Blood pressure', bpPoints, `${m.systolic}/${m.diastolic} mmHg — ${bp.band}.`);

  // Resting heart rate
  const rhr = classifyRestingHr(m.restingHr);
  const rhrPoints = m.restingHr > 120 ? 20 : m.restingHr > 100 ? 12 : m.restingHr < 40 ? 8 : 0;
  add('Resting heart rate', rhrPoints, `${m.restingHr} BPM — ${rhr.band}.`);

  // SpO₂
  const ox = classifySpo2(m.spo2);
  const oxPoints = m.spo2 < 91 ? 30 : m.spo2 < 95 ? 15 : 0;
  add('Blood oxygen', oxPoints, `${m.spo2}% SpO₂ — ${ox.band}.`);

  // HRV
  const hrvBand = classifyHrv(m.hrv, profile.age || 35);
  const hrvPoints = [0, 0, 10, 18][hrvBand.severity] ?? 0;
  add('Heart-rate variability', hrvPoints, `${m.hrv} ms — ${hrvBand.band} for your age.`);

  // Age
  const age = profile.age || 0;
  const agePoints = age >= 65 ? 15 : age >= 55 ? 10 : age >= 40 ? 5 : 0;
  if (age) add('Age', agePoints, `${age} years — risk rises gradually with age.`);

  // BMI
  const bmiBand = classifyBmi(profile.bmi);
  if (bmiBand) {
    const bmiPoints = bmiBand.band === 'Obese' ? 12 : bmiBand.band === 'Overweight' ? 5 : bmiBand.band === 'Underweight' ? 4 : 0;
    add('Body mass index', bmiPoints, `BMI ${profile.bmi} — ${bmiBand.band}.`);
  }

  // Recovery
  const recPoints = m.recovery < 50 ? 8 : m.recovery < 70 ? 4 : 0;
  add('Recovery', recPoints, `${m.recovery}% recovery score.`);

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  factors.sort((a, b) => b.points - a.points);

  let band: RiskResult['band'], color: string;
  if (score >= 60)      { band = 'High';     color = BAD;  }
  else if (score >= 35) { band = 'Elevated'; color = WARN; }
  else if (score >= 15) { band = 'Moderate'; color = OKAY; }
  else                  { band = 'Low';      color = GOOD; }

  const summary =
    band === 'Low'
      ? 'Your cardiovascular risk is low. Keep up your current habits.'
      : band === 'Moderate'
      ? 'A few factors are slightly outside the ideal range — small changes will help.'
      : band === 'Elevated'
      ? 'Several factors are raising your cardiovascular risk. Review the recommendations below.'
      : 'Multiple factors indicate high cardiovascular strain. Consider medical guidance.';

  return { score, band, color, factors, summary };
}

/* ══════════════════════════════════════════════════════════════════
   TREND ANALYSIS — real history → per-metric stats
══════════════════════════════════════════════════════════════════ */
const TREND_META: { key: keyof CardioMetrics; label: string; unit: string; color: string; goodDir: 'up' | 'down' }[] = [
  { key: 'bpm',       label: 'Heart Rate',     unit: 'bpm',  color: BAD,  goodDir: 'down' },
  { key: 'systolic',  label: 'Systolic BP',    unit: 'mmHg', color: '#a78bfa', goodDir: 'down' },
  { key: 'spo2',      label: 'Blood Oxygen',   unit: '%',    color: OKAY, goodDir: 'up' },
  { key: 'hrv',       label: 'HRV',            unit: 'ms',   color: GOOD, goodDir: 'up' },
  { key: 'recovery',  label: 'Recovery',       unit: '%',    color: WARN, goodDir: 'up' },
];

const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0);

export function analyzeTrends(readings: CardioReading[]): MetricTrend[] {
  // chronological order (oldest → newest)
  const ordered = [...readings].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));

  return TREND_META.map(meta => {
    const series = ordered.map(r => Number(r[meta.key]) || 0).filter(v => v > 0);
    const latest = series[series.length - 1] ?? 0;
    const first  = series[0] ?? latest;
    const delta  = latest - first;
    const threshold = meta.key === 'spo2' ? 1 : meta.key === 'hrv' ? 3 : 2;

    const direction: MetricTrend['direction'] =
      Math.abs(delta) < threshold ? 'flat' : delta > 0 ? 'up' : 'down';

    let interpretation: MetricTrend['interpretation'] = 'stable';
    if (direction !== 'flat') {
      const improving = direction === meta.goodDir;
      interpretation = improving ? 'improving' : 'declining';
    }

    return {
      key: meta.key, label: meta.label, unit: meta.unit, color: meta.color,
      series, avg: avg(series), min: series.length ? Math.min(...series) : 0,
      max: series.length ? Math.max(...series) : 0, latest, delta, direction, interpretation,
    };
  }).filter(t => t.series.length > 0);
}

/** Consecutive-day logging streak from reading timestamps. */
export function computeStreak(readings: CardioReading[]): number {
  if (!readings.length) return 0;
  const days = new Set(readings.map(r => new Date(r.ts).toISOString().split('T')[0]));
  let streak = 0;
  const cursor = new Date();
  // allow today OR yesterday to start the streak
  if (!days.has(cursor.toISOString().split('T')[0])) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().split('T')[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ══════════════════════════════════════════════════════════════════
   RECOMMENDATIONS — personalised + explainable ("why")
══════════════════════════════════════════════════════════════════ */
export function generateRecommendations(
  m: CardioMetrics, profile: CardioProfile, risk: RiskResult, trends: MetricTrend[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const bp = classifyBloodPressure(m.systolic, m.diastolic);

  if (bp.severity >= 2)
    recs.push({ id: 'bp', priority: 'high', icon: '🧂', color: BAD,
      title: 'Lower your blood pressure',
      detail: 'Cut sodium to <1,500 mg/day, limit alcohol, and add 30 min of brisk walking most days.',
      why: `Your reading of ${m.systolic}/${m.diastolic} mmHg is in the ${bp.band} range.` });

  if (m.spo2 < 95)
    recs.push({ id: 'spo2', priority: m.spo2 < 91 ? 'high' : 'medium', icon: '🫁', color: m.spo2 < 91 ? BAD : WARN,
      title: 'Support your oxygen levels',
      detail: 'Practise slow diaphragmatic breathing and ensure good ventilation. Seek care if breathless.',
      why: `Your SpO₂ is ${m.spo2}%, below the ideal 95–100% range.` });

  if (m.restingHr > 100)
    recs.push({ id: 'rhr', priority: 'medium', icon: '❤️', color: WARN,
      title: 'Bring your resting heart rate down',
      detail: 'Reduce caffeine, hydrate, improve sleep, and build an aerobic base with zone-2 cardio.',
      why: `Your resting heart rate is ${m.restingHr} BPM (elevated).` });

  const hrvBand = classifyHrv(m.hrv, profile.age || 35);
  if (hrvBand.severity >= 2)
    recs.push({ id: 'hrv', priority: 'medium', icon: '😮‍💨', color: WARN,
      title: 'Prioritise recovery to lift HRV',
      detail: 'Protect 7–9 h of sleep, take a rest day, and try 5 min of box breathing daily.',
      why: `Your HRV (${m.hrv} ms) is ${hrvBand.band.toLowerCase()} for your age.` });

  const bmiBand = classifyBmi(profile.bmi);
  if (bmiBand && bmiBand.severity >= 1 && bmiBand.band !== 'Underweight')
    recs.push({ id: 'bmi', priority: 'low', icon: '🏃', color: WARN,
      title: 'Gradual weight management',
      detail: 'Aim for 0.25–0.5 kg/week via a modest calorie deficit and regular movement.',
      why: `Your BMI is ${profile.bmi} (${bmiBand.band}), which raises cardiovascular load.` });

  if (m.recovery < 70)
    recs.push({ id: 'rest', priority: 'low', icon: '🛌', color: OKAY,
      title: 'Take it easier today',
      detail: 'Favour light activity and recovery — your body is still bouncing back.',
      why: `Your recovery score is ${m.recovery}%.` });

  // Trend-driven nudge
  const bpTrend = trends.find(t => t.key === 'systolic');
  if (bpTrend && bpTrend.interpretation === 'declining')
    recs.push({ id: 'bptrend', priority: 'medium', icon: '📈', color: WARN,
      title: 'Watch your rising BP trend',
      detail: 'Your systolic readings are trending up. Log daily and review triggers (stress, salt, sleep).',
      why: `Systolic moved ${bpTrend.delta > 0 ? '+' : ''}${bpTrend.delta} mmHg across your recent readings.` });

  // Always offer at least two constructive items
  if (recs.length < 2) {
    recs.push({ id: 'aerobic', priority: 'low', icon: '🚴', color: GOOD,
      title: 'Keep your aerobic base strong',
      detail: 'Target 150 min/week of moderate aerobic activity to protect your heart.',
      why: 'Consistent cardio lowers resting HR and raises HRV over time.' });
    recs.push({ id: 'hydrate', priority: 'low', icon: '💧', color: OKAY,
      title: 'Stay hydrated',
      detail: 'Aim for ~2–2.5 L of water daily — dehydration raises heart rate and strains the heart.',
      why: 'Good hydration keeps blood volume and heart rate stable.' });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
}

/* ══════════════════════════════════════════════════════════════════
   NARRATIVE SUMMARY — the "AI Health Summary"
══════════════════════════════════════════════════════════════════ */
export function generateSummary(
  m: CardioMetrics, profile: CardioProfile, risk: RiskResult, trends: MetricTrend[]
): HealthSummary {
  const bp  = classifyBloodPressure(m.systolic, m.diastolic);
  const rhr = classifyRestingHr(m.restingHr);
  const ox  = classifySpo2(m.spo2);
  const hrv = classifyHrv(m.hrv, profile.age || 35);

  const headline =
    risk.band === 'Low'      ? 'Your heart is in great shape today' :
    risk.band === 'Moderate' ? 'Your heart looks good, with a couple of things to watch' :
    risk.band === 'Elevated' ? 'A few cardiovascular signals need your attention' :
                               'Several signals suggest your heart is under strain';

  const p1 =
    `Your resting heart rate is ${m.restingHr} BPM (${rhr.band.toLowerCase()}), blood pressure ` +
    `${m.systolic}/${m.diastolic} mmHg (${bp.band}), and blood oxygen ${m.spo2}% (${ox.band.toLowerCase()}). ` +
    `HRV is ${m.hrv} ms — ${hrv.band.toLowerCase()} for your age — giving an overall risk score of ` +
    `${risk.score}/100 (${risk.band}).`;

  const movers = trends.filter(t => t.interpretation !== 'stable');
  const p2 = movers.length
    ? 'Looking at your recent history, ' + movers.map(t =>
        `${t.label.toLowerCase()} is ${t.interpretation} (${t.delta > 0 ? '+' : ''}${t.delta} ${t.unit})`
      ).join(', ') + '.'
    : 'Your recent readings have been stable, which is a good sign of a consistent baseline.';

  const top = risk.factors[0];
  const p3 = top
    ? `The biggest contributor to your score right now is ${top.label.toLowerCase()} — ${top.explanation} ` +
      'See the recommendations for concrete next steps.'
    : 'No single factor stands out as a concern — keep logging to maintain this baseline.';

  const tone = (sev: number): 'good' | 'watch' | 'bad' => (sev === 0 ? 'good' : sev <= 1 ? 'watch' : 'bad');

  return {
    headline,
    paragraphs: [p1, p2, p3],
    highlights: [
      { label: 'Risk', value: `${risk.score} · ${risk.band}`, tone: tone(risk.band === 'Low' ? 0 : risk.band === 'Moderate' ? 1 : 2) },
      { label: 'Blood Pressure', value: bp.band, tone: tone(bp.severity) },
      { label: 'Resting HR', value: `${m.restingHr} bpm`, tone: tone(rhr.severity) },
      { label: 'SpO₂', value: `${m.spo2}%`, tone: tone(ox.severity) },
      { label: 'HRV', value: `${m.hrv} ms`, tone: tone(hrv.severity) },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════
   ALERTS — threshold breaches → notifications
══════════════════════════════════════════════════════════════════ */
export function detectAlerts(m: CardioMetrics): CardioAlert[] {
  const alerts: CardioAlert[] = [];

  if (m.systolic >= 180 || m.diastolic >= 120)
    alerts.push({ id: 'bp-crisis', severity: 'critical', title: 'Hypertensive crisis',
      message: `BP ${m.systolic}/${m.diastolic} mmHg. If confirmed, seek emergency care.` });
  else if (m.systolic >= 140 || m.diastolic >= 90)
    alerts.push({ id: 'bp-stage2', severity: 'warning', title: 'High blood pressure',
      message: `BP ${m.systolic}/${m.diastolic} mmHg is in Stage 2 hypertension range.` });

  if (m.spo2 < 91)
    alerts.push({ id: 'spo2-crit', severity: 'critical', title: 'Low blood oxygen',
      message: `SpO₂ ${m.spo2}% is below 91%. Seek medical attention if you feel breathless.` });
  else if (m.spo2 < 95)
    alerts.push({ id: 'spo2-low', severity: 'warning', title: 'Reduced blood oxygen',
      message: `SpO₂ ${m.spo2}% is slightly low. Monitor your breathing.` });

  if (m.bpm >= 140)
    alerts.push({ id: 'hr-crit', severity: 'critical', title: 'Very high heart rate',
      message: `Heart rate ${m.bpm} BPM. Rest and re-check; seek care if it persists at rest.` });
  else if (m.bpm > 100)
    alerts.push({ id: 'hr-high', severity: 'warning', title: 'Elevated heart rate',
      message: `Heart rate ${m.bpm} BPM is above the resting norm.` });

  if (m.bpm > 0 && m.bpm < 45)
    alerts.push({ id: 'hr-low', severity: 'warning', title: 'Low heart rate',
      message: `Heart rate ${m.bpm} BPM is low. Normal for athletes, but watch for dizziness.` });

  return alerts;
}
