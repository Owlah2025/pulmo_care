"""
Backend tests: chatbot sentiment analysis and GDPR utilities.
"""
import pytest
from api.routes.chatbot import _analyze_sentiment, WELLBEING_MAP


class TestChatbotSentiment:
    def test_positive_message(self):
        assert _analyze_sentiment("I feel great today, much better!") == "positive"

    def test_negative_message(self):
        assert _analyze_sentiment("I am struggling, it's very difficult to breathe") == "negative"

    def test_distressed_message(self):
        assert _analyze_sentiment("I'm scared I can't breathe, chest pain!") == "distressed"

    def test_neutral_message(self):
        assert _analyze_sentiment("How do I use the app?") == "neutral"

    def test_wellbeing_scores_sum_to_range(self):
        for label, score in WELLBEING_MAP.items():
            assert 0.0 <= score <= 1.0, f"{label} score out of range"

    def test_distressed_has_lowest_score(self):
        assert WELLBEING_MAP["distressed"] < WELLBEING_MAP["negative"]
        assert WELLBEING_MAP["negative"] < WELLBEING_MAP["neutral"]
        assert WELLBEING_MAP["neutral"] < WELLBEING_MAP["positive"]
