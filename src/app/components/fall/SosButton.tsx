import { Siren } from 'lucide-react';

/** Large, accessible manual SOS button → opens the countdown/alarm flow. */
export function SosButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Emergency</p>
      <button
        onClick={onClick}
        aria-label="Activate emergency SOS"
        className="sos-big-btn"
        style={{
          width: '150px', height: '150px', borderRadius: '50%', cursor: 'pointer',
          background: 'radial-gradient(circle at 50% 35%, #ef4444, #b91c1c)',
          border: '4px solid rgba(239,68,68,0.5)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
          boxShadow: '0 0 0 0 rgba(239,68,68,0.5)', animation: 'sosPulse 2s ease-out infinite',
        }}
      >
        <Siren size={42} />
        <span style={{ fontWeight: 900, fontSize: '26px', letterSpacing: '0.08em' }}>SOS</span>
      </button>
      <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12px', textAlign: 'center', margin: 0, maxWidth: '220px', lineHeight: 1.5 }}>
        Press to start the emergency countdown and alert your contacts with your location.
      </p>
    </div>
  );
}
