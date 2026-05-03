import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return axios(error.config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Types ─────────────────────────────────────────────────────
export interface Patient {
  id: string;
  name: string;
  date_of_birth: string | null;
  diagnosis: string | null;
}

export interface RiskPrediction {
  id: string;
  patient_id: string;
  predicted_at: string;
  risk_score: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  top_features: Record<string, number> | null;
  alert_sent: boolean;
}

export interface DailyVital {
  id: string;
  patient_id: string;
  recorded_at: string;
  spo2_resting: number | null;
  hr_resting: number | null;
  dyspnea_borg: number | null;
  fatigue_level: number | null;
  cough_type: string | null;
}

export interface PFTResult {
  id: string;
  patient_id: string;
  test_date: string;
  fev1_liters: number | null;
  fev1_pct_predicted: number | null;
  fvc_liters: number | null;
  fvc_pct_predicted: number | null;
  fev1_fvc_ratio: number | null;
  dlco_pct_predicted: number | null;
}

export interface BreathingSession {
  id: string;
  patient_id: string;
  started_at: string;
  ended_at: string | null;
  exercise_type: string;
  total_breaths: number | null;
  good_breath_pct: number | null;
  avg_bpm: number | null;
  avg_depth_score: number | null;
  spo2_min: number | null;
  spo2_avg: number | null;
  session_terminated_early: boolean;
  termination_reason: string | null;
}

export interface GameState {
  patient_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  total_sessions: number;
  total_xp: number;
  badge_level: string;
  tree_state: string;
}

export interface RehabPlan {
  id: string;
  patient_id: string;
  generated_at: string;
  fev1_liters: number;
  fvc_liters: number;
  six_mwt_distance: number;
  dyspnea_scale: number;
  session_frequency_daily: number;
  session_duration_minutes: number;
  intensity_level: string;
  recommended_exercises: string[];
}

// ── Auth Helpers ──────────────────────────────────────────────
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('access_token');
}

export function getStoredUser(): { name: string; role: string } | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function getPatientId(): string {
  return localStorage.getItem('patient_id') || '00000000-0000-0000-0000-000000000001';
}

export function getPatientUser(): { id: string; name: string; role: 'Patient' } | null {
  const id = localStorage.getItem('patient_id');
  const name = localStorage.getItem('patient_name');
  if (id && name) return { id, name, role: 'Patient' };
  return null;
}

// ── API Calls ─────────────────────────────────────────────────
export const apiService = {
  // ── Clinician Auth ────────────────────────────────────────
  login: async (email: string, password: string) => {
    const res = await api.post('/api/v1/auth/token',
      new URLSearchParams({ username: email, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    return res;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('patient_id');
    localStorage.removeItem('patient_name');
  },

  getMe: () => api.get('/api/v1/auth/me'),

  // ── Patient Auth ──────────────────────────────────────────
  patientLogin: async (email: string, password: string) => {
    const res = await api.post('/api/v1/auth/patient/token',
      new URLSearchParams({ username: email, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    localStorage.setItem('patient_id', res.data.patient_id);
    localStorage.setItem('patient_name', res.data.patient_name);
    return res;
  },

  patientRegister: async (data: { name: string; email: string; password: string; diagnosis?: string }) => {
    const res = await api.post('/api/v1/auth/patient/register', data);
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    localStorage.setItem('patient_id', res.data.patient_id);
    localStorage.setItem('patient_name', res.data.patient_name);
    return res;
  },

  patientLogout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('patient_id');
    localStorage.removeItem('patient_name');
  },

  // Patients
  getPatients: () => api.get<Patient[]>('/api/v1/patients/'),
  getUnassignedPatients: () => api.get<Patient[]>('/api/v1/patients/unassigned'),
  getPatient: (id: string) => api.get<Patient>(`/api/v1/patients/${id}`),
  createPatient: (data: Partial<Patient>) => api.post<Patient>('/api/v1/patients/', data),
  assignPatient: (patientId: string) => api.patch<Patient>(`/api/v1/patients/${patientId}/assign`),

  // Risk
  getLatestPrediction: (patientId: string) =>
    api.get<RiskPrediction>(`/api/v1/predictions/patient/${patientId}/latest`),
  scorePatient: (patientId: string, vitalsWindow: object[]) =>
    api.post<RiskPrediction>('/api/v1/predictions/score', { patient_id: patientId, vitals_window: vitalsWindow }),

  // Vitals
  getPatientVitals: (patientId: string, days = 14) =>
    api.get<DailyVital[]>(`/api/v1/vitals/patient/${patientId}?days=${days}`),
  logVitals: (data: Partial<DailyVital>) =>
    api.post<DailyVital>('/api/v1/vitals/', data),

  // Reports & Rehab Plans
  uploadReport: (patientId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<RehabPlan>(`/api/v1/reports/upload/${patientId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getRehabPlan: (patientId: string) => api.get<RehabPlan>(`/api/v1/reports/plan/${patientId}`),

  // PFT
  getPatientPFT: (patientId: string) =>
    api.get<PFTResult[]>(`/api/v1/pft/patient/${patientId}`),
  createPFT: (data: Partial<PFTResult>) =>
    api.post<PFTResult>('/api/v1/pft/', data),

  // Sessions
  getPatientSessions: (patientId: string) =>
    api.get<BreathingSession[]>(`/api/v1/sessions/patient/${patientId}`),
  uploadSession: (data: Partial<BreathingSession>) =>
    api.post<BreathingSession>('/api/v1/sessions/', data),

  // Gamification
  getGameState: (patientId: string, sessionsLast7Days = 0) =>
    api.get<GameState>(`/api/v1/gamification/${patientId}?sessions_last_7_days=${sessionsLast7Days}`),

  // Chatbot
  chat: (messages: { role: string; content: string }[], patientId?: string) =>
    api.post<{ reply: string; sentiment: string; wellbeing_score: number }>(
      '/api/v1/chat/',
      { messages, patient_id: patientId }
    ),

  // GDPR
  exportData: (patientId: string) =>
    api.get(`/api/v1/gdpr/export/${patientId}`),
};

export default api;
