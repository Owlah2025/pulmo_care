import { useNavigate, useOutletContext } from 'react-router-dom';
import { Wind, Activity, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiService, type GameState, type DailyVital, type RiskPrediction } from '../../services/api';

interface PatientContext {
  patientId: string;
  patientName: string;
}

const TREE_STATES: Record<string, { emoji: string; label: string; tagline: string; color: string }> = {
  lush:     { emoji: '🌳', label: 'Lush & Blooming',   tagline: '7/7 sessions — keep it up!',    color: '#10b981' },
  healthy:  { emoji: '🌲', label: 'Healthy',           tagline: 'Great consistency this week.',   color: '#34d399' },
  wilting:  { emoji: '🌿', label: 'Wilting',           tagline: 'Your tree needs more sessions.', color: '#f59e0b' },
  stressed: { emoji: '🍂', label: 'Stressed',          tagline: 'Come back — it still has time.', color: '#f97316' },
  dormant:  { emoji: '🪨', label: 'Dormant',           tagline: 'Your tree missed you today.',    color: '#6b7280' },
};

export default function PatientHome() {
  const navigate = useNavigate();
  const { patientId, patientName } = useOutletContext<PatientContext>();
  const firstName = patientName?.split(' ')[0] ?? 'there';

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [latestVital, setLatestVital] = useState<DailyVital | null>(null);
  const [riskPred, setRiskPred] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const vitalsRes = await apiService.getPatientVitals(patientId, 1);
        const allVitals = vitalsRes.data;
        setLatestVital(allVitals[allVitals.length - 1] ?? null);

        // Count sessions in last 7 days to determine tree state
        const sessRes = await apiService.getPatientSessions(patientId);
        const now = Date.now();
        const sessionsLast7Days = sessRes.data.filter(
          s => now - new Date(s.started_at).getTime() < 7 * 24 * 3600 * 1000
        ).length;

        const gameRes = await apiService.getGameState(patientId, sessionsLast7Days);
        setGameState(gameRes.data);

        // Real risk prediction
        try {
          const predRes = await apiService.getLatestPrediction(patientId);
          setRiskPred(predRes.data);
        } catch { /* no prediction yet */ }
      } catch (e) {
        console.error('PatientHome load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const treeStateKey = gameState?.tree_state ?? 'dormant';
  const tree = TREE_STATES[treeStateKey] ?? TREE_STATES.dormant;
  const streak = gameState?.current_streak_days ?? 0;
  const badge = streak >= 90 ? '🥇' : streak >= 30 ? '🥈' : streak >= 7 ? '🥉' : null;

  // Approximate sessions this week from tree state
  const sessThisWeek = treeStateKey === 'lush' ? 7 : treeStateKey === 'healthy' ? 5 : treeStateKey === 'wilting' ? 3 : treeStateKey === 'stressed' ? 1 : 0;

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName} 👋
        </div>
        <div style={{ fontSize: 13, color: '#8892a4', marginTop: 4 }}>
          You have a session scheduled today
        </div>
      </div>

      {/* Respiratory Tree */}
      <div className="tree-card">
        <span className="tree-emoji">{tree.emoji}</span>
        <div className="tree-label" style={{ color: tree.color }}>{tree.label}</div>
        <div className="tree-tagline">{tree.tagline}</div>

        {/* Weekly progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={d} style={{ textAlign: 'center' }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: i < sessThisWeek ? tree.color : 'rgba(255,255,255,0.1)',
                margin: '0 auto 3px',
                boxShadow: i < sessThisWeek ? `0 0 6px ${tree.color}` : 'none',
              }} />
              <div style={{ fontSize: 8, color: '#4a5568' }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak + Badge */}
      <div className="streak-row">
        <div className="streak-badge">
          <div className="streak-icon">🔥</div>
          <div className="streak-value">{loading ? '—' : streak}</div>
          <div className="streak-label">Day Streak</div>
        </div>
        {badge && (
          <div className="streak-badge">
            <div className="streak-icon">{badge}</div>
            <div className="streak-value" style={{ fontSize: 18 }}>
              {streak >= 90 ? 'Gold' : streak >= 30 ? 'Silver' : 'Bronze'}
            </div>
            <div className="streak-label">Badge Level</div>
          </div>
        )}
        <div className="streak-badge">
          <div className="streak-icon">⚡</div>
          <div className="streak-value">{loading ? '—' : (gameState?.total_xp ?? 0).toLocaleString()}</div>
          <div className="streak-label">Total XP</div>
        </div>
      </div>

      {/* CTA */}
      <button className="start-session-btn" onClick={() => navigate('/patient/session')}>
        <Wind size={20} />
        Start Breathing Session
      </button>

      {/* Risk status */}
      <div style={{
        background: riskPred?.risk_level === 'Critical' ? 'rgba(239,68,68,0.08)'
          : riskPred?.risk_level === 'High'     ? 'rgba(249,115,22,0.08)'
          : riskPred?.risk_level === 'Moderate' ? 'rgba(245,158,11,0.08)'
          : 'rgba(59,130,246,0.08)',
        border: `1px solid ${riskPred?.risk_level === 'Critical' ? 'rgba(239,68,68,0.2)'
          : riskPred?.risk_level === 'High'     ? 'rgba(249,115,22,0.2)'
          : riskPred?.risk_level === 'Moderate' ? 'rgba(245,158,11,0.2)'
          : 'rgba(59,130,246,0.2)'}`,
        borderRadius: 14, padding: 14,
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
      }}>
        <div style={{ fontSize: 28 }}>
          {riskPred?.risk_level === 'Critical' ? '🚨'
            : riskPred?.risk_level === 'High'     ? '⚠️'
            : riskPred?.risk_level === 'Moderate' ? '🟡' : '🛡️'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Today's Risk Score</div>
          <div style={{ fontSize: 12, color: '#8892a4', marginTop: 2 }}>
            {riskPred ? (
              <>
                <span style={{
                  color: riskPred.risk_level === 'Critical' ? '#ef4444'
                    : riskPred.risk_level === 'High'     ? '#f97316'
                    : riskPred.risk_level === 'Moderate' ? '#f59e0b' : '#3b82f6',
                  fontWeight: 700,
                }}>
                  {riskPred.risk_level} ({Math.round((riskPred.risk_score ?? 0) * 100)}%)
                </span>
                {' — '}
                {riskPred.risk_level === 'Critical' ? 'Contact your care team immediately.'
                  : riskPred.risk_level === 'High'   ? 'Please contact your therapist today.'
                  : riskPred.risk_level === 'Moderate'? 'Rest more today; ensure medication adherence.'
                  : 'Your vitals look stable. Keep up the good work!'}
              </>
            ) : 'No prediction yet — complete a session to generate your score.'}
          </div>
        </div>
      </div>

      {/* Quick vitals */}
      <div className="section-title">Latest Vitals</div>
      <div className="vitals-quick-grid">
        <div className="vital-quick-card">
          <div className="vq-label">SpO₂</div>
          <div className="vq-value" style={{ color: latestVital?.spo2_resting != null && latestVital.spo2_resting < 92 ? '#ef4444' : '#10b981' }}>
            {latestVital?.spo2_resting ?? '—'}
          </div>
          <div className="vq-unit">%  resting</div>
        </div>
        <div className="vital-quick-card">
          <div className="vq-label">Heart Rate</div>
          <div className="vq-value" style={{ color: '#3b82f6' }}>
            {latestVital?.hr_resting ?? '—'}
          </div>
          <div className="vq-unit">bpm resting</div>
        </div>
        <div className="vital-quick-card">
          <div className="vq-label">Dyspnea</div>
          <div className="vq-value" style={{ color: latestVital?.dyspnea_borg != null && latestVital.dyspnea_borg >= 7 ? '#ef4444' : '#f59e0b' }}>
            {latestVital?.dyspnea_borg ?? '—'}
          </div>
          <div className="vq-unit">/ 10 Borg</div>
        </div>
        <div className="vital-quick-card">
          <div className="vq-label">Fatigue</div>
          <div className="vq-value" style={{ color: '#8b5cf6' }}>
            {latestVital?.fatigue_level ?? '—'}
          </div>
          <div className="vq-unit">/ 5 level</div>
        </div>
      </div>

      {/* Log CTA */}
      <button
        onClick={() => navigate('/patient/vitals')}
        style={{
          width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.08)', color: '#10b981', font: '600 14px Inter',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} /> Log Today's Vitals
        </span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
