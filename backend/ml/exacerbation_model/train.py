"""
Exacerbation Model Training Pipeline

Usage:
    python train.py --data path/to/vitals.csv

Outputs:
    model.pkl — serialized XGBoost classifier with Platt scaling
"""

import argparse
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score
import xgboost as xgb
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

FEATURE_COLS = [
    "spo2_resting_mean_3d", "spo2_resting_mean_7d", "spo2_resting_delta", "spo2_resting_slope",
    "hr_resting_mean_3d", "hr_resting_mean_7d", "hr_resting_delta",
    "dyspnea_borg_mean_3d", "dyspnea_borg_mean_7d", "dyspnea_borg_delta",
    "fatigue_level_mean_3d", "fatigue_level_mean_7d", "fatigue_level_delta",
]


def load_and_engineer(csv_path: str) -> pd.DataFrame:
    """Load raw vitals CSV and engineer features for each patient-date window."""
    from predict import engineer_features
    df = pd.read_csv(csv_path, parse_dates=["recorded_at"])
    df = df.sort_values(["patient_id", "recorded_at"])

    rows = []
    for patient_id, group in df.groupby("patient_id"):
        for i in range(7, len(group) + 1):
            window = group.iloc[max(0, i - 7): i]
            features = engineer_features(window).iloc[0].to_dict()
            features["exacerbation_label"] = group.iloc[i - 1].get("exacerbation_label", 0)
            rows.append(features)
    return pd.DataFrame(rows).dropna()


def train(csv_path: str):
    data = load_and_engineer(csv_path)
    available_features = [c for c in FEATURE_COLS if c in data.columns]

    X = data[available_features]
    y = data["exacerbation_label"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    base_model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
    )

    # Platt scaling via CalibratedClassifierCV for calibrated probabilities
    calibrated_model = CalibratedClassifierCV(base_model, method="sigmoid", cv=5)
    calibrated_model.fit(X_train, y_train)

    proba = calibrated_model.predict_proba(X_test)[:, 1]
    auroc = roc_auc_score(y_test, proba)
    print(f"AUROC on test set: {auroc:.4f}")

    if auroc >= 0.82:
        joblib.dump(calibrated_model, MODEL_PATH)
        print(f"Model saved to {MODEL_PATH}")
    else:
        print(f"WARNING: AUROC {auroc:.4f} below 0.82 target. Model NOT saved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to training CSV")
    args = parser.parse_args()
    train(args.data)
