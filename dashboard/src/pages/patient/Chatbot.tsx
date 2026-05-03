import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { apiService } from '../../services/api';

interface Ctx { patientId: string; patientName: string; }
interface Message { id: number; role: 'bot' | 'user'; text: string; }

const SMART_REPLIES = [
  "What causes my breathlessness?",
  "How do I do pursed-lip breathing?",
  "Is it normal to feel tired after exercise?",
];

const MOCK_RESPONSES: Record<string, string> = {
  default: "That's a great question. Based on your recent vitals and session history, I'd recommend discussing this with your care team. They can give you personalized guidance. Is there anything else I can help clarify?",
  breath: "Pursed-lip breathing helps slow your breathing rate and keeps airways open longer. Inhale slowly through your nose for 2 counts, then breathe out through pursed lips for 4 counts. Your I:E ratio target is 1:2.",
  tired: "Fatigue after exercise is common with COPD and ILD — your muscles are working harder to get oxygen. Make sure to pace yourself, rest between activities, and track your SpO₂. If fatigue is severe or your SpO₂ drops, contact your care team.",
  breathless: "Breathlessness in COPD happens because airflow is restricted. Your breathing exercises help strengthen your respiratory muscles over time. The pursed-lip technique can reduce dyspnea immediately during an episode.",
};

function getResponse(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('pursed') || lower.includes('lip') || lower.includes('how') && lower.includes('breath')) return MOCK_RESPONSES.breath;
  if (lower.includes('tired') || lower.includes('fatigue')) return MOCK_RESPONSES.tired;
  if (lower.includes('breathless') || lower.includes('causes')) return MOCK_RESPONSES.breathless;
  return MOCK_RESPONSES.default;
}

export default function Chatbot() {
  const { patientId, patientName } = useOutletContext<Ctx>();
  const firstName = patientName?.split(' ')[0] ?? 'there';
  const INITIAL: Message[] = [
    { id: 0, role: 'bot', text: `👋 Hi ${firstName}! I'm PULMO, your respiratory health assistant. I can help with breathing techniques, symptoms, medication questions, and lifestyle tips. How are you feeling today?` },
  ];
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const formattedHistory = newMessages.map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));
      // Assuming a mock patient ID for demo
      const res = await apiService.chat(formattedHistory, patientId);
      const botMsg: Message = { id: Date.now() + 1, role: 'bot', text: res.data.reply };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.warn('API call failed, using fallback rule-based response.', err);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      const botMsg: Message = { id: Date.now() + 1, role: 'bot', text: getResponse(msg) };
      setMessages(prev => [...prev, botMsg]);
    }

    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>PULMO Assistant</div>
        <div style={{ fontSize: 13, color: '#8892a4', marginTop: 3 }}>
          Your AI respiratory health companion · Not a substitute for medical advice
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(m => (
            <div key={m.id}>
              {m.role === 'bot' && <div className="chat-sender">PULMO</div>}
              <div className={`chat-bubble ${m.role}`}>{m.text}</div>
            </div>
          ))}
          {loading && (
            <div>
              <div className="chat-sender">PULMO</div>
              <div className="chat-bubble bot" style={{ opacity: 0.6 }}>
                <span style={{ letterSpacing: 4 }}>•••</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Smart replies */}
        {messages.length < 3 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 10 }}>
            {SMART_REPLIES.map(r => (
              <button key={r} onClick={() => send(r)}
                style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Ask about your breathing, medication, symptoms…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
          />
          <button className="chat-send-btn" onClick={() => send()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
