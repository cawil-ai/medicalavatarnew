import { ShieldCheck, ShieldAlert, Smartphone, MapPin, Activity } from 'lucide-react';
import type { SensorMode, MotionState } from '../../hooks/useFallDetection';
import type { GeoLocation } from '../../../services/fallService';

interface Props {
  monitoring:  boolean;
  onToggle:    () => void;
  sensorMode:  SensorMode;
  motionState: MotionState;
  onEnableRealSensors: () => void;
  latestG:     number;
  location:    GeoLocation | null;
}

/** Large status card: 🟢 Active & Monitoring / 🔴 Monitoring Paused. */
export function StatusBanner({ monitoring, onToggle, sensorMode, motionState, onEnableRealSensors, latestG, location }: Props) {
  const accent = monitoring ? '#22c55e' : '#ef4444';
  const Icon = monitoring ? ShieldCheck : ShieldAlert;

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(8,20,50,0.85) 0%, ${accent}14 100%)`,
      backdropFilter: 'blur(20px)', border: `1px solid ${accent}44`, borderRadius: '22px',
      padding: '26px 28px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-50px', right: '-30px', width: '200px', height: '200px', borderRadius: '50%', background: `${accent}1a`, filter: 'blur(50px)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '16px', background: `${accent}1f`, border: `1px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: monitoring ? `0 0 22px ${accent}44` : 'none' }}>
            <Icon size={30} color={accent} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, animation: monitoring ? 'fallPulse 1.4s ease-out infinite' : 'none' }} />
              <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '20px', margin: 0 }}>
                {monitoring ? 'System Active & Monitoring' : 'Monitoring Paused'}
              </h2>
            </div>
            <p style={{ color: 'rgba(180,210,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>
              {monitoring ? 'Continuously analysing motion for fall events.' : 'Detection is off. Resume to stay protected.'}
            </p>
          </div>
        </div>

        <button onClick={onToggle} style={{
          background: monitoring ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
          border: monitoring ? '1px solid rgba(239,68,68,0.4)' : 'none', borderRadius: '13px',
          padding: '12px 24px', color: monitoring ? '#f87171' : '#fff', fontWeight: 700, fontSize: '14px',
          cursor: 'pointer', boxShadow: monitoring ? 'none' : '0 4px 16px rgba(34,197,94,0.35)', flexShrink: 0,
        }}>
          {monitoring ? 'Pause Monitoring' : 'Resume Monitoring'}
        </button>
      </div>

      {/* Indicator chips */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px', position: 'relative' }}>
        <Chip icon={<Activity size={13} />} color="#38bdf8" label="Force" value={`${latestG.toFixed(2)} g`} />
        <Chip icon={<Smartphone size={13} />} color={sensorMode === 'real' ? '#22c55e' : '#a78bfa'}
          label="Sensor" value={sensorMode === 'real' ? 'Live device' : 'Simulated'} />
        <Chip icon={<MapPin size={13} />} color={location ? '#22c55e' : '#f59e0b'}
          label="GPS" value={location ? `${location.lat}, ${location.lng}` : 'Not yet located'} />

        {sensorMode === 'sim' && motionState !== 'unsupported' && (
          <button onClick={onEnableRealSensors} style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(96,165,250,0.12)',
            border: '1px solid rgba(96,165,250,0.4)', borderRadius: '10px', padding: '7px 13px',
            color: '#93c5fd', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}>
            <Smartphone size={13} /> Enable Motion Sensors
          </button>
        )}
        {motionState === 'denied' && (
          <span style={{ color: '#f87171', fontSize: '12px', alignSelf: 'center' }}>Motion permission denied — using simulated feed.</span>
        )}
        {motionState === 'unsupported' && (
          <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12px', alignSelf: 'center' }}>No motion sensor on this device — using simulated feed.</span>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(6,15,40,0.5)', border: `1px solid ${color}33`, borderRadius: '10px', padding: '7px 12px' }}>
      <span style={{ color, display: 'flex' }}>{icon}</span>
      <span style={{ color: 'rgba(180,210,255,0.55)', fontSize: '11px', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#e0f0ff', fontSize: '12px', fontWeight: 700 }}>{value}</span>
    </div>
  );
}
