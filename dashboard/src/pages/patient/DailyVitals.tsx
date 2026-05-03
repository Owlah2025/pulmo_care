import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { apiService } from '../../services/api';

interface Ctx { patientId: string; patientName: string; }

export default function DailyVitals() {
  const { patientId } = useOutletContext<Ctx>();
  const [spo2, setSpo2] = useState('');
  const [hr, setHr] = useState('');
  const [dyspnea, setDyspnea] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [cough, setCough] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!spo2 || !hr) return;
    setSubmitting(true);
    setError('');
    try {
      await apiService.logVitals({
        patient_id: patientId,
        recorded_at: new Date().toISOString() as any,
        spo2_resting: parseFloat(spo2),
        hr_resting: parseInt(hr),
        dyspnea_borg: dyspnea ?? undefined,
        fatigue_level: fatigue ?? undefined,
        cough_type: cough || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to save vitals. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <CheckCircle size={56} style={{ color: '#10b981', margin: '0 auto 16px', display: 'block' }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vitals Logged! ✅</div>
        <div style={{ fontSize: 13, color: '#8892a4' }}>Your data has been sent to your care team. See you tomorrow!</div>
        <button
          onClick={() => { setSubmitted(false); setSpo2(''); setHr(''); setDyspnea(null); setFatigue(null); setCough(''); }}
          style={{ marginTop: 24, padding: '12px 28px', borderRadius: 14, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', font: '600 14px Inter', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Log Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Daily Check-In</div>
        <div style={{ fontSize: 13, color: '#8892a4', marginTop: 4 }}>Takes less than 2 minutes · Required daily</div>
      </div>

      <div className="patient-form">
        {/* SpO2 */}
        <div className="form-group">
          <label className="form-label">SpO₂ — Resting (%)</label>
          <input className="form-input" type="number" min="70" max="100" placeholder="e.g. 96" value={spo2} onChange={e => setSpo2(e.target.value)} />
        </div>

        {/* HR */}
        <div className="form-group">
          <label className="form-label">Heart Rate — Resting (bpm)</label>
          <input className="form-input" type="number" min="30" max="200" placeholder="e.g. 72" value={hr} onChange={e => setHr(e.target.value)} />
        </div>

        {/* Dyspnea Borg */}
        <div className="form-group">
          <label className="form-label">Breathlessness — Modified Borg (0–10)</label>
          <div className="borg-grid">
            {[0,1,2,3,4,5].map(v => (
              <button key={v} className={`borg-btn ${dyspnea === v ? 'selected' : ''}`} onClick={() => setDyspnea(v)}>{v}</button>
            ))}
          </div>
          <div className="borg-grid" style={{ marginTop: 6 }}>
            {[6,7,8,9,10].map(v => (
              <button key={v} className={`borg-btn ${dyspnea === v ? 'selected' : ''}`} onClick={() => setDyspnea(v)}>{v}</button>
            ))}
          </div>
          {dyspnea !== null && (
            <div style={{ fontSize: 11, color: '#8892a4', marginTop: 6 }}>
              {['Nothing at all','Very very slight','Very slight','Slight','Moderate','Somewhat severe','Severe','Very severe','Very severe+','Very very severe','Maximum'][dyspnea]}
            </div>
          )}
        </div>

        {/* Fatigue */}
        <div className="form-group">
          <label className="form-label">Fatigue Level (1–5)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3,4,5].map(v => (
              <button key={v} className={`borg-btn ${fatigue === v ? 'selected' : ''}`}
                style={{ flex: 1, aspectRatio: 'auto', padding: '10px 0', fontSize: 13 }}
                onClick={() => setFatigue(v)}>
                {'⭐'.repeat(v)}
              </button>
            ))}
          </div>
        </div>

        {/* Cough */}
        <div className="form-group">
          <label className="form-label">Cough Type</label>
          <div className="sputum-grid">
            {['None','Dry','Productive','Wet'].map(v => (
              <button key={v} className={`sputum-btn ${cough === v ? 'selected' : ''}`} onClick={() => setCough(v)}>{v}</button>
            ))}
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        {/* Submit */}
        <button
          className="start-session-btn"
          style={{ marginTop: 8, background: spo2 && hr ? 'linear-gradient(135deg, #10b981, #059669)' : undefined, opacity: submitting ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={!spo2 || !hr || submitting}
        >
          {submitting ? 'Saving…' : '✓ Submit Daily Check-In'}
        </button>
      </div>
    </div>
  );
}
