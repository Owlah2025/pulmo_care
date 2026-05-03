import { useNavigate, useOutletContext } from 'react-router-dom';
import { Wind, Activity, ChevronRight, Upload, FileText, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiService, type GameState, type DailyVital, type RiskPrediction, type BreathingSession, type RehabPlan } from '../../services/api';

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
  const [sessions, setSessions] = useState<BreathingSession[]>([]);
  const [rehabPlan, setRehabPlan] = useState<RehabPlan | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const vitalsRes = await apiService.getPatientVitals(patientId, 1);
      const allVitals = vitalsRes.data;
      setLatestVital(allVitals[allVitals.length - 1] ?? null);

      const sessRes = await apiService.getPatientSessions(patientId);
      setSessions(sessRes.data);
      
      const now = Date.now();
      const sessionsLast7Days = sessRes.data.filter(
        s => now - new Date(s.started_at).getTime() < 7 * 24 * 3600 * 1000
      ).length;

      const gameRes = await apiService.getGameState(patientId, sessionsLast7Days);
      setGameState(gameRes.data);

      try {
        const predRes = await apiService.getLatestPrediction(patientId);
        setRiskPred(predRes.data);
      } catch { /* no prediction yet */ }

      try {
        const planRes = await apiService.getRehabPlan(patientId);
        setRehabPlan(planRes.data);
      } catch { /* no plan yet */ }
    } catch (e) {
      console.error('PatientHome load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [patientId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;

    setUploading(true);
    try {
      await apiService.uploadReport(patientId, file);
      alert('Report uploaded successfully! Your care team will be notified.');
      loadData();
    } catch (err) {
      alert('Failed to upload report. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const treeStateKey = gameState?.tree_state ?? 'dormant';
  const tree = TREE_STATES[treeStateKey] ?? TREE_STATES.dormant;
  const streak = gameState?.current_streak_days ?? 0;
  const badge = streak >= 90 ? '🥇' : streak >= 30 ? '🥈' : streak >= 7 ? '🥉' : null;

  const sessThisWeek = treeStateKey === 'lush' ? 7 : treeStateKey === 'healthy' ? 5 : treeStateKey === 'wilting' ? 3 : treeStateKey === 'stressed' ? 1 : 0;

  return (
    <div>
      {/* Greeting + Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName} 👋
          </div>
          <div style={{ fontSize: 13, color: '#8892a4', marginTop: 4 }}>
            You have a session scheduled today
          </div>
        </div>
        <label style={{ 
          background: 'rgba(59,130,246,0.1)', color: '#3b82f6', 
          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid rgba(59,130,246,0.2)'
        }}>
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload PFT'}
          <input type="file" hidden onChange={handleFileUpload} accept=".pdf,image/*" disabled={uploading} />
        </label>
      </div>

      {/* Rehab Plan Banner */}
      {rehabPlan && (
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))', 
          border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: 16, marginBottom: 20 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <FileText color="#3b82f6" size={18} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Your Personalized Plan</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase' }}>Frequency</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rehabPlan.session_frequency_daily}x daily</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase' }}>Intensity</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rehabPlan.intensity_level}</div>
            </div>
          </div>
        </div>
      )}

      {/* Respiratory Tree */}
      <div className="tree-card">
        <span className="tree-emoji">{tree.emoji}</span>
        <div className="tree-label" style={{ color: tree.color }}>{tree.label}</div>
        <div className="tree-tagline">{tree.tagline}</div>

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

      {/* Session History */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Recent Sessions</div>
        <button 
          onClick={() => navigate('/patient/history')}
          style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          View All
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {sessions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 14, color: '#8892a4', fontSize: 13 }}>
            No sessions completed yet.
          </div>
        ) : (
          sessions.slice(0, 3).map(s => (
            <div key={s.id} style={{ 
              background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981'
                }}>
                  <Clock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.exercise_type === 'diaphragmatic' ? 'Diaphragmatic' : 'Pursed Lip'}</div>
                  <div style={{ fontSize: 11, color: '#8892a4' }}>{new Date(s.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: (s.good_breath_pct ?? 0) >= 80 ? '#10b981' : '#f59e0b' }}>
                  {Math.round(s.good_breath_pct ?? 0)}%
                </div>
                <div style={{ fontSize: 10, color: '#8892a4' }}>Accuracy</div>
              </div>
            </div>
          ))
        )}
      </div>

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
