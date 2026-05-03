# PULMO CARE — Implementation Plan Gap Analysis
### Spec vs. Antigravity Plan: What's Covered, What's Missing

> **Verdict:** The plan is a solid skeleton but has significant gaps for a clinical product. It correctly covers broad phases, folder structure, database schema, and the happy-path of each feature. Where it falls short is in the clinically and architecturally critical details that cannot be retrofitted later.

---

## Legend
- ✅ **Covered** — Plan matches spec correctly
- ⚠️ **Partially Covered** — Plan mentions it but misses critical sub-requirements
- ❌ **Missing** — Entirely absent from the plan

---

## 1. Infrastructure & Scaffolding

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| Full folder structure (mobile / backend / dashboard / infra) | ✅ Covered | Matches spec exactly. |
| Docker-compose + TimescaleDB for local dev | ✅ Covered | Phase 1 includes this. |
| Terraform / IaC for AWS | ❌ Missing | Spec has an `infra/terraform/` directory. Plan never mentions IaC or AWS resource provisioning. |
| GitHub Actions CI (mobile + backend) | ✅ Covered | Phase 7 covers both workflows correctly. |

---

## 2. Authentication & Security

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| JWT + refresh tokens, AWS Cognito, role-based access | ⚠️ Partial | Plan mentions JWT auth but never references AWS Cognito or the 3 distinct roles (Patient / Therapist / Admin). |
| HIPAA / GDPR compliance architecture | ❌ Missing | Spec has an entire Security & Compliance section. Plan has zero mention of HIPAA, GDPR, PHI encryption, BAA, audit logging, or patient data deletion rights. |
| No raw video transmission (privacy-first enforcement) | ❌ Missing | Plan implements the CV feature but never explicitly enforces or tests the "no frames leave the device" constraint — a critical clinical requirement. |

> ⚠️ **Most dangerous omission:** The HIPAA/GDPR section is entirely missing. If this targets real patients, the entire backend architecture needs to be validated against compliance requirements from day one. Retrofitting encryption and audit logging later is expensive and may require architectural changes.

---

## 3. Feature #1 — CV Breathing Tracker

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| Diaphragmatic breathing detection (core logic) | ✅ Covered | Phase 3 covers pose processor, signal processor, and FSM wiring. |
| Pursed-lip breathing (PLB) detection + I:E ratio | ❌ Missing | Plan only mentions diaphragmatic breathing. `PLB_FAULT` FSM state and I:E ratio calculation are in the spec but entirely absent from the plan. |
| FSM — all 7 states including POSITIONING and PLB_FAULT | ⚠️ Partial | Plan mentions the FSM but only references some states. `POSITIONING` and `PLB_FAULT` are not listed anywhere. |
| Landmark confidence gating (≥0.6 for all 4 torso landmarks) | ❌ Missing | Plan doesn't specify the confidence threshold logic that gates all downstream detection. Without this, the system will produce garbage output on partial detections. |
| Voice cue rate-limiting (≥8 seconds between same-type cues) | ❌ Missing | `flutter_tts` is mentioned but the anti-spam / rate-limiting logic from the spec is not included. |
| Arabic + English voice language toggle | ❌ Missing | Spec explicitly requires bilingual TTS support. Plan does not mention it at all. |

> ⚠️ **PLB detection** is one of the two prescribed exercises in the spec — its complete absence from the plan means a core clinical deliverable would be skipped.

---

## 4. Feature #2 — IoT & Exacerbation Prediction

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| BLE GATT profile parsing (SpO₂ Service UUID: `0x1822`) | ⚠️ Partial | Plan mentions `flutter_blue_plus` and SpO₂ parsing but omits the specific GATT profile UUID and Heart Rate service — needed for real device compatibility. |
| Safety watchdog — hard stop at SpO₂ < 88% | ✅ Covered | Mentioned correctly. |
| Safety watchdog — rapid desaturation (≥4% drop within 60 seconds) | ⚠️ Partial | Plan mentions the <88% hard stop but **misses the rapid desaturation trigger**, which is the more clinically important of the two safety rules. |
| Automatic push alert to clinician on SpO₂ < 88% | ❌ Missing | Spec requires an automatic clinician push notification on any hard stop. Plan only mentions the patient-side alert. |
| Cough sound analysis (on-device TFLite audio classifier) | ❌ Missing | Spec includes optional cough audio classification as a prediction feature input. Entirely absent from the plan. |
| ML feature engineering (rolling means, day-over-day deltas, trend slopes) | ❌ Missing | Plan mentions XGBoost/LightGBM training but omits the feature engineering step (`features.py`), which is its own module in the spec. |
| Platt scaling / probability calibration | ❌ Missing | Spec requires calibrated risk probabilities (not raw model scores). Plan skips this entirely. |
| Nightly CRON scoring + Redis caching (6-hour TTL) | ⚠️ Partial | Plan mentions APScheduler for nightly scoring but omits the Redis result cache. |
| 4-tier alert system with Critical tier SMS/call fallback | ⚠️ Partial | Plan mentions push notifications for Moderate/High risk but skips the Critical tier's SMS/automated call fallback. |
| All predictions logged to PostgreSQL for audit trail | ❌ Missing | Required for clinical accountability. Plan doesn't mention audit logging of prediction outputs. |

> ⚠️ **Most dangerous omission here:** The rapid desaturation trigger (≥4% drop in 60 seconds) is more clinically important than the absolute <88% threshold, because dangerous desaturation during exercise often happens fast. This needs to be in the safety watchdog from day one.

---

## 5. Feature #3 — Gamification

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| 5-state tree (Lush → Dormant) mapped to 7-day rolling adherence | ⚠️ Partial | Plan mentions tree states and Lottie animations but doesn't specify the 5-state mapping table or the 7-day rolling window calculation logic. |
| Streak milestones — Bronze (7d) / Silver (30d) / Gold (90d) badges | ❌ Missing | Streak counter is mentioned but the milestone badge system is entirely absent. |
| Hot Air Balloon game re-uses the existing BreathingFSM stream (no code duplication) | ⚠️ Partial | Plan builds `balloon_game.dart` but doesn't explicitly state it subscribes to the existing CV pipeline — a key architectural constraint preventing duplicated camera + pose logic. |
| Weekly anonymized XP leaderboard (opt-in) | ❌ Missing | Spec includes a leaderboard feature. Not mentioned anywhere in the plan. |

---

## 6. Additional Features

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| AI chatbot proxy with strict system prompt | ✅ Covered | Phase 6 includes the chatbot route and LLM proxy. |
| NLP sentiment analysis after each chatbot message | ⚠️ Partial | Plan builds the chatbot but omits the sentiment classifier that feeds the Wellbeing Index. |
| Patient Wellbeing Index surfaced to clinician dashboard | ❌ Missing | Requires the sentiment analysis above. Not in the plan. |
| PFT PDF export (shareable with physician) | ✅ Covered | Plan correctly includes the `pdf` Flutter package for this. |
| PFT adherence correlation overlay (session frequency bars under PFT trend line) | ❌ Missing | Spec requires a specific dual-axis chart. Plan only mentions generic "charts". |

---

## 7. Database Schema

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| All 6 tables (patients, sessions, daily_vitals, risk_predictions, pft_results, gamification_state) | ✅ Covered | Plan references all 6 tables explicitly in Phase 2. |
| TimescaleDB hypertable on `daily_vitals` | ✅ Covered | Mentioned correctly in Phase 2. |

---

## 8. Clinician Dashboard

| Spec Requirement | Status | Gap / Note |
|---|---|---|
| Triage view sorted by risk score | ✅ Covered | Phase 6 covers the PatientList triage view. |
| One-click alert acknowledgment workflow | ✅ Covered | Included in Phase 6. |
| Patient Wellbeing Index (sentiment trend from chatbot NLP) | ❌ Missing | Depends on the missing sentiment classifier. Not in plan. |
| Automated weekly patient summary reports (email) | ❌ Missing | Spec requires automated email reports. Plan doesn't mention report generation or email delivery. |

---

## Summary: Gap Count by Severity

| Priority | Count | Items |
|---|---|---|
| 🔴 Critical (clinical safety / compliance) | 4 | HIPAA/GDPR architecture, rapid desaturation trigger, clinician SpO₂ alert, no-video-transmission enforcement |
| 🟠 High (core feature completeness) | 5 | PLB detection + I:E ratio, PLB_FAULT FSM state, landmark confidence gating, cough classifier, ML feature engineering |
| 🟡 Medium (product quality) | 7 | Arabic/English TTS, rate-limited voice cues, Redis cache, Platt scaling, audit logging, streak badges, balloon game FSM reuse |
| 🟢 Low (polish / nice-to-have) | 5 | Terraform IaC, XP leaderboard, Wellbeing Index, PFT correlation overlay, weekly email reports |

**Total gaps identified: 21**
**Fully covered: 13 out of 34 requirements checked**

---

## Recommended Actions Before Writing Code

### Action 1 — Add Phase 1.5: Compliance & Privacy Architecture
Insert a dedicated phase between Phase 1 (scaffolding) and Phase 2 (schema) covering:
- HIPAA BAA setup with AWS
- PHI encryption strategy (AES-256 at rest, TLS 1.3 in transit)
- Audit logging schema and middleware
- GDPR consent flow in the mobile app
- Architecture review confirming no video frame data pathway exists to the backend

### Action 2 — Update Phase 3 (Feature #1)
Add to the breathing tracker implementation:
- PLB detection with I:E ratio calculation in `signal_processor.dart`
- `PLB_FAULT` and `POSITIONING` states added to `breathing_fsm.dart`
- Confidence gating logic (all 4 landmarks ≥ 0.6) as a prerequisite check
- TTS rate-limiter class with 8-second same-type cooldown
- Language toggle (Arabic / English) wired to app settings

### Action 3 — Update Phase 4 (Feature #2)
Add to the IoT and prediction implementation:
- Rapid desaturation detector in `safety_watchdog.dart` (≥4% drop / 60s window)
- Clinician push notification on any safety termination event
- `features.py` module for rolling mean, delta, and slope feature engineering
- Platt scaling step in the model training pipeline (`train.py`)
- Redis caching layer for nightly prediction results
- Critical tier alert with SMS/automated call fallback

### Action 4 — Update Phase 5 (Feature #3)
Add to the gamification implementation:
- Explicit 5-state tree mapping table with 7-day rolling window logic in `tree_state.dart`
- Badge milestone system (7 / 30 / 90 day streaks)
- Architectural note confirming `balloon_game.dart` subscribes to the existing `BreathingFSM` stream

---

## Reference
Full platform specification: `PULMO_CARE_Spec.md`
