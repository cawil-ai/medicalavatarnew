import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { account, ID } from '../../lib/appwrite';
import { createUserProfile } from '../../services/userService';

export function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name:'', email:'', password:'', confirmPassword:'' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!'); return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    setLoading(true);
    try {
      try { await account.deleteSession('current'); } catch (_) {}
      const user = await account.create(ID.unique(), formData.email, formData.password, formData.name);
      await account.createEmailPasswordSession(formData.email, formData.password);
      await createUserProfile(user.$id, formData.name, formData.email);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Full Name',         id: 'name',            type: 'text',     placeholder: 'Enter your full name' },
    { label: 'Email Address',     id: 'email',           type: 'email',    placeholder: 'you@example.com' },
    { label: 'Password',          id: 'password',        type: 'password', placeholder: 'Min. 8 characters' },
    { label: 'Confirm Password',  id: 'confirmPassword', type: 'password', placeholder: 'Confirm your password' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .signup-root {
          min-height: 100vh;
          width: 100%;
          background: url('/assets/FlowerBG.png') center/cover fixed no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow: hidden;
          padding: 24px 16px;
        }

        .signup-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 20, 0.52);
          pointer-events: none;
          z-index: 0;
        }

        /* Card */
        .signup-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          background: rgba(6, 10, 30, 0.72);
          backdrop-filter: blur(36px);
          -webkit-backdrop-filter: blur(36px);
          border: 1px solid rgba(99, 179, 255, 0.18);
          border-radius: 28px;
          padding: 44px 44px 40px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 24px 80px rgba(0,0,0,0.55),
            0 0 80px rgba(99,102,241,0.1),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .card-accent {
          position: absolute;
          top: 0; left: 8%; right: 8%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.7), rgba(167,139,250,0.6), rgba(192,132,252,0.4), transparent);
          border-radius: 0 0 2px 2px;
        }

        .corner-glow {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          filter: blur(40px);
          pointer-events: none;
        }
        .corner-glow.tl { top: -30px; left: -30px; background: rgba(56,189,248,0.12); }
        .corner-glow.br { bottom: -30px; right: -30px; background: rgba(167,139,250,0.12); }

        /* Logo section */
        .logo-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
          animation: fadeUp 0.6s ease 0.1s both;
        }

        .logo-ring {
          position: relative;
          width: 80px;
          height: 80px;
          margin-bottom: 16px;
        }

        .logo-ring::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            rgba(56,189,248,0.9),
            rgba(99,102,241,0.8),
            rgba(192,132,252,0.7),
            rgba(56,189,248,0.3),
            rgba(56,189,248,0.9)
          );
          animation: ringRotate 4s linear infinite;
        }

        .logo-ring::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            rgba(56,189,248,0.9),
            rgba(99,102,241,0.8),
            rgba(192,132,252,0.7),
            rgba(56,189,248,0.3),
            rgba(56,189,248,0.9)
          );
          animation: ringRotate 4s linear infinite;
          filter: blur(8px);
          opacity: 0.45;
        }

        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .logo-img-wrap {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: #060a1e;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 1;
        }

        .logo-img {
          width: 68px;
          height: 68px;
          object-fit: cover;
          border-radius: 50%;
        }

        .brand-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 4px;
        }

        .brand-tagline {
          font-size: 13px;
          color: rgba(180, 200, 255, 0.45);
          font-weight: 400;
        }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          animation: fadeUp 0.6s ease 0.15s both;
        }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider-text {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(99,179,255,0.45);
        }

        /* Fields */
        .field-group {
          margin-bottom: 14px;
          animation: fadeUp 0.5s ease both;
        }

        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(99,179,255,0.6);
          margin-bottom: 7px;
        }

        .field-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(100,180,255,0.12);
          border-radius: 14px;
          color: #e0eeff;
          font-size: 15px;
          font-family: 'Outfit', sans-serif;
          outline: none;
          transition: all 0.25s ease;
        }

        .field-input::placeholder {
          color: rgba(150,180,255,0.22);
          font-size: 14px;
        }

        .field-input.focused {
          border-color: rgba(56,189,248,0.55);
          background: rgba(56,189,248,0.05);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.08), 0 0 20px rgba(99,102,241,0.08);
        }

        /* Error */
        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 12px;
          padding: 11px 14px;
          margin-bottom: 18px;
          color: #fca5a5;
          font-size: 13px;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }

        /* Submit */
        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #38bdf8 0%, #6366f1 60%, #a855f7 100%);
          color: #fff;
          font-weight: 800;
          font-size: 15px;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.3px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease;
          box-shadow: 0 4px 24px rgba(56,189,248,0.25), 0 0 40px rgba(99,102,241,0.15);
          margin-top: 10px;
          margin-bottom: 18px;
          animation: fadeUp 0.6s ease 0.4s both;
        }

        .submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .submit-btn:hover:not(:disabled)::before { opacity: 1; }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(56,189,248,0.35), 0 0 50px rgba(99,102,241,0.25);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .signup-footer {
          text-align: center;
          animation: fadeUp 0.6s ease 0.45s both;
        }

        .signup-footer p { color: rgba(150,180,255,0.45); font-size: 13.5px; }
        .signup-footer a { color: #38bdf8; font-weight: 700; text-decoration: none; transition: color 0.2s; }
        .signup-footer a:hover { color: #c084fc; }

        .security-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 18px;
          color: rgba(150,180,255,0.25);
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          animation: fadeUp 0.6s ease 0.5s both;
        }

        .security-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: rgba(56,189,248,0.6);
          box-shadow: 0 0 6px rgba(56,189,248,0.5);
          animation: secPulse 2s ease-in-out infinite;
        }

        @keyframes secPulse {
          0%,100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 520px) {
          .signup-card { padding: 32px 22px 28px; }
          .brand-name { font-size: 20px; }
        }
      `}</style>

      <div className="signup-root">
        <div className="signup-card">
          <div className="card-accent" />
          <div className="corner-glow tl" />
          <div className="corner-glow br" />

          {/* Logo + Brand */}
          <div className="logo-section">
            <div className="logo-ring">
              <div className="logo-img-wrap">
                <img
                  src="/assets/AIVA.png"
                  alt="Medical Avatar"
                  className="logo-img"
                />
              </div>
            </div>
            <div className="brand-name">Medical Avatar</div>
            <div className="brand-tagline">Create your free account</div>
          </div>

          {/* Divider */}
          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">Get started</span>
            <div className="divider-line" />
          </div>

          {/* Error */}
          {error && (
            <div className="error-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignUp}>
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="field-group"
                style={{
                  marginBottom: i === fields.length - 1 ? '6px' : '14px',
                  animationDelay: `${0.2 + i * 0.07}s`,
                }}
              >
                <label className="field-label">{field.label}</label>
                <input
                  type={field.type}
                  name={field.id}
                  value={formData[field.id as keyof typeof formData]}
                  onChange={handleChange}
                  required
                  placeholder={field.placeholder}
                  className={`field-input ${focusedField === field.id ? 'focused' : ''}`}
                  onFocus={() => setFocusedField(field.id)}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? (
                <><span className="spinner" />Creating account...</>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="signup-footer">
              <p>
                Already have an account?{' '}
                <Link to="/">Login</Link>
              </p>
            </div>

            <div className="security-badge">
              <div className="security-dot" />
              Secured with end-to-end encryption
            </div>
          </form>
        </div>
      </div>
    </>
  );
}