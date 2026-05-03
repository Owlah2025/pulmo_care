import { useState } from 'react';
import { Bell, CheckCheck, WifiOff } from 'lucide-react';
import { useAlerts, type AlertEvent } from '../hooks/useAlerts';

const MOCK_ALERTS: AlertEvent[] = [
  { id: '1', type: 'spo2_critical', patient_id: '1', patient_name: 'Ahmed Hassan',
    message: 'Session auto-terminated. SpO₂ dropped to 87% — below the 88% safety threshold.',
    timestamp: new Date(Date.now() - 4 * 60000).toISOString(), acknowledged: false },
  { id: '2', type: 'risk_critical', patient_id: '1', patient_name: 'Ahmed Hassan',
    message: 'Nightly risk model scored this patient Critical (82%). Elevated dyspnea and declining SpO₂ trend.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), acknowledged: false },
  { id: '3', type: 'risk_high', patient_id: '5', patient_name: 'Omar Farouk',
    message: 'Risk score elevated to High (72%). Productive cough + fatigue reported over last 3 days.',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), acknowledged: true },
];

const ALERT_ICONS: Record<AlertEvent['type'], { emoji: string; bg: string }> = {
  spo2_critical: { emoji: '🩸', bg: 'rgba(239,68,68,0.15)' },
  risk_critical:  { emoji: '🚨', bg: 'rgba(239,68,68,0.15)' },
  risk_high:      { emoji: '⚠️', bg: 'rgba(249,115,22,0.12)' },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AlertCenter({ clinicianId }: { clinicianId: string }) {
  const { alerts: wsAlerts, connected, acknowledge } = useAlerts(clinicianId);
  const [mockAlerts, setMockAlerts] = useState<AlertEvent[]>(MOCK_ALERTS);

  const allAlerts = [...wsAlerts, ...mockAlerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const pendingCount = allAlerts.filter(a => !a.acknowledged).length;

  const ackAlert = (id: string) => {
    acknowledge(id);
    setMockAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };
  const ackAll = () => setMockAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Alert Center</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {pendingCount} unacknowledged alert{pendingCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ws-status">
            {connected
              ? <><div className="live-dot" /> Live</>
              : <><WifiOff size={12} style={{ color: 'var(--text-muted)' }} /> Demo mode</>}
          </div>
          {pendingCount > 0 && (
            <button className="btn btn-ghost" onClick={ackAll} style={{ fontSize: 12 }}>
              <CheckCheck size={14} /> Acknowledge all
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Bell size={13} style={{ display: 'inline', marginRight: 6 }} />Incoming Alerts</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Most recent first</span>
        </div>

        {allAlerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            No active alerts. All patients stable.
          </div>
        )}

        {allAlerts.map(alert => {
          const cfg = ALERT_ICONS[alert.type];
          return (
            <div key={alert.id} className={`alert-item ${alert.acknowledged ? 'ack' : ''}`}>
              <div className="alert-icon" style={{ background: cfg.bg }}>{cfg.emoji}</div>
              <div className="alert-body">
                <div className="alert-title">{alert.patient_name}</div>
                <div className="alert-meta">{alert.message}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className="alert-time">{timeAgo(alert.timestamp)}</span>
                {!alert.acknowledged
                  ? <button className="ack-btn" onClick={() => ackAlert(alert.id)}>Acknowledge</button>
                  : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>✓ Ack'd</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
