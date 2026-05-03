import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Wind, Activity, MessageCircle, BarChart2, LogOut, Stethoscope } from 'lucide-react';
import PatientAuth from './PatientAuth';
import { apiService } from '../../services/api';
import './patient.css';

const NAV = [
  { to: '/patient',           icon: Home,          label: 'Home',    end: true },
  { to: '/patient/session',   icon: Wind,          label: 'Breathe', end: false },
  { to: '/patient/vitals',    icon: Activity,      label: 'Log',     end: false },
  { to: '/patient/pft',       icon: BarChart2,     label: 'PFT',     end: false },
  { to: '/patient/chat',      icon: MessageCircle, label: 'PULMO',   end: false },
];

export default function PatientShell() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<string | null>(localStorage.getItem('patient_id'));
  const [patientName, setPatientName] = useState<string | null>(localStorage.getItem('patient_name'));

  useEffect(() => {
    // Sync from localStorage on mount
    setPatientId(localStorage.getItem('patient_id'));
    setPatientName(localStorage.getItem('patient_name'));
  }, []);

  const handleAuth = (id: string, name: string) => {
    setPatientId(id);
    setPatientName(name);
  };

  const handleLogout = () => {
    apiService.patientLogout();
    setPatientId(null);
    setPatientName(null);
  };

  // Show auth gate if not logged in
  if (!patientId) {
    return <PatientAuth onAuth={handleAuth} />;
  }

  const initials = patientName
    ? patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'PT';

  return (
    <div className="patient-shell">
      {/* Top bar */}
      <div className="patient-topbar">
        <div className="brand">
          <span>🫁</span> PULMO CARE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Portal toggle */}
          <button
            onClick={() => navigate('/')}
            title="Switch to Therapist Portal"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#8892a4',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <Stethoscope size={13} />
            Therapist
          </button>

          {/* Patient info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="patient-avatar">{initials}</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4ff' }}>{patientName}</div>
              <div style={{ fontSize: 10, color: '#8892a4' }}>Patient</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="patient-body">
        <Outlet context={{ patientId, patientName }} />
      </div>

      {/* Bottom navigation */}
      <div className="patient-bottom-nav">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `patient-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span className="patient-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
