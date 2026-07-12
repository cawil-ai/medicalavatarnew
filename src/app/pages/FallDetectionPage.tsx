import { useState, useEffect, useCallback, memo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { toast } from 'sonner';
import { Activity, ShieldAlert } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { getCurrentUserId } from '../../lib/appwrite';
import { useFallDetection } from '../hooks/useFallDetection';
import {
  getFallEvents, saveFallEvent, deleteFallEvent,
  getContacts, saveContacts, notifyEmergencyContacts,
  sendFallAlertEmails,
  type EmergencyContact,
} from '../../services/fallService';
import type { FallEvent } from '../../services/fallAlgorithm';
import { StatusBanner } from '../components/fall/StatusBanner';
import { LiveSensorFeed } from '../components/fall/LiveSensorFeed';
import { SosButton } from '../components/fall/SosButton';
import { FallHistoryLog } from '../components/fall/FallHistoryLog';
import { EmergencyContactsWidget } from '../components/fall/EmergencyContactsWidget';
import { FallCountdownModal } from '../components/fall/FallCountdownModal';

const MemoSidebar = memo(Sidebar);
const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function FallDetectionPage() {
  const { isMobile } = useResponsive();
  const fall = useFallDetection();

  const [events, setEvents]     = useState<FallEvent[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  /* ── Load persisted data ───────────────────────────────────────── */
  const refreshEvents = useCallback(async () => {
    const uid = await getCurrentUserId();
    setEvents(await getFallEvents(uid));
  }, []);

  useEffect(() => {
    (async () => {
      let uid: string;
      try { uid = await getCurrentUserId(); }
      catch (err) { console.error('❌ Fall data load (auth):', err); return; }
      // Load events and contacts independently so a failure in one
      // (e.g. a misconfigured contacts collection) never blanks the other.
      const [evRes, ctRes] = await Promise.allSettled([getFallEvents(uid), getContacts(uid)]);
      if (evRes.status === 'fulfilled') setEvents(evRes.value);
      else console.error('❌ Fall events load:', evRes.reason);
      if (ctRes.status === 'fulfilled') setContacts(ctRes.value);
      else console.error('❌ Emergency contacts load:', ctRes.reason);
    })();
  }, []);

  /* ── Build a FallEvent from the pending detection ──────────────── */
  const buildEvent = (action: string, emergencyContact?: string): FallEvent | null => {
    if (!fall.pendingFall) return null;
    const d = fall.pendingFall.detection;
    return {
      id: newId(), ts: new Date().toISOString(), severity: d.severity, type: d.classification.type,
      action, impactG: d.impactG, stillnessMs: d.stillnessMs, confidence: d.confidence,
      emergencyContact,
      lat: fall.location?.lat, lng: fall.location?.lng,
    };
  };

  const persistEvent = async (ev: FallEvent) => {
    try { const uid = await getCurrentUserId(); await saveFallEvent(uid, ev); await refreshEvents(); }
    catch (err) { console.error('❌ Save fall event:', err); }
  };

  /* ── Modal resolution handlers ─────────────────────────────────── */
  const handleImOkay = async () => {
    const ev = buildEvent('False Alarm – Dismissed');
    fall.dismissPendingFall();
    if (ev) await persistEvent(ev);
    toast.success('Marked as a false alarm. Glad you\'re okay!');
  };

  const handleNotify = async () => {
    const contactNames = contacts.map(c => c.name).filter(Boolean).join(', ') || undefined;
    const ev = buildEvent('Emergency Contacts Notified', contactNames);
    if (ev) {
      await persistEvent(ev);
      const [, emailRes] = await Promise.all([
        notifyEmergencyContacts(contacts, fall.location),
        sendFallAlertEmails(contacts, fall.location, ev),
      ]);

      const parts: string[] = [];
      if (contacts.length) parts.push(`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`);
      if (emailRes.sent > 0) parts.push(`${emailRes.sent} email${emailRes.sent === 1 ? '' : 's'} sent`);
      if (emailRes.failed > 0) parts.push(`${emailRes.failed} email${emailRes.failed === 1 ? '' : 's'} failed`);

      toast.error(
        parts.length
          ? `🚨 SOS — ${parts.join(', ')}.`
          : '🚨 SOS triggered — add emergency contacts to alert someone.'
      );

      if (emailRes.errors && emailRes.errors.length > 0) {
        emailRes.errors.forEach(errStr => {
          toast.error(`Email Error: ${errStr}`, { duration: 8000 });
        });
      }
    }
  };

  const handleStopSos = () => { fall.dismissPendingFall(); toast('SOS alarm stopped.'); };

  /* ── History + contacts persistence ────────────────────────────── */
  const handleDeleteEvent = async (e: FallEvent) => {
    try { const uid = await getCurrentUserId(); await deleteFallEvent(uid, e.id); setEvents(prev => prev.filter(x => x.id !== e.id)); }
    catch (err) { console.error('❌ Delete fall event:', err); }
  };

  const handleSaveContacts = async (next: EmergencyContact[]) => {
    setContacts(next);
    try { const uid = await getCurrentUserId(); await saveContacts(uid, next); }
    catch (err) { console.error('❌ Save contacts:', err); }
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fallPulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes sosPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); } 70% { box-shadow: 0 0 0 26px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
        @keyframes sosFlash { 0%, 100% { background: rgba(60,0,0,0.92); } 50% { background: rgba(110,0,0,0.95); } }
        @keyframes sosShake { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
        .sos-big-btn:hover { transform: scale(1.04); }
        .sos-big-btn { transition: transform 0.15s ease; }
        .sim-btn:hover { background: rgba(245,158,11,0.25) !important; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: rgba(100,180,255,0.2); border-radius: 10px; }
      `}</style>

      <div className="dashboard-page">
        <MemoSidebar />
        <div className="main-content" style={{ padding: 0 }}>

          {/* Header */}
          <div style={{ background: 'rgba(8,20,50,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(100,180,255,0.12)', padding: isMobile ? '16px 18px 16px 64px' : '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldAlert size={26} color="#22c55e" />
              <div>
                <h1 style={{ color: '#e0f0ff', fontWeight: 800, fontSize: '22px', margin: 0, letterSpacing: '-0.3px' }}>Fall Detection</h1>
                <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '13px', margin: '2px 0 0' }}>Sensor-based safety monitoring & emergency SOS</p>
              </div>
            </div>
            <button onClick={fall.simulateFall} className="sim-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '12px', padding: '10px 18px', color: '#fcd34d', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              <Activity size={15} /> Simulate Fall (Test)
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <StatusBanner
              monitoring={fall.monitoring} onToggle={fall.toggleMonitoring}
              sensorMode={fall.sensorMode} motionState={fall.motionState}
              onEnableRealSensors={fall.enableRealSensors} latestG={fall.latestG} location={fall.location}
            />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '18px', alignItems: 'start', width: '100%' }}>
              {/* Left */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
                <LiveSensorFeed samples={fall.samples} monitoring={fall.monitoring} latestG={fall.latestG} />
                <FallHistoryLog events={events} onDelete={handleDeleteEvent} />
              </div>
              {/* Right */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
                <SosButton onClick={fall.triggerSos} />
                <EmergencyContactsWidget contacts={contacts} onSave={handleSaveContacts} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {fall.pendingFall && (
        <FallCountdownModal
          pending={fall.pendingFall} location={fall.location}
          onImOkay={handleImOkay} onNotify={handleNotify} onClose={handleStopSos}
        />
      )}
    </>
  );
}
