import type {
  CardioMetrics, RiskResult, HealthSummary, Recommendation, MetricTrend,
} from '../../../services/cardioIntelligence';

interface Props {
  open:         boolean;
  onClose:      () => void;
  userName:     string;
  metrics:      CardioMetrics;
  risk:         RiskResult;
  summary:      HealthSummary;
  recs:         Recommendation[];
  trends:       MetricTrend[];
  readingCount: number;
}

const fmtDate = () => new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/** Self-contained printable HTML (used by both Print and Download). */
function buildReportHtml(p: Props): string {
  const { userName, metrics: m, risk, summary, recs, trends, readingCount } = p;
  const row = (k: string, v: string) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`;
  const factor = (f: RiskResult['factors'][0]) => `<li><strong>${f.label}</strong> (+${f.points}) — ${f.explanation}</li>`;
  const trend = (t: MetricTrend) =>
    `<tr><td>${t.label}</td><td>${t.latest}${t.unit}</td><td>${t.avg}${t.unit}</td><td>${t.min}–${t.max}${t.unit}</td><td>${t.interpretation}</td></tr>`;
  const rec = (r: Recommendation) => `<li><strong>[${r.priority.toUpperCase()}] ${r.title}</strong> — ${r.detail}<br/><em>Why: ${r.why}</em></li>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Cardiovascular Intelligence Report</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2238;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.5}
    h1{font-size:24px;margin:0} h2{font-size:16px;margin:26px 0 8px;border-bottom:2px solid #eef;padding-bottom:4px}
    .sub{color:#667;font-size:13px;margin:4px 0 0}
    .badge{display:inline-block;padding:4px 12px;border-radius:14px;font-weight:700;font-size:13px;background:${risk.color}22;color:${risk.color};border:1px solid ${risk.color}66}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
    td,th{padding:6px 8px;border-bottom:1px solid #eef;text-align:left}
    ul{font-size:13px;padding-left:18px} li{margin-bottom:6px}
    .score{font-size:40px;font-weight:800;color:${risk.color}}
    .foot{margin-top:30px;color:#99a;font-size:11px;border-top:1px solid #eef;padding-top:10px}
  </style></head><body>
    <h1>Weekly Cardiovascular Intelligence Report</h1>
    <p class="sub">${userName || 'Member'} · Generated ${fmtDate()} · Based on ${readingCount} reading(s)</p>

    <h2>Overall Risk</h2>
    <p><span class="score">${risk.score}</span> / 100 &nbsp; <span class="badge">${risk.band}</span></p>
    <p>${risk.summary}</p>
    <ul>${risk.factors.map(factor).join('') || '<li>No risk factors detected — all metrics in healthy range.</li>'}</ul>

    <h2>AI Health Summary</h2>
    <p><strong>${summary.headline}</strong></p>
    ${summary.paragraphs.map(x => `<p>${x}</p>`).join('')}

    <h2>Current Vitals</h2>
    <table>
      ${row('Heart rate', `${m.bpm} bpm`)}
      ${row('Resting heart rate', `${m.restingHr} bpm`)}
      ${row('Blood pressure', `${m.systolic}/${m.diastolic} mmHg`)}
      ${row('Blood oxygen (SpO₂)', `${m.spo2}%`)}
      ${row('HRV', `${m.hrv} ms`)}
      ${row('Recovery', `${m.recovery}%`)}
    </table>

    <h2>Trend Analysis</h2>
    ${trends.length
      ? `<table><tr><th>Metric</th><th>Latest</th><th>Avg</th><th>Range</th><th>Trend</th></tr>${trends.map(trend).join('')}</table>`
      : '<p>Not enough history yet — keep logging to build trends.</p>'}

    <h2>Personalised Recommendations</h2>
    <ul>${recs.map(rec).join('')}</ul>

    <p class="foot">AiVA Cardiovascular Monitor · This report is informational and not a medical diagnosis.
    Insights are generated from your logged readings using transparent clinical thresholds (AHA/ACC).</p>
  </body></html>`;
}

/**
 * WeeklyReportModal — the "Weekly Cardiovascular Intelligence Report".
 * Compiles summary + risk + trends + recommendations into a document
 * the user can Print (browser print-to-PDF) or Download as standalone HTML.
 */
export function WeeklyReportModal(props: Props) {
  if (!props.open) return null;
  const { onClose, risk, summary, recs, trends, readingCount } = props;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(buildReportHtml(props));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handleDownload = () => {
    const blob = new Blob([buildReportHtml(props)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardio-report-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,20,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .25s ease' }} onClick={onClose}>
      <div style={{ background: '#0d1a38', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '22px', padding: '30px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'fadeUp .3s ease' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📋</div>
            <div>
              <h4 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '17px', margin: 0 }}>Weekly Intelligence Report</h4>
              <p style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px', margin: 0 }}>{fmtDate()} · {readingCount} reading(s)</p>
            </div>
          </div>
          <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, background: `${risk.color}22`, border: `1px solid ${risk.color}55`, color: risk.color }}>
            Risk {risk.score} · {risk.band}
          </span>
        </div>

        {/* Preview body */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
          <Section title="Summary">
            <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '13.5px', margin: '0 0 6px' }}>{summary.headline}</p>
            <p style={{ color: 'rgba(200,225,255,0.7)', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>{summary.paragraphs[0]}</p>
          </Section>

          <Section title="Top risk factors">
            {risk.factors.length === 0
              ? <p style={{ color: 'rgba(180,210,255,0.55)', fontSize: '12.5px', margin: 0 }}>None — every metric is in a healthy range.</p>
              : risk.factors.slice(0, 3).map(f => (
                  <p key={f.label} style={{ color: 'rgba(200,225,255,0.72)', fontSize: '12.5px', margin: '0 0 4px' }}>
                    • <strong style={{ color: '#e0f0ff' }}>{f.label}</strong> (+{f.points}) — {f.explanation}
                  </p>
                ))}
          </Section>

          <Section title="Trends">
            {trends.length === 0
              ? <p style={{ color: 'rgba(180,210,255,0.55)', fontSize: '12.5px', margin: 0 }}>Not enough history yet.</p>
              : trends.map(t => (
                  <p key={t.key} style={{ color: 'rgba(200,225,255,0.72)', fontSize: '12.5px', margin: '0 0 4px' }}>
                    • {t.label}: {t.latest}{t.unit} (avg {t.avg}{t.unit}) — {t.interpretation}
                  </p>
                ))}
          </Section>

          <Section title="Recommendations" last>
            {recs.map(r => (
              <p key={r.id} style={{ color: 'rgba(200,225,255,0.72)', fontSize: '12.5px', margin: '0 0 4px' }}>
                • <strong style={{ color: '#e0f0ff' }}>{r.title}</strong> — {r.detail}
              </p>
            ))}
          </Section>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrint} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
            🖨 Print / Save PDF
          </button>
          <button onClick={handleDownload} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '12px', color: '#e0f0ff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
            ⬇ Download HTML
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '12px', color: 'rgba(180,210,255,0.7)', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : '14px', paddingBottom: last ? 0 : '14px', borderBottom: last ? 'none' : '1px solid rgba(100,180,255,0.08)' }}>
      <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>{title}</p>
      {children}
    </div>
  );
}
