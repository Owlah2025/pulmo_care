import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import AlertCenter from './pages/AlertCenter';
import PatientShell from './pages/patient/PatientShell';
import PatientHome from './pages/patient/PatientHome';
import BreathingSession from './pages/patient/BreathingSession';
import DailyVitals from './pages/patient/DailyVitals';
import PFTHistory from './pages/patient/PFTHistory';
import Chatbot from './pages/patient/Chatbot';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { apiService } from './services/api';
import './index.css';

// Decode JWT payload without a library
function parseJwt(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

function ClinicianPortal() {
  const [clinicianId, setClinicianId]   = useState('demo-clinician');
  const [clinicianName, setClinicianName] = useState('Dr. Clinician');
  const [pendingAlerts, setPendingAlerts] = useState(0);

  useEffect(() => {
    // Extract real clinician ID from stored JWT
    const token = localStorage.getItem('access_token');
    if (token) {
      const payload = parseJwt(token);
      if (payload?.sub) setClinicianId(payload.sub);
      if (payload?.name) setClinicianName(payload.name);
    }
    // Fetch clinician info from /me endpoint
    apiService.getMe().then(r => {
      if (r.data?.id) setClinicianId(r.data.id);
      if (r.data?.name) setClinicianName(r.data.name);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    apiService.logout();
    window.location.reload();
  };

  return (
    <div className="layout">
      <Sidebar alertCount={pendingAlerts} />
      <div className="main-content">
        <header className="page-header">
          <div>
            <div className="page-title">PULMO CARE — Clinician Portal</div>
            <div className="page-subtitle">Pulmonary Rehabilitation Management System</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ws-status">
              <div className="live-dot" />
              <span style={{ fontSize: 12 }}>System Online</span>
            </div>
            {/* Clinician avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '6px 12px' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white' }}>
                {clinicianName.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4ff' }}>{clinicianName}</div>
                <div style={{ fontSize: 10, color: '#8892a4' }}>Therapist</div>
              </div>
            </div>
            <Link to="/patient" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8892a4', fontSize: 12, fontWeight: 500,
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              👤 Patient View
            </Link>
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ⏏ Logout
            </button>
          </div>
        </header>
        <main className="page-body">
          <Routes>
            <Route path="/"                element={<PatientList onAlertCountChange={setPendingAlerts} />} />
            <Route path="/patients/:id"    element={<PatientDetail />} />
            <Route path="/alerts"          element={<AlertCenter clinicianId={clinicianId} />} />
            <Route path="/reports"         element={<Reports />} />
            <Route path="/settings"        element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Patient Portal ─────────────────────────────────── */}
        <Route path="/patient" element={<PatientShell />}>
          <Route index          element={<PatientHome />} />
          <Route path="session" element={<BreathingSession />} />
          <Route path="vitals"  element={<DailyVitals />} />
          <Route path="pft"     element={<PFTHistory />} />
          <Route path="chat"    element={<Chatbot />} />
        </Route>

        {/* ── Clinician Portal ────────────────────────────────── */}
        <Route path="/*" element={<ClinicianPortal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
