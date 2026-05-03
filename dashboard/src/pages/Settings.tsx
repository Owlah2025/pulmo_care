import { useState } from 'react';
import { Save, CheckCircle, AlertTriangle, User, Bell, Shield, Database } from 'lucide-react';

type Tab = 'profile' | 'notifications' | 'privacy' | 'system';

const TAB_CONFIG: { id: Tab; icon: typeof User; label: string }[] = [
  { id: 'profile',       icon: User,          label: 'Profile' },
  { id: 'notifications', icon: Bell,          label: 'Notifications' },
  { id: 'privacy',       icon: Shield,        label: 'Privacy & GDPR' },
  { id: 'system',        icon: Database,      label: 'System' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ marginLeft: 20 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: value ? 'var(--accent)' : 'var(--bg-surface)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        background: 'white', position: 'absolute',
        top: 2, left: value ? 20 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile');
  const [saved, setSaved] = useState(false);

  // Profile
  const [name, setName] = useState('Dr. Ahmed Rashid');
  const [email, setEmail] = useState('a.rashid@pulmocare.eg');
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  // Notifications
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertHigh, setAlertHigh] = useState(true);
  const [alertModerate, setAlertModerate] = useState(false);
  const [emailSummary, setEmailSummary] = useState(true);
  const [smsEscalation, setSmsEscalation] = useState(true);

  // Privacy
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [researchConsent, setResearchConsent] = useState(false);

  // System
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [wsUrl, setWsUrl] = useState('ws://localhost:8000');
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Settings</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Clinician Portal Configuration</div>
        </div>
        <button className="btn btn-primary" onClick={save}>
          {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar tabs */}
        <div style={{ width: 180, flexShrink: 0 }}>
          {TAB_CONFIG.map(({ id, icon: Icon, label }) => (
            <div
              key={id}
              onClick={() => setTab(id)}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              style={{ marginBottom: 4 }}
            >
              <Icon size={15} /> {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {tab === 'profile' && (
            <SectionCard title="Clinician Profile">
              <SettingRow label="Full Name">
                <input className="input" style={{ width: 240 }} value={name} onChange={e => setName(e.target.value)} />
              </SettingRow>
              <SettingRow label="Email Address">
                <input className="input" style={{ width: 240 }} value={email} onChange={e => setEmail(e.target.value)} />
              </SettingRow>
              <SettingRow label="Role" description="Your role determines what you can access">
                <span style={{ fontSize: 12, background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>Therapist</span>
              </SettingRow>
              <SettingRow label="Interface Language">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['en', 'ar'] as const).map(l => (
                    <button key={l} className={`btn ${lang === l ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '5px 14px', fontSize: 12 }}
                      onClick={() => setLang(l)}>
                      {l === 'en' ? '🇬🇧 EN' : '🇸🇦 AR'}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </SectionCard>
          )}

          {tab === 'notifications' && (
            <>
              <SectionCard title="Alert Thresholds">
                <SettingRow label="Critical Risk Alerts" description="Push + SMS + call escalation">
                  <Toggle value={alertCritical} onChange={setAlertCritical} />
                </SettingRow>
                <SettingRow label="High Risk Alerts" description="Push notification to portal">
                  <Toggle value={alertHigh} onChange={setAlertHigh} />
                </SettingRow>
                <SettingRow label="Moderate Risk Alerts" description="Silent notification only">
                  <Toggle value={alertModerate} onChange={setAlertModerate} />
                </SettingRow>
              </SectionCard>
              <SectionCard title="Report Delivery">
                <SettingRow label="Weekly Email Summary" description="Cohort adherence + risk distribution every Monday">
                  <Toggle value={emailSummary} onChange={setEmailSummary} />
                </SettingRow>
                <SettingRow label="SMS Escalation for Critical" description="Sends SMS if WebSocket is not acknowledged within 10 min">
                  <Toggle value={smsEscalation} onChange={setSmsEscalation} />
                </SettingRow>
              </SectionCard>
            </>
          )}

          {tab === 'privacy' && (
            <>
              <SectionCard title="Data Processing Consent">
                <SettingRow label="Analytics & Quality Improvement" description="Anonymized usage data to improve the platform">
                  <Toggle value={analyticsConsent} onChange={setAnalyticsConsent} />
                </SettingRow>
                <SettingRow label="Research Dataset Contribution" description="De-identified patient data contributed to respiratory research">
                  <Toggle value={researchConsent} onChange={setResearchConsent} />
                </SettingRow>
              </SectionCard>

              <SectionCard title="GDPR Tools">
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                    Under GDPR and HIPAA, patients have the right to access and erase their personal data. Clinical records are anonymized (not deleted) to comply with the 6-year medical record retention requirement.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}>
                      📥 Export My Data
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                      ⚠️ Request Data Erasure
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}>
                      📋 View Audit Log
                    </button>
                  </div>
                </div>
              </SectionCard>

              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 14, fontSize: 12, color: '#f59e0b', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Camera data is processed entirely on-device. No video frames are ever transmitted to the backend. This is enforced at the architecture level.</span>
              </div>
            </>
          )}

          {tab === 'system' && (
            <SectionCard title="API Configuration">
              <SettingRow label="Backend API URL">
                <input className="input" style={{ width: 280 }} value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
              </SettingRow>
              <SettingRow label="WebSocket URL">
                <input className="input" style={{ width: 280 }} value={wsUrl} onChange={e => setWsUrl(e.target.value)} />
              </SettingRow>
              <SettingRow label="Nightly Risk Scoring" description="APScheduler runs at 02:00 UTC">
                <Toggle value={schedulerEnabled} onChange={setSchedulerEnabled} />
              </SettingRow>
              <SettingRow label="API Version">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>v1.0.0</span>
              </SettingRow>
              <SettingRow label="Environment">
                <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '3px 8px', borderRadius: 5, fontWeight: 600 }}>
                  Development
                </span>
              </SettingRow>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
