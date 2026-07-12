import { useState } from 'react';
import { Trash2, History, ImageDown, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FallEvent } from '../../../services/fallAlgorithm';
import { exportFallHistoryJpg, exportFallHistoryPdf } from '../../../services/fallReportExport';

const SEV_COLOR: Record<string, string> = { high: '#ef4444', moderate: '#f59e0b', low: '#38bdf8' };

function fmtDate(ts: string) { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(ts: string) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

/** Past incidents: Date · Time · Severity · Action Taken (+ delete, JPG/PDF export). */
export function FallHistoryLog({ events, onDelete }: { events: FallEvent[]; onDelete: (e: FallEvent) => void }) {
  const notified = (a: string) => a.toLowerCase().includes('notified');
  const [exporting, setExporting] = useState<'jpg' | 'pdf' | null>(null);
  const disabled = events.length === 0 || exporting !== null;

  const runExport = async (kind: 'jpg' | 'pdf') => {
    if (disabled) return;
    setExporting(kind);
    try {
      await (kind === 'jpg' ? exportFallHistoryJpg(events) : exportFallHistoryPdf(events));
      toast.success(`Fall history exported as ${kind.toUpperCase()}`);
    } catch (err) {
      console.error('[fall] export failed:', err);
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(null);
    }
  };

  const exportBtn = (kind: 'jpg' | 'pdf', Icon: typeof ImageDown) => (
    <button className="fh-exp" onClick={() => runExport(kind)} disabled={disabled}
      aria-label={`Export as ${kind.toUpperCase()}`}
      title={events.length === 0 ? 'No incidents to export' : `Export as ${kind.toUpperCase()} for your doctor`}
      style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,189,248,0.35)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled && exporting !== kind ? 0.4 : 1, transition: 'background 0.15s' }}>
      {exporting === kind ? <Loader2 size={13} style={{ animation: 'fh-spin 0.9s linear infinite' }} /> : <Icon size={13} />}
    </button>
  );

  return (
    <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px' }}>
      <style>{`.fh-row:hover{ background:rgba(255,255,255,0.03)!important; } .fh-del:hover{ background:rgba(239,68,68,0.15)!important; } .fh-exp:not(:disabled):hover{ background:rgba(56,189,248,0.15)!important; } @keyframes fh-spin{ to{ transform:rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={18} color="#38bdf8" />
          <div>
            <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1px' }}>Incident History</p>
            <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Fall History Log</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {exportBtn('jpg', ImageDown)}
          {exportBtn('pdf', FileDown)}
          <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12.5px', lineHeight: 1.5, margin: 0 }}>
          No incidents recorded. Detected falls — and dismissed false alarms — will appear here.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.6fr 36px', gap: '8px', padding: '0 10px 8px', borderBottom: '1px solid rgba(100,180,255,0.1)' }}>
            {['Date', 'Time', 'Severity', 'Action Taken', ''].map((h, i) => (
              <span key={i} style={{ color: 'rgba(180,210,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>
          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '300px', overflowY: 'auto' }}>
            {events.map(e => (
              <div key={e.id} className="fh-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.6fr 36px', gap: '8px', alignItems: 'center', padding: '11px 10px', borderBottom: '1px solid rgba(100,180,255,0.06)', borderRadius: '8px', transition: 'background 0.15s' }}>
                <span style={{ color: '#e0f0ff', fontSize: '12.5px' }}>{fmtDate(e.ts)}</span>
                <span style={{ color: 'rgba(200,225,255,0.7)', fontSize: '12.5px' }}>{fmtTime(e.ts)}</span>
                <span>
                  <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 800, textTransform: 'capitalize', background: `${SEV_COLOR[e.severity]}1f`, color: SEV_COLOR[e.severity], border: `1px solid ${SEV_COLOR[e.severity]}44` }}>{e.severity}</span>
                </span>
                <span style={{ color: notified(e.action) ? '#fca5a5' : 'rgba(180,210,255,0.6)', fontSize: '12px', fontWeight: notified(e.action) ? 700 : 400 }}>{e.action}</span>
                <button className="fh-del" onClick={() => onDelete(e)} aria-label="Delete incident" title="Delete"
                  style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
