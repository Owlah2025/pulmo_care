import { NavLink } from 'react-router-dom';
import {
  Users, Bell, BarChart2, Settings, LogOut,
} from 'lucide-react';

const NAV = [
  { to: '/',        icon: Users,     label: 'Patient Triage' },
  { to: '/alerts',  icon: Bell,      label: 'Alert Center' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/settings',icon: Settings,  label: 'Settings' },
];

interface Props {
  alertCount?: number;
}

export default function Sidebar({ alertCount = 0 }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🫁</div>
        <div>
          <div className="logo-text">PULMO CARE</div>
          <div className="logo-sub">Clinician Portal</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section">Navigation</div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="nav-icon" size={16} />
            {label}
            {label === 'Alert Center' && alertCount > 0 && (
              <span style={{
                marginLeft: 'auto',
                background: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">DR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Dr. Clinician</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Therapist</div>
        </div>
        <LogOut size={15} style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }} />
      </div>
    </nav>
  );
}
