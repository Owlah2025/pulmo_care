import { useState } from 'react';
import { apiService } from '../../services/api';
import './patient.css';

interface Props {
  onAuth: (patientId: string, patientName: string) => void;
}

const DIAGNOSES = ['COPD', 'ILD (Interstitial Lung Disease)', 'Asthma', 'Asthma / COPD Overlap', 'Pulmonary Fibrosis', 'Other'];

export default function PatientAuth({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiService.patientLogin(loginEmail, loginPassword);
      onAuth(res.data.patient_id, res.data.patient_name);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill in all required fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiService.patientRegister({ name, email, password, diagnosis: diagnosis || undefined });
      onAuth(res.data.patient_id, res.data.patient_name);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a0f1e 0%, #0d1528 50%, #0a1220 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#f0f4ff',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 10, filter: 'drop-shadow(0 0 20px rgba(59,130,246,0.5))' }}>🫁</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>PULMO CARE</div>
          <div style={{ fontSize: 13, color: '#8892a4', marginTop: 4 }}>Patient Portal</div>
        </div>

        {/* Toggle */}
        <div style={{
          display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 4, marginBottom: 24,
        }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 11, border: 'none',
                background: mode === m ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'transparent',
                color: mode === m ? 'white' : '#8892a4',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.2s',
                boxShadow: mode === m ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 20,
          padding: 28,
          backdropFilter: 'blur(12px)',
        }}>
          {mode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email" type="email" value={loginEmail} onChange={setLoginEmail} placeholder="your@email.com" onEnter={handleLogin} />
              <Field label="Password" type="password" value={loginPassword} onChange={setLoginPassword} placeholder="••••••••" onEnter={handleLogin} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Full Name *" value={name} onChange={setName} placeholder="Ahmed Hassan" />
              <Field label="Email *" type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
              <Field label="Password *" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
              <Field label="Confirm Password *" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat password" onEnter={handleRegister} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Diagnosis (optional)</div>
                <select
                  value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                    color: diagnosis ? '#f0f4ff' : '#8892a4',
                    fontSize: 14, padding: '12px 14px',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select your diagnosis</option>
                  {DIAGNOSES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, fontSize: 13, color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            style={{
              width: '100%', marginTop: 20, padding: '14px',
              borderRadius: 14, border: 'none',
              background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
              boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <><SpinnerIcon /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
            ) : (
              mode === 'login' ? '→ Sign In' : '✓ Create Account'
            )}
          </button>
        </div>

        {/* Therapist link */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8892a4' }}>
          Are you a clinician?{' '}
          <a href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            Therapist Portal →
          </a>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', onEnter }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; onEnter?: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          color: '#f0f4ff', fontSize: 14, padding: '12px 14px',
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
