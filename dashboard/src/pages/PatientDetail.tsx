import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Wind, Heart, TrendingDown, FileText, Upload, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import RiskBadge from '../components/RiskBadge';
import { apiService, type Patient, type RiskPrediction, type DailyVital, type PFTResult, type BreathingSession, type RehabPlan } from '../services/api';

const TOOLTIP_STYLE = {
  background: '#161c2d',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#f0f4ff',
  fontSize: 12,
};

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${age} yrs`;
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [vitals, setVitals] = useState<DailyVital[]>([]);
  const [pft, setPft] = useState<PFTResult[]>([]);
  const [sessions, setSessions] = useState<BreathingSession[]>([]);
  const [rehabPlan, setRehabPlan] = useState<RehabPlan | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    try {
      const [patRes, vitRes, pftRes, sessRes] = await Promise.all([
        apiService.getPatient(id),
        apiService.getPatientVitals(id, 14),
        apiService.getPatientPFT(id),
        apiService.getPatientSessions(id),
      ]);
      setPatient(patRes.data);
      setVitals(vitRes.data);
      setPft(pftRes.data);
      setSessions(sessRes.data);

      try {
        const planRes = await apiService.getRehabPlan(id);
        setRehabPlan(planRes.data);
      } catch { /* no plan yet */ }

      try {
        const predRes = await apiService.getLatestPrediction(id);
        setPrediction(predRes.data);
      } catch { /* no prediction yet */ }
    } catch (e) {
      console.error('Failed to load patient detail', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const res = await apiService.uploadReport(id, file);
      setRehabPlan(res.data);
      alert('Report processed successfully! Personalized plan generated.');
      loadData(); // Refresh everything
    } catch (err) {
      alert('Failed to process report. Please ensure it is a clear image or PDF.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading patient data…
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
        <div style={{ color: 'var(--text-secondary)' }}>Patient not found.</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          ← Back to list
        </button>
      </div>
    );
  }

  // Build chart-ready vitals data
  const vitalsChart = vitals.map(v => ({
    date: new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    spo2: v.spo2_resting,
    hr: v.hr_resting,
    dyspnea: v.dyspnea_borg,
  }));

  // PFT chart
  const pftChart = pft.map(p => ({
    date: new Date(p.test_date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' }),
    fev1: p.fev1_pct_predicted,
    fvc: p.fvc_pct_predicted,
    dlco: p.dlco_pct_predicted,
  }));

  // Session adherence (last 7 days)
  const sessionsChart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayKey = d.toISOString().slice(0, 10);
    const sessForDay = sessions.filter(s => s.started_at?.slice(0, 10) === dayKey);
    const completed = sessForDay.length > 0;
    return {
      date: dayStr,
      good_pct: completed ? sessForDay[0].good_breath_pct ?? 0 : 0,
      completed,
    };
  });

  const latestVital = vitals[vitals.length - 1];
  const latestPft = pft[pft.length - 1];
  const sessionsThisWeek = sessions.filter(s => {
    const d = new Date(s.started_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 3600 * 1000;
  }).length;

  const initials = patient.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: '7px 12px' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}>{initials}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{patient.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {patient.diagnosis} · DOB {patient.date_of_birth} ({calcAge(patient.date_of_birth)})
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer', gap: 8 }}>
            <Upload size={14} />
            {uploading ? 'Processing...' : 'Upload PFT/6MWT'}
            <input type="file" hidden onChange={handleFileUpload} accept=".pdf,image/*" disabled={uploading} />
          </label>
          {prediction && <RiskBadge level={prediction.risk_level} score={prediction.risk_score} showScore />}
        </div>
      </div>

      {/* Rehab Plan Banner */}
      {rehabPlan && (
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <FileText color="#3b82f6" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Personalized Rehabilitation Plan</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Generated from clinical reports · {rehabPlan.intensity_level} Intensity</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Daily Target</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{rehabPlan.session_frequency_daily} session(s) / day</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Session Length</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{rehabPlan.session_duration_minutes} minutes</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Focus Area</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{rehabPlan.recommended_exercises.join(', ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          {
            label: 'Latest SpO₂', icon: Activity,
            value: latestVital?.spo2_resting != null ? `${latestVital.spo2_resting}%` : '—',
            color: latestVital?.spo2_resting != null && latestVital.spo2_resting < 88 ? 'var(--risk-critical)' : 'var(--accent)',
          },
          {
            label: 'Heart Rate', icon: Heart,
            value: latestVital?.hr_resting != null ? `${latestVital.hr_resting} bpm` : '—',
            color: 'var(--accent)',
          },
          {
            label: 'Dyspnea (Borg)', icon: Wind,
            value: latestVital?.dyspnea_borg != null ? `${latestVital.dyspnea_borg}/10` : '—',
            color: latestVital?.dyspnea_borg != null && latestVital.dyspnea_borg >= 7 ? 'var(--risk-critical)' : 'var(--risk-high)',
          },
          {
            label: 'FEV₁ % pred.', icon: TrendingDown,
            value: latestPft?.fev1_pct_predicted != null ? `${latestPft.fev1_pct_predicted}%` : '—',
            color: 'var(--risk-moderate)',
          },
          {
            label: 'Wellbeing Index', icon: Heart,
            value: 'Stable', // Derived from sentiment trends in a real app
            color: '#10b981',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">{label}</div>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="stat-value" style={{ color, fontSize: 24 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* SpO₂ & HR Trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">SpO₂ & Heart Rate — 14 Days</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={vitalsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis domain={[80, 105]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={88} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Threshold', fill: '#ef4444', fontSize: 10 }} />
              <Line type="monotone" dataKey="spo2" stroke="#3b82f6" strokeWidth={2} dot={false} name="SpO₂ %" />
              <Line type="monotone" dataKey="hr" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="HR bpm" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* PFT Trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">PFT Trend · FEV₁ % predicted</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={pftChart}>
              <defs>
                <linearGradient id="fev1Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis domain={[30, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="fev1" stroke="#3b82f6" fill="url(#fev1Grad)" strokeWidth={2} name="FEV₁ %" />
              <Line type="monotone" dataKey="fvc" stroke="#10b981" strokeWidth={1.5} dot={false} name="FVC %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dyspnea */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Dyspnea Score (Modified Borg)</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={vitalsChart}>
              <defs>
                <linearGradient id="dyspGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="dyspnea" stroke="#f97316" fill="url(#dyspGrad)" strokeWidth={2} name="Borg Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Session Adherence */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Exercise Adherence — Last 7 Days</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sessionsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Good Breath %']} />
              <Bar dataKey="good_pct" name="Good Breath %" radius={[4, 4, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            {sessionsThisWeek}/7 sessions completed this week
          </div>
        </div>
      </div>
    </div>
  );
}
