import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, LineChart } from 'recharts';
import { useOutletContext } from 'react-router-dom';
import { apiService, type PFTResult } from '../../services/api';

interface Ctx { patientId: string; patientName: string; }

const TOOLTIP_STYLE = {
  background: '#161c2d',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#f0f4ff',
  fontSize: 12,
};

export default function PFTHistory() {
  const { patientId } = useOutletContext<Ctx>();
  const [pftData, setPftData] = useState<PFTResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.getPatientPFT(patientId)
      .then(res => setPftData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId]);

  const chartData = pftData.map(p => ({
    date: new Date(p.test_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    fev1: p.fev1_pct_predicted,
    fvc: p.fvc_pct_predicted,
    dlco: p.dlco_pct_predicted,
  }));

  const latest = pftData[pftData.length - 1];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: '#8892a4' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
        Loading PFT history…
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>PFT Progress</div>
        <div style={{ fontSize: 13, color: '#8892a4', marginTop: 4 }}>Pulmonary Function Test history</div>
      </div>

      {/* Latest values */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'FEV₁', value: latest?.fev1_pct_predicted, sub: '% predicted', color: '#3b82f6' },
          { label: 'FVC',  value: latest?.fvc_pct_predicted,  sub: '% predicted', color: '#10b981' },
          { label: 'DLCO', value: latest?.dlco_pct_predicted, sub: '% predicted', color: '#8b5cf6' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="vital-quick-card">
            <div className="vq-label">{label}</div>
            <div className="vq-value" style={{ color, fontSize: 20 }}>
              {value != null ? `${value}%` : '—'}
            </div>
            <div className="vq-unit">{sub}</div>
          </div>
        ))}
      </div>

      {chartData.length > 0 ? (
        <>
          {/* FEV1 + FVC trend */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>FEV₁ & FVC — % Predicted</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fev1G" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
                <YAxis domain={[30, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="fev1" stroke="#3b82f6" fill="url(#fev1G)" strokeWidth={2} name="FEV₁ %" />
                <Area type="monotone" dataKey="fvc" stroke="#10b981" fill="none" strokeWidth={1.5} name="FVC %" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* DLCO */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>DLCO — Diffusion Capacity</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#8892a4', fontSize: 10 }} />
                <YAxis domain={[30, 100]} tick={{ fill: '#8892a4', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="dlco" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="DLCO %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8892a4' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          No PFT results yet. Ask your care team to enter your results.
        </div>
      )}

      {/* Interpretation */}
      {latest && (
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>⚕️ Clinical Note</div>
          <div style={{ color: '#8892a4', lineHeight: 1.6 }}>
            {latest.fev1_pct_predicted != null && latest.fev1_pct_predicted < 50
              ? `FEV₁ is at ${latest.fev1_pct_predicted}% predicted — severe obstruction range. Consistent breathing exercises are essential. Your physiotherapist will review this trend at your next appointment.`
              : `Your latest PFT results show FEV₁ at ${latest.fev1_pct_predicted ?? '—'}% predicted. Continue your breathing sessions consistently — adherence is the strongest predictor of stability.`
            }
          </div>
        </div>
      )}
    </div>
  );
}
