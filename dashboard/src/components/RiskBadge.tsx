import type { RiskPrediction } from '../services/api';

interface Props {
  level: RiskPrediction['risk_level'];
  score?: number;
  showScore?: boolean;
}

const RISK_CONFIG = {
  Low:      { label: 'Low',      cls: 'low' },
  Moderate: { label: 'Moderate', cls: 'moderate' },
  High:     { label: 'High',     cls: 'high' },
  Critical: { label: 'Critical', cls: 'critical' },
};

export default function RiskBadge({ level, score, showScore = false }: Props) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG['Low'];
  return (
    <span className={`risk-badge ${cfg.cls}`}>
      <span className="risk-dot" />
      {cfg.label}
      {showScore && score !== undefined && (
        <span style={{ opacity: 0.7 }}>({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}
