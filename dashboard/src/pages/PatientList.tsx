import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, LogIn } from 'lucide-react';
import { apiService, type Patient, type RiskPrediction } from '../services/api';
import RiskBadge from '../components/RiskBadge';

interface PatientRow extends Patient {
  prediction?: RiskPrediction;
  latest_spo2?: number;
}

const RISK_ORDER: Record<string, number> = { Critical: 0, High: 1, Moderate: 2, Low: 3 };

interface Props { onAlertCountChange?: (n: number) => void; }

function LoginModal({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('demo@pulmoclinic.com');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.login(email, password);
      onLogin();
    } catch {
      setError('Invalid email or password. Try: demo@pulmoclinic.com / demo1234');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 36, width: 380, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ fontSize: 32 }}>🫁</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>PULMO CARE</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Clinician Portal Login</div>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email</label>
          <input
            className="input" style={{ width: '100%', boxSizing: 'border-box' }}
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
          <input
            className="input" style={{ width: '100%', boxSizing: 'border-box' }}
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <div style={{ color: 'var(--risk-high)', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button
          className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          onClick={handleLogin} disabled={loading}
        >
          {loading ? 'Signing in…' : <><LogIn size={15} /> Sign In</>}
        </button>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Demo credentials pre-filled above
        </div>
      </div>
    </div>
  );
}

export default function PatientList({ onAlertCountChange }: Props) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [unassigned, setUnassigned] = useState<Patient[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));

  const loadData = async () => {
    if (!localStorage.getItem('access_token')) {
      setShowLogin(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [patientsRes, unassignedRes] = await Promise.all([
        apiService.getPatients(),
        apiService.getUnassignedPatients().catch(() => ({ data: [] })),
      ]);
      const rows: PatientRow[] = patientsRes.data;
      setUnassigned(unassignedRes.data);

      // Fetch latest predictions for each patient
      const withPredictions = await Promise.all(
        rows.map(async (p) => {
          try {
            const pred = await apiService.getLatestPrediction(p.id);
            // Get latest vitals for SpO2
            const vitals = await apiService.getPatientVitals(p.id, 1);
            const latestVital = vitals.data[vitals.data.length - 1];
            return {
              ...p,
              prediction: pred.data,
              latest_spo2: latestVital?.spo2_resting ?? undefined,
            };
          } catch {
            return p;
          }
        })
      );
      setPatients(withPredictions);
      // bubble up critical count
      const crit = withPredictions.filter(p => p.prediction?.risk_level === 'Critical').length;
      onAlertCountChange?.(crit);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setShowLogin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [isLoggedIn]);

  const sorted = [...patients]
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const ra = RISK_ORDER[a.prediction?.risk_level ?? 'Low'];
      const rb = RISK_ORDER[b.prediction?.risk_level ?? 'Low'];
      return ra - rb;
    });

  const critCount = patients.filter(p => p.prediction?.risk_level === 'Critical').length;
  const highCount = patients.filter(p => p.prediction?.risk_level === 'High').length;
  const avgSpo2 = patients.length > 0
    ? Math.round(patients.reduce((s, p) => s + (p.latest_spo2 ?? 95), 0) / patients.length)
    : 0;

  const spo2Color = (v?: number | null) => {
    if (!v) return 'var(--text-muted)';
    if (v < 88) return 'var(--risk-critical)';
    if (v < 92) return 'var(--risk-high)';
    if (v < 95) return 'var(--risk-moderate)';
    return 'var(--risk-low)';
  };

  const spo2BarColor = (v?: number | null) => {
    if (!v) return 'var(--text-muted)';
    if (v < 88) return '#ef4444';
    if (v < 92) return '#f97316';
    if (v < 95) return '#f59e0b';
    return '#10b981';
  };

  const claimPatient = async (patientId: string) => {
    setClaiming(patientId);
    try {
      await apiService.assignPatient(patientId);
      setUnassigned(prev => prev.filter(p => p.id !== patientId));
      loadData(); // Refresh main list
    } catch {
      alert('Failed to assign patient. They may already be assigned.');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div>
      {showLogin && (
        <LoginModal onLogin={() => {
          setShowLogin(false);
          setIsLoggedIn(true);
        }} />
      )}

      {/* Unassigned patients banner */}
      {unassigned.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#f59e0b' }}>
              {unassigned.length} patient{unassigned.length > 1 ? 's' : ''} registered &amp; awaiting assignment
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unassigned.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.diagnosis ?? 'No diagnosis'} · Registered via patient portal
                  </div>
                </div>
                <button
                  onClick={() => claimPatient(p.id)}
                  disabled={claiming === p.id}
                  style={{
                    padding: '7px 16px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                    color: 'white', fontSize: 12, fontWeight: 600,
                    cursor: claiming === p.id ? 'not-allowed' : 'pointer',
                    opacity: claiming === p.id ? 0.6 : 1, fontFamily: 'inherit',
                  }}
                >
                  {claiming === p.id ? 'Assigning…' : '+ Add to my patients'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Patients</div>
          <div className="stat-value">{loading ? '—' : patients.length}</div>
          <div className="stat-delta">↑ Active this week</div>
        </div>
        <div className="stat-card" style={{ borderColor: critCount > 0 ? 'rgba(239,68,68,0.3)' : undefined }}>
          <div className="stat-label">Critical Risk</div>
          <div className="stat-value" style={{ color: critCount > 0 ? 'var(--risk-critical)' : undefined }}>{loading ? '—' : critCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Requires immediate attention</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High Risk</div>
          <div className="stat-value" style={{ color: highCount > 0 ? 'var(--risk-high)' : undefined }}>{loading ? '—' : highCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Contact care team</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg SpO₂</div>
          <div className="stat-value" style={{ color: spo2Color(avgSpo2) }}>{loading ? '—' : `${avgSpo2}%`}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cohort average (resting)</div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Patient Triage</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Sorted by risk level · Live data</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 32, width: 220 }}
                placeholder="Search patients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost" onClick={loadData} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            Loading patient data…
          </div>
        ) : (
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Risk Level</th>
                <th>Risk Score</th>
                <th>SpO₂ (resting)</th>
                <th>Last Scored</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="patient-name">{p.name}</div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{p.diagnosis ?? '—'}</td>
                  <td><RiskBadge level={p.prediction?.risk_level ?? 'Low'} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(p.prediction?.risk_score ?? 0) * 100}%`,
                          height: '100%', borderRadius: 2,
                          background: spo2BarColor(100 - (p.prediction?.risk_score ?? 0) * 100 + 88)
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {((p.prediction?.risk_score ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="spo2-bar-wrap">
                      <span style={{ fontSize: 13, fontWeight: 600, color: spo2Color(p.latest_spo2), minWidth: 38 }}>
                        {p.latest_spo2 != null ? `${p.latest_spo2}%` : '—'}
                      </span>
                      <div className="spo2-bar">
                        <div className="spo2-bar-fill" style={{
                          width: `${((p.latest_spo2 ?? 0) - 85) / 15 * 100}%`,
                          background: spo2BarColor(p.latest_spo2)
                        }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.prediction ? new Date(p.prediction.predicted_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
