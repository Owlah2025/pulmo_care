"""
AI Medical Chatbot endpoint.
Acts as a strict proxy to an LLM (OpenAI compatible) with a clinical system prompt.
After each response: NLP sentiment analysis is run and logged.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from core.security import get_current_user
from core.logging import get_logger
from core.config import settings

router = APIRouter(prefix="/api/v1/chat", tags=["chatbot"])
log = get_logger("chatbot")

SYSTEM_PROMPT = """You are PULMO, an AI assistant for patients undergoing pulmonary rehabilitation.

Your role:
- Explain breathing techniques (diaphragmatic, pursed-lip breathing, etc.)
- Provide general education about COPD, ILD, and respiratory health
- Motivate patients to maintain their exercise adherence
- Help patients understand their symptoms

Strict rules you MUST follow:
1. NEVER provide specific medical diagnoses
2. NEVER adjust or recommend medication dosages
3. ALWAYS recommend consulting the patient's care team for clinical decisions
4. Keep responses concise (under 150 words)
5. Use simple, patient-friendly language
6. If a patient reports an emergency (severe breathlessness, chest pain), immediately direct them to call emergency services

You have access to the patient's recent vitals if provided in the context.
"""

SENTIMENT_LABELS = ["positive", "neutral", "negative", "distressed"]


def _analyze_sentiment(text: str) -> str:
    """Lightweight rule-based sentiment for the wellbeing index."""
    text_lower = text.lower()
    distress_words = {"scared", "afraid", "dying", "can't breathe", "emergency", "chest pain", "terrible", "awful"}
    negative_words = {"pain", "worse", "bad", "struggling", "difficult", "tired", "exhausted", "worried"}
    positive_words = {"better", "good", "great", "improving", "happy", "motivated", "feel well", "excellent"}

    if any(w in text_lower for w in distress_words):
        return "distressed"
    if any(w in text_lower for w in negative_words):
        return "negative"
    if any(w in text_lower for w in positive_words):
        return "positive"
    return "neutral"


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    patient_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    sentiment: str   # positive | neutral | negative | distressed
    wellbeing_score: float  # 0.0–1.0 for clinician dashboard


WELLBEING_MAP = {"positive": 0.85, "neutral": 0.5, "negative": 0.25, "distressed": 0.05}


async def _call_llm(messages: list[ChatMessage]) -> str:
    """
    Call the LLM API (OpenAI-compatible).
    Falls back to a rule-based response if API key is not set.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_response(messages[-1].content if messages else "")

    try:
        import httpx
        
        # Detect if it's a Gemini key vs OpenAI key
        is_gemini = api_key.startswith("AIza")
        
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" if is_gemini else "https://api.openai.com/v1/chat/completions"
        model_name = "gemini-2.5-flash" if is_gemini else "gpt-4o-mini"
        
        payload = {
            "model": model_name,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] +
                        [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": 200,
            "temperature": 0.4,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                base_url,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        log.warning(f"LLM call failed: {exc}, falling back to rule-based")
        return _fallback_response(messages[-1].content if messages else "")


def _fallback_response(user_msg: str) -> str:
    """Rule-based fallback when LLM is unavailable."""
    msg = user_msg.lower()
    if "pursed" in msg or "lip" in msg:
        return ("Pursed-lip breathing: inhale slowly through your nose for 2 counts, "
                "then exhale through pursed lips for 4 counts. This keeps your airways "
                "open longer and reduces breathlessness. Practice 4–5 times per session.")
    if "diaphragm" in msg or "belly" in msg:
        return ("Place one hand on your chest and one on your belly. Inhale through your "
                "nose — only your belly should rise. Exhale slowly. This is the technique "
                "your PULMO app monitors during sessions.")
    if "tired" in msg or "fatigue" in msg:
        return ("Fatigue after exercise is common with COPD. Try the 'energy conservation' "
                "technique: pace activities, rest between tasks, and use breathing techniques "
                "proactively. If fatigue is severe, please contact your care team.")
    if "pain" in msg or "chest" in msg:
        return ("⚠️ If you are experiencing chest pain or severe breathlessness right now, "
                "please call emergency services immediately. Do not wait. If this is a general "
                "question, your physiotherapist can assess this at your next appointment.")
    return ("That's a great question. Your care team can give you the most accurate guidance. "
            "In the meantime, I'd encourage you to log today's vitals and complete your "
            "scheduled breathing session — consistency is the best medicine!")


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    # Make auth optional for the patient portal demo prototype
    # current_user: dict = Depends(get_current_user),
):
    """
    Chat with the PULMO AI assistant.
    Proxies to the LLM with a strict clinical system prompt.
    Logs sentiment for the clinician's Patient Wellbeing Index.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Get LLM response
    reply = await _call_llm(request.messages)

    # Analyze sentiment of the latest USER message
    last_user_msg = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
    sentiment = _analyze_sentiment(last_user_msg)
    wellbeing_score = WELLBEING_MAP[sentiment]

    # Log for wellbeing index (patient_id + sentiment + timestamp)
    log.info(f"chat sentiment={sentiment} wellbeing={wellbeing_score} patient={request.patient_id} user=demo")

    return ChatResponse(reply=reply, sentiment=sentiment, wellbeing_score=wellbeing_score)
