import { useNavigate, useOutletContext } from 'react-router-dom';
import { Wind, Activity, ChevronRight, Upload, FileText, Clock, Heart, TrendingDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { apiService, type GameState, type DailyVital, type RiskPrediction, type BreathingSession, type RehabPlan, type PFTResult } from '../../services/api';

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

const CHART_TOOLTIP = {
  background: '#161c2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f0f4ff', fontSize: 12,
};

export default function PatientHome() {
  const navigate = useNavigate();
  const { patientId, patientName } = useOutletContext<PatientContext>();
  const firstName = patientName?.split(' ')[0] ?? 'there';

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [vitals, setVitals] = useState<DailyVital[]>([]);
  const [pft, setPft] = useState<PFTResult[]>([]);
  const [sessions, setSessions] = useState<BreathingSession[]>([]);
  const [riskPred, setRiskPred] = useState<RiskPrediction | null>(null);
  const [rehabPlan, setRehabPlan] = useState<RehabPlan | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [vitRes, pftRes, sessRes] = await Promise.all([
        apiService.getPatientVitals(patientId, 14),
        apiService.getPatientPFT(patientId),
        apiService.getPatientSessions(patientId)
      ]);

      setVitals(vitRes.data);
      setPft(pftRes.data);
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

  // Chart data preparation
  const vitalsChart = vitals.map(v => ({
    date: new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spo2: v.spo2_resting,
    dyspnea: v.dyspnea_borg,
  }));

  const pftChart = pft.map(p => ({
    date: new Date(p.test_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    fev1: p.fev1_pct_predicted,
  }));

  const sessionsChart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayKey = d.toISOString().slice(0, 10);
    const sessForDay = sessions.filter(s => s.started_at?.slice(0, 10) === dayKey);
    return { date: dayStr, good_pct: sessForDay.length > 0 ? sessForDay[0].good_breath_pct : 0 };
  });

  const latestVital = vitals[vitals.length - 1];
  const treeStateKey = gameState?.tree_state ?? 'dormant';
  const tree = TREE_STATES[treeStateKey] ?? TREE_STATES.dormant;
  const sessThisWeek = treeStateKey === 'lush' ? 7 : treeStateKey === 'healthy' ? 5 : treeStateKey === 'wilting' ? 3 : treeStateKey === 'stressed' ? 1 : 0;

  return (
    <div style={{ paddingBottom: 40 }}>
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

      {/* Respiratory Tree */}
      <div className="tree-card">
        <span className="tree-emoji">{tree.emoji}</span>
        <div className="tree-label" style={{ color: tree.color }}>{tree.label}</div>
        <div className="tree-tagline">{tree.tagline}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={d} style={{ textAlign: 'center' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < sessThisWeek ? tree.color : 'rgba(255,255,255,0.1)',
                margin: '0 auto 3px', boxShadow: i < sessThisWeek ? `0 0 6px ${tree.color}` : 'none',
              }} />
              <div style={{ fontSize: 8, color: '#4a5568' }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="start-session-btn" onClick={() => navigate('/patient/session')} style={{ marginBottom: 20 }}>
        <Wind size={20} /> Start Breathing Session
      </button>

      {/* TRENDS SECTION (Requested: All graphs in patient portal) */}
      <div className="section-title">Clinical Trends</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {/* Lung Function Trend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 18, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={14} color="#3b82f6" /> FEV₁ Lung Function (%)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={pftChart}>
              <defs>
                <linearGradient id="lungGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[30, 100]} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Area type="monotone" dataKey="fev1" stroke="#3b82f6" fill="url(#lungGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dyspnea Trend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 18, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wind size={14} color="#f97316" /> Shortness of Breath (Borg)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={vitalsChart}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, 10]} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Area type="monotone" dataKey="dyspnea" stroke="#f97316" fill="rgba(249,115,22,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Adherence */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 18, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="#10b981" /> Exercise Adherence (Last 7 Days)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={sessionsChart}>
              <XAxis dataKey="date" tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 100]} />
              <Bar dataKey="good_pct" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session History */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Recent Activity</div>
        <button onClick={() => navigate('/patient/history')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View All</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {sessions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 14, color: '#8892a4', fontSize: 13 }}>No sessions yet.</div>
        ) : (
          sessions.slice(0, 2).map(s => (
            <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}><Clock size={18} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.exercise_type === 'diaphragmatic' ? 'Diaphragmatic' : 'Pursed Lip'}</div>
                  <div style={{ fontSize: 11, color: '#8892a4' }}>{new Date(s.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: (s.good_breath_pct ?? 0) >= 80 ? '#10b981' : '#f59e0b' }}>{Math.round(s.good_breath_pct ?? 0)}%</div>
                <div style={{ fontSize: 10, color: '#8892a4' }}>Accuracy</div>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => navigate('/patient/vitals')}
        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', font: '600 14px Inter', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> Log Today's Vitals</span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
