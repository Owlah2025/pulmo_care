import { useEffect, useRef, useState } from 'react';

export interface AlertEvent {
  id: string;
  type: 'spo2_critical' | 'risk_high' | 'risk_critical';
  patient_id: string;
  patient_name: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export function useAlerts(clinicianId: string) {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/alerts/${clinicianId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const alert: AlertEvent = JSON.parse(event.data);
      setAlerts((prev) => [{ ...alert, acknowledged: false }, ...prev]);
    };

    return () => ws.close();
  }, [clinicianId]);

  const acknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  return { alerts, connected, acknowledge };
}
