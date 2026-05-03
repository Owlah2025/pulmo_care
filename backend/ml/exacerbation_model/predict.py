"""
Exacerbation risk prediction inference module.

Training pipeline: train.py
Feature engineering: features.py
This module loads the serialized model and serves predictions.
"""

import os
import joblib
import numpy as np
import pandas as pd
from typing import Tuple

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


def _load_model():
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return None


_model = _load_model()


def predict_risk(vitals_window: list[dict]) -> Tuple[float, dict]:
    """
    Compute a risk score from a 7-day vitals window.

    Args:
        vitals_window: list of daily vital dicts (last 7 days)

    Returns:
        (risk_score, top_contributing_features)
    """
    if _model is None:
        # Model not yet trained — return a rule-based fallback score
        return _rule_based_score(vitals_window), {}

    df = pd.DataFrame(vitals_window)
    features = engineer_features(df)
    # Model returns calibrated probability (Platt scaling applied during training)
    risk_score = float(_model.predict_proba(features)[0][1])
    top_features = _extract_top_features(features)
    return risk_score, top_features


def _rule_based_score(vitals_window: list[dict]) -> float:
    """Simple rule-based fallback before the ML model is trained."""
    if not vitals_window:
        return 0.1
    latest = vitals_window[-1]
    score = 0.0
    spo2 = latest.get("spo2_resting", 98)
    if spo2 and spo2 < 92:
        score += 0.4
    elif spo2 and spo2 < 95:
        score += 0.2
    dyspnea = latest.get("dyspnea_borg", 0)
    if dyspnea and dyspnea >= 7:
        score += 0.3
    elif dyspnea and dyspnea >= 4:
        score += 0.15
    cough = latest.get("cough_type", "None")
    if cough in ("Productive", "Wet"):
        score += 0.2
    return min(score, 1.0)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Feature engineering: rolling means, day-over-day deltas, trend slopes.
    Matches the features.py module specification.
    """
    numeric_cols = ["spo2_resting", "hr_resting", "dyspnea_borg", "fatigue_level"]
    features = {}

    for col in numeric_cols:
        if col in df.columns:
            series = df[col].dropna()
            features[f"{col}_mean_3d"] = series.tail(3).mean()
            features[f"{col}_mean_7d"] = series.mean()
            features[f"{col}_delta"] = series.diff().iloc[-1] if len(series) > 1 else 0.0
            # Trend slope (linear regression coefficient)
            if len(series) >= 3:
                x = np.arange(len(series))
                slope = np.polyfit(x, series.values, 1)[0]
                features[f"{col}_slope"] = slope

    return pd.DataFrame([features])


def _extract_top_features(features_df: pd.DataFrame) -> dict:
    """Return feature values as a dict for the audit log."""
    return features_df.iloc[0].to_dict()
