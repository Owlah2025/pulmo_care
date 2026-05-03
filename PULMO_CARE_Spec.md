# PULMO CARE Platform — Full Technical Specification
### Transforming Home-Based Pulmonary Rehabilitation through Computer Vision and Predictive AI

> **Version:** 2.0 — Production-Ready  
> **Primary Deliverable:** Cross-platform Mobile App (Flutter) + Cloud Backend + Web Dashboard  
> **Clinical Focus:** COPD, ILD, and chronic respiratory disease home rehabilitation

---

## 1. Platform Overview & Clinical Objectives

PULMO CARE is an integrated virtual respiratory therapist platform addressing three root clinical failures:

| Problem | Target Metric | Solution Module |
|---|---|---|
| <3% program completion due to access barriers | +40% adherence | Real-time Bio-feedback + Gamification |
| Incorrect home exercise technique | <10% incorrect breath rate | Computer Vision Breathing Tracker |
| Late exacerbation detection (30% readmission) | Predict 72h in advance | Predictive AI + SpO₂ Integration |

**The Three Priority Features (Build Order):**
1. 🌟 Real-time Bio-feedback — Computer Vision Breathing Tracker
2. 🚨 Predictive Exacerbation Alert — with Pulse Oximeter (SpO₂) Integration
3. 🌳 Gamification — The Respiratory Tree

---

## 2. Technical Stack

### Mobile Application (Primary Client)
* **Framework:** Flutter 3.x (Dart) — single codebase for iOS and Android
* **Computer Vision (On-Device):** MediaPipe Pose (`mediapipe_flutter` plugin) + TensorFlow Lite for custom models
* **Bluetooth/IoT:** `flutter_blue_plus` for BLE communication with pulse oximeters
* **Audio TTS:** `flutter_tts` for voice correction feedback (no video recording)
* **Local Database:** SQLite via `sqflite` for offline session caching
* **State Management:** Riverpod or BLoC pattern
* **Charts & Visualization:** `fl_chart` for real-time signal plots and PFT dashboards

### Backend & Cloud
* **Primary Cloud:** AWS (preferred for HIPAA compliance) or Firebase (faster prototyping)
* **API Layer:** FastAPI (Python 3.11) — REST + WebSocket endpoints
* **Database:** PostgreSQL (RDS on AWS) for patient records; TimescaleDB extension for time-series vitals
* **ML Pipeline:** AWS SageMaker or Google Vertex AI for exacerbation prediction model training and serving
* **Message Queue:** AWS SQS or Redis for real-time alert routing
* **Security:** End-to-end encryption (AES-256 at rest, TLS 1.3 in transit); HIPAA-compliant architecture

### Web Dashboard (Clinician Portal)
* **Framework:** React 18 + TypeScript
* **Charts:** Recharts or Nivo for PFT trend visualization
* **Auth:** AWS Cognito or Firebase Auth with role-based access (Patient / Therapist / Admin)
* **Real-time Updates:** WebSockets for live patient alert triage

---

## 3. Project Architecture & Folder Layout

```
pulmo_care/
│
├── mobile/                          # Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── features/
│   │   │   ├── breathing/           # Feature #1 — CV Breathing Tracker
│   │   │   │   ├── camera_view.dart
│   │   │   │   ├── pose_processor.dart
│   │   │   │   ├── signal_processor.dart
│   │   │   │   ├── breathing_fsm.dart
│   │   │   │   └── voice_coach.dart
│   │   │   ├── oximetry/            # Feature #2 — IoT / SpO₂
│   │   │   │   ├── ble_scanner.dart
│   │   │   │   ├── oximeter_service.dart
│   │   │   │   └── safety_watchdog.dart
│   │   │   ├── prediction/          # Feature #2 — Exacerbation Prediction
│   │   │   │   ├── vitals_collector.dart
│   │   │   │   └── risk_api_client.dart
│   │   │   ├── gamification/        # Feature #3 — Respiratory Tree
│   │   │   │   ├── tree_widget.dart
│   │   │   │   ├── tree_state.dart
│   │   │   │   └── balloon_game.dart
│   │   │   ├── pft/                 # PFT Dashboard
│   │   │   │   ├── pft_input_form.dart
│   │   │   │   └── pft_chart.dart
│   │   │   ├── chatbot/             # AI Medical Chatbot
│   │   │   │   └── chatbot_screen.dart
│   │   │   └── auth/
│   │   │       └── login_screen.dart
│   │   ├── core/
│   │   │   ├── models/              # Patient, Session, Vital, BreathCycle, etc.
│   │   │   ├── services/            # API client, local DB, encryption
│   │   │   └── theme/               # Colors, typography, dark/light mode
│   │   └── shared/                  # Reusable widgets, constants
│   ├── pubspec.yaml
│   └── test/
│
├── backend/                         # FastAPI Python backend
│   ├── main.py
│   ├── api/
│   │   ├── routes/
│   │   │   ├── sessions.py          # Session upload & retrieval
│   │   │   ├── vitals.py            # SpO₂ / symptom time-series
│   │   │   ├── predictions.py       # Exacerbation risk scoring
│   │   │   ├── pft.py               # PFT result CRUD
│   │   │   └── chatbot.py           # NLP chatbot proxy
│   │   └── websockets/
│   │       └── alerts.py            # Real-time clinician alert push
│   ├── ml/
│   │   ├── exacerbation_model/
│   │   │   ├── train.py             # Model training pipeline
│   │   │   ├── predict.py           # Inference endpoint
│   │   │   ├── features.py          # Feature engineering
│   │   │   └── model.pkl            # Serialized model artifact
│   │   └── cough_classifier/
│   │       └── inference.py         # Audio-based cough analysis
│   ├── db/
│   │   ├── models.py                # SQLAlchemy ORM models
│   │   └── migrations/              # Alembic migrations
│   ├── core/
│   │   ├── security.py              # JWT, encryption helpers
│   │   ├── config.py                # Environment-based settings
│   │   └── logging.py               # Structured JSON logging
│   ├── tests/
│   │   ├── test_prediction.py
│   │   └── test_vitals.py
│   └── requirements.txt
│
├── dashboard/                       # React clinician web portal
│   ├── src/
│   │   ├── pages/
│   │   │   ├── PatientList.tsx      # Triage view — all patients
│   │   │   ├── PatientDetail.tsx    # Individual patient drill-down
│   │   │   └── AlertCenter.tsx      # Real-time exacerbation alerts
│   │   ├── components/
│   │   │   ├── PFTTrendChart.tsx
│   │   │   ├── VitalsTimeline.tsx
│   │   │   └── RiskBadge.tsx        # Color-coded risk indicator
│   │   └── services/
│   │       └── api.ts
│   └── package.json
│
├── infra/                           # Infrastructure as Code
│   ├── terraform/                   # AWS resource definitions
│   └── docker-compose.yml           # Local development stack
│
└── .github/
    └── workflows/
        ├── mobile_ci.yml            # Flutter tests + build
        └── backend_ci.yml           # Pytest + Docker build
```

---

## 4. Feature #1 — Real-Time Bio-feedback (Computer Vision Breathing Tracker)

### A. Privacy-First Architecture
* **No video is ever recorded or transmitted.** The camera feed is processed entirely on-device in real time.
* Only derived numerical data (landmark coordinates, flow vectors, BPM) leaves the device — never raw frames.
* Display a prominent "Camera Active — Not Recording" indicator in the UI.

### B. Supported Breathing Exercises
* **Diaphragmatic (Belly) Breathing:** Abdominal expansion with shoulder stability.
* **Pursed-Lip Breathing (PLB):** Slower exhalation phase; detected via breath cycle ratio (inhalation:exhalation target = 1:2 or 1:3).

### C. Pose Pipeline (MediaPipe + TFLite)
* Use `MediaPipe Pose` with `model_complexity=1`, `smooth_landmarks=true`.
* Key landmarks extracted per frame:
  * Shoulders: `LEFT_SHOULDER` (11), `RIGHT_SHOULDER` (12)
  * Hips: `LEFT_HIP` (23), `RIGHT_HIP` (24)
  * Nose (0) for positioning guidance
* Gate all logic on landmark confidence ≥ 0.6 for all 4 torso landmarks simultaneously.
* Display a side-profile positioning guide overlay when confidence falls below threshold.

### D. Diaphragmatic Breathing Detection
**Chest Fault Detection:**
* Monitor Y-axis coordinates of shoulder landmarks over a rolling 3-second window.
* Apply a 4th-order Butterworth low-pass filter (cutoff ≈ 0.5 Hz) to remove camera jitter.
* If peak-to-peak amplitude of filtered signal exceeds calibration threshold (default: 8px at 480p), raise `SHOULDER_MOVEMENT_DETECTED`.
* Require the flag active for ≥1.5 seconds before triggering voice feedback (prevents flickering).

**Abdominal Expansion Detection:**
* Compute a dynamic torso bounding box from landmark coordinates.
* Isolate the **lower 50%, inner 60%** of the torso box as the abdominal ROI.
* Apply Farneback Dense Optical Flow within the ROI only (efficiency — not full frame).
* Track mean X-axis flow vector: positive = inhalation (expansion), negative = exhalation.
* Apply Savitzky-Golay filter (window=15, poly=3) for smoothing.
* Use `scipy.signal.find_peaks` (or a Dart equivalent) to detect breath peaks.
* Derive: **BPM**, **Breath Depth Score** (0–100), **I:E Ratio** for PLB validation.

### E. Finite State Machine (Breathing FSM)
```
IDLE → POSITIONING → CALIBRATING → MONITORING
                                        ↓          ↓           ↓           ↓
                                   GOOD_BREATH  FAULT_SHOULDER  PLB_FAULT  NO_PERSON
```
* **IDLE:** App opened, session not started.
* **POSITIONING:** Camera active; patient not yet in correct side-profile position.
* **CALIBRATING:** 5-second resting baseline capture. Stores shoulder variance and ROI texture reference.
* **MONITORING:** Active detection.
* **GOOD_BREATH:** Abdominal expansion with minimal shoulder movement. ✅
* **FAULT_SHOULDER:** Shoulder rise detected during inhalation. ❌
* **PLB_FAULT:** I:E ratio < 1:1.5 (exhalation too fast). ❌
* **NO_PERSON:** Landmark confidence below threshold for >2 seconds.

### F. Voice Coach (flutter_tts — No Recording)
* Generate corrective audio cues in real time using on-device TTS:
  * `FAULT_SHOULDER` → *"Relax your shoulders. Let your belly do the work."*
  * `PLB_FAULT` → *"Breathe out slowly through pursed lips. Take your time."*
  * `GOOD_BREATH` (after 5 consecutive good cycles) → *"Excellent! Keep up this rhythm."*
  * `NO_PERSON` → *"Please position yourself side-on to the camera."*
* Voice cue rate-limiting: minimum 8 seconds between cues of the same type.
* Allow patients to select voice language (Arabic / English) and volume in settings.

### G. On-Screen UI Elements
* **Video View:** Live camera feed with skeletal wireframe overlay, abdominal ROI rectangle (green = good, red = fault), and landmark confidence dots.
* **Breath Waveform:** Real-time scrolling `fl_chart` showing the abdominal expansion signal and shoulder stability line.
* **State Banner:** Full-width color-coded banner (green/red/yellow/grey) with state text.
* **Metric Cards:** BPM, Depth Score, I:E Ratio, Session Duration, Good Breath %.
* **Calibration Button:** Allows patient to recalibrate at any time.

---

## 5. Feature #2 — Predictive Exacerbation Alert + IoT SpO₂ Integration

### A. Bluetooth Pulse Oximeter Integration
* Use `flutter_blue_plus` to scan and connect to BLE-enabled pulse oximeters (e.g., Nonin, Wellue, Contec).
* Parse standard BLE GATT profiles for SpO₂ (Pulse Oximetry Service UUID: `0x1822`) and Heart Rate.
* Poll SpO₂ every 2 seconds during exercise sessions.

**Safety Watchdog (Automatic Session Termination):**
* Hard terminate session immediately if SpO₂ < 88%.
* Terminate if SpO₂ drops ≥ 4% within any 60-second window (rapid desaturation).
* On termination: pause exercise, play urgent audio alert, display "Session stopped — SpO₂ too low. Rest and contact your care team if it does not recover.", and log the event with timestamp.
* Send an automatic push notification alert to the linked clinician if SpO₂ < 88%.

### B. Daily Vitals Collection
Patients log the following daily (via quick in-app form, takes <2 minutes):
* SpO₂ (resting, from oximeter or manual entry)
* Heart rate (resting)
* Respiratory rate (measured by the CV module or self-reported)
* Dyspnea score (Modified Borg Scale, 0–10)
* Sputum volume and color (None / Clear / Yellow / Green)
* Fatigue level (1–5)
* Cough frequency (None / Occasional / Frequent / Constant)

**Optional — Cough Sound Analysis:**
* With patient consent, capture a 5-second cough audio sample using the microphone (not stored — analyzed on-device using a TFLite audio classifier).
* Classify as: Dry / Productive / Wet. Feed the category (not the audio) into the prediction model.

### C. Exacerbation Prediction ML Model

**Training Data Schema:**
```
patient_id | date | spo2_resting | hr_resting | rr | dyspnea_borg
           | sputum_score | fatigue | cough_type | exercise_sessions_week
           | avg_breath_depth | good_breath_pct | exacerbation_label (0/1)
```
* `exacerbation_label = 1` if the patient was hospitalized or required oral steroids/antibiotics within 72 hours of the record date.

**Model Architecture:**
* Primary: **XGBoost** or **LightGBM** classifier on the tabular feature set above — strong baseline, interpretable, lightweight for API serving.
* Feature engineering: 3-day rolling means, day-over-day deltas, trend slopes for key vitals.
* Secondary (future): LSTM on the raw time-series for sequential pattern capture.
* Target: AUROC ≥ 0.82 on held-out test set; calibrate probabilities with Platt scaling.
* Retrain monthly on aggregated (de-identified) patient data.

**Inference Pipeline:**
* Every night at 02:00 local time, the backend computes the exacerbation risk score for each active patient using the last 7 days of vitals.
* Output: a **Risk Score (0.0–1.0)** and **Risk Level** (Low / Moderate / High / Critical).
* Push results to patient app and clinician dashboard.

**Alert Thresholds:**
| Risk Level | Score | Action |
|---|---|---|
| Low | < 0.30 | No action; show green status |
| Moderate | 0.30–0.59 | In-app recommendation: "Rest more today; ensure medication adherence" |
| High | 0.60–0.79 | Push alert to patient + clinician; suggest contacting care team |
| Critical | ≥ 0.80 | Urgent push to clinician; automated SMS/call fallback |

### D. Backend Prediction API
```
POST /api/v1/predictions/score
  Body: { patient_id, vitals_window: [...last 7 days...] }
  Returns: { risk_score, risk_level, top_contributing_features, timestamp }
```
* Serve model via FastAPI + joblib-loaded artifact.
* Cache results in Redis with a 6-hour TTL.
* Log all predictions to PostgreSQL for audit trail (required for clinical accountability).

---

## 6. Feature #3 — Gamification: The Respiratory Tree 🌳

### A. The Respiratory Tree

**Core Concept:** A living virtual tree on the app home screen that reflects the patient's cumulative exercise adherence. Creates an emotional bond and daily motivation.

**Tree State Mapping:**

| Adherence Level (last 7 days) | Tree State | Visual |
|---|---|---|
| 7/7 sessions completed | Lush, full bloom | Green leaves, flowers, butterflies |
| 5–6/7 sessions | Healthy | Full green leaves |
| 3–4/7 sessions | Wilting | Yellowing leaves, drooping branches |
| 1–2/7 sessions | Stressed | Mostly bare, brown leaves |
| 0/7 sessions | Dormant | Bare branches, grey, snowflakes |

**Implementation:**
* Render the tree as an animated Flutter `CustomPainter` widget or use Lottie animations (`.json` files from LottieFiles).
* Each completed session adds visible growth: new leaf sprout, flower, or small bird animation.
* Tree state recalculates on app open and after each completed session.
* Store tree state in local SQLite + sync to cloud on connection.

**Streak System:**
* Maintain a daily streak counter (displayed as a flame icon + number of consecutive days).
* Breaking a streak triggers a compassionate message: *"Your tree missed you today. Come back tomorrow — it still has time to bloom."*
* Streak Milestones: 7 days → Bronze badge; 30 days → Silver badge; 90 days → Gold badge (displayed on profile).

### B. Interactive Breathing Game — The Hot Air Balloon

**Concept:** A mini-game unlocked after completing each breathing session, where the patient controls a hot air balloon with their breathing rhythm. Reinforces the diaphragmatic technique in an engaging format.

**Mechanics:**
* The camera and CV pipeline remain active (same as the breathing tracker).
* Balloon altitude is controlled by breath depth score: a deep diaphragmatic breath lifts the balloon; exhalation lowers it.
* Shoulder movement fault causes wind turbulence / balloon shake (negative feedback).
* Patient must navigate the balloon through a series of floating rings (targets) within 2 minutes.

**Scoring:**
* Rings collected → XP points.
* Perfect breath (depth score > 80, no shoulder fault) → bonus points.
* Weekly leaderboard (opt-in, anonymized) for social motivation.

**Implementation:**
* Build using Flutter's `CustomPainter` + `AnimationController`.
* The CV pipeline is the same `pose_processor.dart` and `signal_processor.dart` as Feature #1 — no code duplication; the game subscribes to the same `BreathingFSM` stream.

---

## 7. Additional Features

### A. AI Medical Chatbot
* **Backend:** Proxy to Claude API (or GPT-4o) with a tightly scoped system prompt:
  *"You are PULMO, a specialized respiratory health assistant. You answer patient questions about their medication, symptoms, breathing techniques, and lifestyle. You NEVER diagnose or prescribe. For emergencies, always direct the patient to call their care team or emergency services."*
* **NLP Sentiment Analysis:** After each chatbot message, run a lightweight sentiment classifier (on-device TFLite or via API) to detect: Anxious / Sad / Frustrated / Neutral / Positive.
* Logged sentiment trends are surfaced to the clinician dashboard as a "Patient Wellbeing Index" (weekly trend line).
* Support Arabic and English natively (the LLM handles both; the UI offers language toggle).
* Store only conversation summaries server-side (not full transcripts) to minimize privacy exposure.

### B. PFT Progress Tracking Dashboard
* Input form for: FEV₁ (L and % predicted), FVC (L and % predicted), FEV₁/FVC ratio, DLCO (% predicted), date of test.
* Chart: `fl_chart` line chart showing each PFT metric over time.
* Overlay: Semi-transparent exercise session frequency bars beneath the PFT trend line to visualize correlation between adherence and lung function improvement.
* Export: PDF report of PFT trends (via `pdf` Flutter package) shareable with the patient's physician.

---

## 8. Database Schema (PostgreSQL)

```sql
-- Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date_of_birth DATE,
    diagnosis TEXT,  -- COPD / ILD / etc.
    clinician_id UUID REFERENCES clinicians(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Breathing Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    exercise_type TEXT,  -- 'diaphragmatic' | 'pursed_lip'
    total_breaths INTEGER,
    good_breath_pct REAL,
    avg_bpm REAL,
    avg_depth_score REAL,
    spo2_min REAL,
    spo2_avg REAL,
    session_terminated_early BOOLEAN DEFAULT FALSE,
    termination_reason TEXT
);

-- Daily Vitals (TimescaleDB hypertable)
CREATE TABLE daily_vitals (
    patient_id UUID REFERENCES patients(id),
    recorded_at TIMESTAMPTZ NOT NULL,
    spo2_resting REAL,
    hr_resting INTEGER,
    dyspnea_borg INTEGER,
    sputum_score INTEGER,
    fatigue_level INTEGER,
    cough_type TEXT
);
SELECT create_hypertable('daily_vitals', 'recorded_at');

-- Exacerbation Predictions
CREATE TABLE risk_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    predicted_at TIMESTAMPTZ DEFAULT NOW(),
    risk_score REAL,
    risk_level TEXT,
    top_features JSONB,
    alert_sent BOOLEAN DEFAULT FALSE
);

-- PFT Results
CREATE TABLE pft_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    test_date DATE,
    fev1_liters REAL,
    fev1_pct_predicted REAL,
    fvc_liters REAL,
    fvc_pct_predicted REAL,
    fev1_fvc_ratio REAL,
    dlco_pct_predicted REAL
);

-- Tree State
CREATE TABLE gamification_state (
    patient_id UUID PRIMARY KEY REFERENCES patients(id),
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    badge_level TEXT DEFAULT 'none',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. Security & Compliance

* **HIPAA Compliance (if US market):** Business Associate Agreement (BAA) with AWS. Encrypt all PHI at rest (AES-256). Log all data access for audit. Patient data deletion on request.
* **GDPR Compliance (if EU/Egypt market):** Explicit consent on first launch. Data portability export. Right to erasure endpoint.
* **Authentication:** JWT tokens (15-minute expiry) + refresh tokens (30-day expiry) stored in Flutter Secure Storage (Keychain/Keystore). AWS Cognito as identity provider.
* **API Security:** All endpoints require Authorization header. Role-based access: Patient can only read/write their own data; Clinician can read assigned patients; Admin has full access.
* **No Raw Video Transmission:** Enforced at the architecture level — the camera feed is only processed locally by MediaPipe. No frame capture API exists in the backend.

---

## 10. Testing Strategy

### Mobile (Flutter)
* Unit tests for `BreathingFSM`, `SignalProcessor`, `SafetyWatchdog`, `TreeState` logic.
* Widget tests for all critical screens.
* Integration test: use pre-recorded video as mock camera input; assert FSM state sequence and voice cue triggers.

### Backend (pytest)
* `test_prediction.py`: Feed synthetic 7-day vitals windows; assert correct risk level classification.
* `test_vitals.py`: Verify time-series ingestion, rolling averages, delta calculations.
* `test_alerts.py`: Mock SpO₂ < 88% event; assert alert record created and WebSocket message emitted.

### CI/CD (GitHub Actions)
* `mobile_ci.yml`: `flutter test` + `flutter build apk --release` on every PR.
* `backend_ci.yml`: `pytest` + Docker image build + push to ECR on merge to `main`.
* Automated staging deployment on merge; manual approval gate before production.

---

## 11. Dependency Installation

### Flutter Mobile
```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  mediapipe: ^0.10.0
  tflite_flutter: ^0.10.4
  flutter_blue_plus: ^1.31.0
  flutter_tts: ^3.8.5
  sqflite: ^2.3.2
  fl_chart: ^0.68.0
  lottie: ^3.1.0
  flutter_riverpod: ^2.5.1
  http: ^1.2.1
  flutter_secure_storage: ^9.0.0
  pdf: ^3.10.8
```

### Python Backend
```bash
pip install \
  fastapi==0.111.0 \
  uvicorn==0.30.1 \
  sqlalchemy==2.0.30 \
  alembic==1.13.1 \
  psycopg2-binary==2.9.9 \
  redis==5.0.4 \
  xgboost==2.0.3 \
  lightgbm==4.3.0 \
  scikit-learn==1.5.0 \
  scipy==1.13.0 \
  numpy==1.26.4 \
  pandas==2.2.2 \
  joblib==1.4.2 \
  pyjwt==2.8.0 \
  boto3==1.34.100 \
  python-multipart==0.0.9
```

---

## 12. Future Roadmap

### Phase 2 — Remote 6MWT
* Use smartphone GPS + accelerometer to measure walking distance during a 6-minute walk test at home.
* Simultaneously monitor real-time SpO₂ via connected pulse oximeter.
* Compare results against clinic baseline; flag significant functional decline.

### Phase 2 — Smart Inhaler Synchronization
* Integrate with digital inhalers (Adherium, Propeller Health APIs) to track medication adherence.
* AI-powered inhalation technique analysis via microphone (peak flow, inhalation duration).
* Automated adherence reminders with adaptive timing (learns when patient typically takes medication).

### Phase 3 — Group Telerehabilitation
* Encrypted group video sessions (max 8 patients + 1 therapist) via WebRTC.
* Real-time therapist dashboard showing all patients' breathing scores simultaneously during group session.
* Peer support chat and scheduled group exercise calendar.

### Phase 3 — Hospital Clinician Dashboard (Full Build)
* Web portal for physicians to monitor all assigned patients.
* Auto-triage sorted by risk score (Critical patients flagged at top).
* One-click alert acknowledgment workflow.
* Automated weekly patient summary reports generated and emailed.

---

## 13. Reference Resources

* **MediaPipe Pose:** https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmark_detection
* **TensorFlow Lite Flutter:** https://pub.dev/packages/tflite_flutter
* **flutter_blue_plus:** https://pub.dev/packages/flutter_blue_plus
* **XGBoost Docs:** https://xgboost.readthedocs.io/en/stable/
* **FastAPI Docs:** https://fastapi.tiangolo.com/
* **TimescaleDB:** https://docs.timescale.com/
* **AWS HIPAA Compliance:** https://aws.amazon.com/compliance/hipaa-compliance/
* **OpenCV Dense Optical Flow:** https://docs.opencv.org/3.4/d4/dee/tutorial_optical_flow.html
* **SciPy Signal Processing:** https://docs.scipy.org/doc/scipy/reference/signal.html
* **Lottie Flutter:** https://pub.dev/packages/lottie
* **fl_chart:** https://pub.dev/packages/fl_chart
