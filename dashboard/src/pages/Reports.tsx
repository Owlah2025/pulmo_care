import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend,
} from 'recharts';

const TOOLTIP_STYLE = {
  background: '#161c2d', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#f0f4ff', fontSize: 12,
};

// ── Mock cohort data ─────────────────────────────────────────
const RISK_DIST = [
  { name: 'Critical', value: 1, fill: '#ef4444' },
  { name: 'High',     value: 2, fill: '#f97316' },
  { name: 'Moderate', value: 1, fill: '#f59e0b' },
  { name: 'Low',      value: 1, fill: '#10b981' },
];

const ADHERENCE_TREND = Array.from({ length: 8 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7);
  return {
    week: `W${i + 1}`,
    adherence: 55 + Math.round(Math.sin(i * 0.8) * 12 + i * 2),
    sessions: 18 + Math.round(Math.random() * 12),
  };
});

const WELLBEING_TREND = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    positive: 30 + Math.round(Math.random() * 20),
    neutral: 40 + Math.round(Math.random() * 15),
    negative: 10 + Math.round(Math.random() * 10),
    distressed: Math.round(Math.random() * 5),
  };
});

const SPO2_COHORT = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    avg: 91 + Math.round(Math.sin(i * 0.4) * 3),
    min: 86 + Math.round(Math.sin(i * 0.5) * 2),
  };
});

const TOP_PATIENTS = [
  { name: 'Ahmed Hassan',     sessions: 6, goodPct: 78, streak: 14, badge: '🥉' },
  { name: 'Sara Khalil',      sessions: 7, goodPct: 91, streak: 22, badge: '🥈' },
  { name: 'Mohamed Ibrahim',  sessions: 5, goodPct: 69, streak: 8,  badge: '🥉' },
  { name: 'Fatima Al-Rashid', sessions: 4, goodPct: 62, streak: 4,  badge: '' },
  { name: 'Omar Farouk',      sessions: 3, goodPct: 55, streak: 3,  badge: '' },
];

export default function Reports() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Cohort Reports</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Aggregated, de-identified patient analytics
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['7d', '30d', '90d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`btn ${range === r ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Avg Adherence',  value: '71%',   delta: '↑ 8% vs last period', color: 'var(--green)' },
          { label: 'Total Sessions', value: '142',   delta: '↑ 23 vs last period', color: 'var(--accent)' },
          { label: 'Avg SpO₂',       value: '91.4%', delta: '−0.3% vs last period', color: 'var(--yellow)' },
          { label: 'Wellbeing Index',value: '0.62',  delta: '↑ 0.04 vs last period', color: 'var(--green)' },
        ].map(({ label, value, delta, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color, fontSize: 26 }}>{value}</div>
            <div className="stat-delta" style={{ color: delta.startsWith('↑') ? 'var(--green)' : 'var(--yellow)' }}>
              {delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Adherence trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Weekly Adherence Trend (%)</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ADHERENCE_TREND}>
              <defs>
                <linearGradient id="adhGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Adherence']} />
              <Area type="monotone" dataKey="adherence" stroke="#3b82f6" fill="url(#adhGrad)" strokeWidth={2} name="Adherence %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Current Risk Distribution</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={RISK_DIST} startAngle={180} endAngle={-180}>
              <RadialBar dataKey="value" cornerRadius={4} label={{ position: 'insideStart', fill: '#f0f4ff', fontSize: 10 }} />
              <Legend iconSize={10} iconType="circle" formatter={(v) => <span style={{ color: '#8892a4', fontSize: 11 }}>{v}</span>} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Cohort SpO2 */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Cohort SpO₂ — Avg & Min (14 days)</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={SPO2_COHORT}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis domain={[83, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={2} dot={false} name="Avg SpO₂" />
              <Line type="monotone" dataKey="min" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Min SpO₂" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Patient Wellbeing Index */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Patient Wellbeing Index (Chatbot Sentiment)</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={WELLBEING_TREND.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="positive"   stackId="a" fill="#10b981" name="Positive" radius={[0,0,0,0]} />
              <Bar dataKey="neutral"    stackId="a" fill="#3b82f6" name="Neutral"  />
              <Bar dataKey="negative"   stackId="a" fill="#f97316" name="Negative" />
              <Bar dataKey="distressed" stackId="a" fill="#ef4444" name="Distressed" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Adherence Leaderboard */}
      <div className="card mt-6">
        <div className="card-header">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Adherence Leaderboard — This Week</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anonymized internally</span>
        </div>
        <table className="patient-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Patient</th>
              <th>Sessions (7d)</th>
              <th>Good Breath %</th>
              <th>Streak</th>
              <th>Badge</th>
            </tr>
          </thead>
          <tbody>
            {TOP_PATIENTS.map((p, i) => (
              <tr key={p.name}>
                <td style={{ color: i === 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                      {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="patient-name">{p.name}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 50, height: 4, borderRadius: 2, background: 'var(--bg-base)' }}>
                      <div style={{ width: `${(p.sessions / 7) * 100}%`, height: '100%', borderRadius: 2, background: '#3b82f6' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.sessions}/7</span>
                  </div>
                </td>
                <td style={{ color: p.goodPct >= 75 ? '#10b981' : p.goodPct >= 60 ? '#f59e0b' : '#f97316', fontWeight: 600 }}>
                  {p.goodPct}%
                </td>
                <td style={{ fontSize: 13 }}>🔥 {p.streak}d</td>
                <td style={{ fontSize: 18 }}>{p.badge || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
