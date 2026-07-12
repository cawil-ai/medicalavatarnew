import { account, LOCAL_MODE } from '../lib/appwrite';
import type { FallEvent } from './fallAlgorithm';

/* ══════════════════════════════════════════════════════════════════
   FALL HISTORY DOCTOR REPORT — JPG / PDF export.
   Renders clean, light-themed A4 sheets offscreen and rasterizes them
   (modern-screenshot), then downloads a stitched JPG or a jsPDF doc.
   The live glassmorphism UI is never captured — backdrop-filter and
   oklch colors break DOM rasterizers. jspdf-autotable would give a
   vector/searchable PDF but duplicates the layout; 2x raster is
   legible and keeps a single rendering source for both formats.
══════════════════════════════════════════════════════════════════ */

interface ReportUser { name?: string; email?: string }

/* A4 portrait at 96 dpi — matches 210x297mm 1:1 for jsPDF addImage. */
const SHEET_W = 794;
const SHEET_H = 1123;
const ROWS_FIRST = 22;   // page 1 carries the full header
const ROWS_NEXT  = 30;   // continuation pages, compact header

const SEV_HEX: Record<string, { fg: string; bg: string }> = {
  high:     { fg: '#dc2626', bg: '#fee2e2' },
  moderate: { fg: '#d97706', bg: '#fef3c7' },
  low:      { fg: '#0284c7', bg: '#e0f2fe' },
};

const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

async function getReportUser(): Promise<ReportUser | undefined> {
  if (LOCAL_MODE) return { name: 'Local User' };
  try {
    const u = await account.get();
    return { name: u.name || undefined, email: u.email || undefined };
  } catch { return undefined; }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (ts: string) =>
  new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function rowHtml(e: FallEvent): string {
  const sev = SEV_HEX[e.severity] ?? SEV_HEX.low;
  const conf = e.confidence != null ? `${Math.round(e.confidence)}%` : '—';
  const loc = e.lat != null && e.lng != null
    ? `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}` : '—';
  const notified = e.action.toLowerCase().includes('notified');
  return `<tr>
    <td>${fmtDate(e.ts)}</td>
    <td>${fmtTime(e.ts)}</td>
    <td><span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:capitalize;color:${sev.fg};background:${sev.bg};">${esc(e.severity)}</span></td>
    <td style="${notified ? 'color:#b91c1c;font-weight:600;' : ''}">${esc(e.action)}</td>
    <td style="text-align:right;">${conf}</td>
    <td style="font-size:10px;color:#475569;">${loc}</td>
  </tr>`;
}

/** One self-contained HTML string per A4 page. Exported for testability. */
export function buildReportSheetsHtml(events: FallEvent[], user?: ReportUser): string[] {
  const generated = new Date().toLocaleString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const newest = events[0]?.ts, oldest = events[events.length - 1]?.ts;
  const period = oldest && newest ? `${fmtDate(oldest)} – ${fmtDate(newest)}` : '—';
  const notified = events.filter(e => e.action.toLowerCase().includes('notified')).length;
  const dismissed = events.length - notified;

  // Slice rows into pages: ROWS_FIRST on page 1, ROWS_NEXT after.
  const pages: FallEvent[][] = [];
  let i = 0;
  while (i < events.length) {
    const n = pages.length === 0 ? ROWS_FIRST : ROWS_NEXT;
    pages.push(events.slice(i, i + n));
    i += n;
  }
  if (pages.length === 0) pages.push([]);

  const style = `
    <style>
      .frs * { box-sizing: border-box; margin: 0; }
      .frs { width:${SHEET_W}px; height:${SHEET_H}px; background:#ffffff; color:#0f172a;
             font-family:${FONT}; padding:48px 52px; position:relative; overflow:hidden; }
      .frs table { width:100%; border-collapse:collapse; font-size:11.5px; }
      .frs thead th { text-align:left; font-size:9.5px; letter-spacing:0.08em; text-transform:uppercase;
             color:#64748b; padding:6px 8px; border-bottom:2px solid #cbd5e1; }
      .frs tbody td { padding:7px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
      .frs .foot { position:absolute; left:52px; right:52px; bottom:30px; display:flex;
             justify-content:space-between; font-size:9.5px; color:#94a3b8;
             border-top:1px solid #e2e8f0; padding-top:8px; }
    </style>`;

  const tableHead = `<thead><tr>
    <th style="width:14%">Date</th><th style="width:11%">Time</th><th style="width:13%">Severity</th>
    <th style="width:32%">Action Taken</th><th style="width:12%;text-align:right;">Confidence</th>
    <th style="width:18%">Location (lat, lng)</th></tr></thead>`;

  return pages.map((rows, p) => {
    const header = p === 0
      ? `<div style="border-bottom:3px solid #1d4ed8;padding-bottom:16px;margin-bottom:18px;">
           <div style="font-size:22px;font-weight:800;color:#1e3a8a;">Fall History Report</div>
           <div style="font-size:12px;color:#475569;margin-top:2px;">Medical Avatar — Fall Detection Log</div>
           <div style="display:flex;gap:28px;margin-top:14px;font-size:11.5px;color:#334155;">
             <div><b>Patient:</b> ${esc(user?.name || 'Not signed in')}${user?.email ? `<br><span style="color:#64748b">${esc(user.email)}</span>` : ''}</div>
             <div><b>Generated:</b><br>${generated}</div>
             <div><b>Period:</b><br>${period}</div>
             <div><b>Summary:</b><br>${events.length} event${events.length === 1 ? '' : 's'} · ${notified} notified · ${dismissed} false alarm${dismissed === 1 ? '' : 's'}</div>
           </div>
         </div>`
      : `<div style="border-bottom:2px solid #cbd5e1;padding-bottom:10px;margin-bottom:14px;
            display:flex;justify-content:space-between;align-items:baseline;">
           <span style="font-size:14px;font-weight:700;color:#1e3a8a;">Fall History Report — continued</span>
           <span style="font-size:10.5px;color:#64748b;">${esc(user?.name || '')}</span>
         </div>`;

    const body = rows.length
      ? `<table>${tableHead}<tbody>${rows.map(rowHtml).join('')}</tbody></table>`
      : `<p style="font-size:12px;color:#64748b;">No incidents recorded.</p>`;

    return `<div class="frs">${style}${header}${body}
      <div class="foot">
        <span>Medical Avatar · Fall Detection Log · Informational record, not a medical diagnosis.</span>
        <span>Page ${p + 1} of ${pages.length}</span>
      </div></div>`;
  });
}

async function renderSheetsToCanvases(events: FallEvent[]): Promise<HTMLCanvasElement[]> {
  const { domToCanvas } = await import('modern-screenshot');
  const user = await getReportUser();

  const container = document.createElement('div');
  // Offscreen but laid out — display:none would give zero-size captures.
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_W}px;z-index:-1;`;
  container.innerHTML = buildReportSheetsHtml(events, user).join('');
  document.body.appendChild(container);
  try {
    await document.fonts.ready;
    // Let styles/layout settle. rAF is paused in hidden/background tabs,
    // so a timeout fallback keeps the export from hanging there.
    await new Promise<void>(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 150);
    });
    const canvases: HTMLCanvasElement[] = [];
    for (const el of Array.from(container.children)) {
      canvases.push(await domToCanvas(el as HTMLElement, { scale: 2, backgroundColor: '#ffffff' }));
    }
    return canvases;
  } finally {
    container.remove();
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stamp = () => new Date().toISOString().split('T')[0];

/** Download the fall history as a single vertically-stitched JPG. */
export async function exportFallHistoryJpg(events: FallEvent[]): Promise<void> {
  if (events.length === 0) return;
  const canvases = await renderSheetsToCanvases(events);

  const out = document.createElement('canvas');
  out.width = canvases[0].width;
  out.height = canvases.reduce((h, c) => h + c.height, 0);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';               // JPEG has no alpha — avoid black pages
  ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height; }

  const blob = await new Promise<Blob | null>(res => out.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('JPEG encoding failed');
  downloadBlob(blob, `fall-history-${stamp()}.jpg`);
}

/** Download the fall history as a multi-page A4 PDF. */
export async function exportFallHistoryPdf(events: FallEvent[]): Promise<void> {
  if (events.length === 0) return;
  const [{ jsPDF }, canvases] = await Promise.all([
    import('jspdf'),
    renderSheetsToCanvases(events),
  ]);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  canvases.forEach((c, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  });
  pdf.save(`fall-history-${stamp()}.pdf`);
}
