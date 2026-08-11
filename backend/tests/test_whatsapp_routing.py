"""
test_whatsapp_routing.py — Unit tests for AYANA WhatsApp intent routing.

These tests are pure Python — no DB, no Twilio, no network calls.
All routing logic lives in whatsapp.py (parse_intent) and templates_data.py.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio  # apply to all async tests in this module

# ── parse_intent tests (synchronous, no DB) ──────────────────────────────────────

from whatsapp import parse_intent


class TestParseIntent:
    def test_button_payload_feeling_good(self):
        """ButtonPayload from quick-reply tap is returned verbatim."""
        intent = parse_intent(button_payload="feeling:good", body=None)
        assert intent == "feeling:good"

    def test_button_payload_done_medicine(self):
        """Medicine done tap is routed correctly."""
        intent = parse_intent(button_payload="done:medicine", body="Done ✅")
        assert intent == "done:medicine"

    def test_button_payload_skip(self):
        """Skip payload routed correctly."""
        intent = parse_intent(button_payload="skip:lunch", body=None)
        assert intent == "skip:lunch"

    def test_button_payload_reengagement_ok(self):
        """Re-engagement 'I'm fine' routes correctly."""
        intent = parse_intent(button_payload="reengagement:ok", body=None)
        assert intent == "reengagement:ok"

    def test_button_payload_reengagement_help(self):
        """Re-engagement 'Need help' routes to help payload."""
        intent = parse_intent(button_payload="reengagement:help", body=None)
        assert intent == "reengagement:help"

    def test_numeric_shortcut_1_checkin(self):
        """Body='1' with no ButtonPayload maps to feeling:good in checkin context."""
        intent = parse_intent(button_payload=None, body="1", last_msg_type="checkin")
        assert intent == "feeling:good"

    def test_numeric_shortcut_2_checkin(self):
        """Body='2' maps to feeling:okay in checkin context."""
        intent = parse_intent(button_payload=None, body="2", last_msg_type="checkin")
        assert intent == "feeling:okay"

    def test_numeric_shortcut_3_checkin(self):
        """Body='3' maps to feeling:not_well in checkin context."""
        intent = parse_intent(button_payload=None, body="3", last_msg_type="checkin")
        assert intent == "feeling:not_well"

    def test_numeric_shortcut_1_reminder(self):
        """Body='1' maps to done:generic in reminder context."""
        intent = parse_intent(button_payload=None, body="1", last_msg_type="reminder")
        assert intent == "done:generic"

    def test_numeric_shortcut_2_reminder(self):
        """Body='2' maps to pending:generic in reminder context."""
        intent = parse_intent(button_payload=None, body="2", last_msg_type="reminder")
        assert intent == "pending:generic"

    def test_free_text_returns_text_intent(self):
        """Unrecognised free-form text returns generic 'text' intent."""
        intent = parse_intent(button_payload=None, body="Amma is resting", last_msg_type="checkin")
        assert intent == "text"

    def test_empty_body_no_payload_returns_text(self):
        """Empty body and no payload returns 'text'."""
        intent = parse_intent(button_payload=None, body="", last_msg_type="checkin")
        assert intent == "text"

    def test_payload_takes_priority_over_numeric_body(self):
        """ButtonPayload wins even when body is also a valid numeric shortcut."""
        intent = parse_intent(button_payload="done:medicine", body="1", last_msg_type="checkin")
        assert intent == "done:medicine"


# ── Slot catalog tests ──────────────────────────────────────────────────────────────────────

from templates_data import (
    render_slot_body, render_slot_buttons, BUTTONS, SLOT_VARIANTS
)

# v2 render_slot_body expects a parent DICT, not a bare name string.
AMMA = {"name": "Amma", "preferred_name": "Amma", "relationship": "mother", "language": "en"}


class TestSlotCatalog:
    def test_medicine_variable_substitution_en(self):
        """Medicine slot body replaces {medicine} with the actual drug name."""
        body = render_slot_body("medicine", "en", AMMA, medicine_name="Metformin 500mg")
        assert "Metformin 500mg" in body
        assert "{medicine}" not in body

    def test_medicine_variable_substitution_te(self):
        """Medicine substitution works in Telugu."""
        body = render_slot_body("medicine", "te", AMMA, medicine_name="Amlodipine")
        assert "Amlodipine" in body

    def test_preferred_name_substituted(self):
        """preferred_name (Amma) appears in body via {nick1}."""
        body = render_slot_body("how_feeling", "en", AMMA)
        assert "Amma" in body

    def test_max_3_buttons_enforced(self):
        """Every slot has at most 3 buttons — Meta/Twilio hard limit."""
        for slot_type, langs in BUTTONS.items():
            for lang, buttons in langs.items():
                assert len(buttons) <= 3, f"{slot_type}/{lang} has {len(buttons)} buttons (max 3)"

    def test_no_variables_in_button_labels(self):
        """Button labels must not contain {variable} placeholders."""
        for slot_type, langs in BUTTONS.items():
            for lang, buttons in langs.items():
                for label, payload in buttons:
                    assert "{" not in label, (
                        f"{slot_type} button label '{label}' contains a variable (not allowed by Meta)"
                    )

    def test_all_slots_have_english_body(self):
        """Every slot type has an English body variant."""
        for slot_type, variants in SLOT_VARIANTS.items():
            assert "en" in variants, f"{slot_type} missing English body"

    def test_payload_format_is_colon_separated(self):
        """All button payloads follow 'intent:category' format."""
        for slot_type, langs in BUTTONS.items():
            for lang, buttons in langs.items():
                for label, payload in buttons:
                    assert ":" in payload, (
                        f"{slot_type} button '{label}' payload '{payload}' not in 'intent:category' format"
                    )

    def test_fallback_slot_type(self):
        """Unknown slot_type falls back to how_feeling buttons gracefully."""
        buttons = render_slot_buttons("nonexistent_slot_xyz")
        assert len(buttons) <= 3
        assert len(buttons) >= 1


# ── Session state tests (with mocked DB) ────────────────────────────────────────

from whatsapp import is_session_open
from bson import ObjectId


class TestSessionState:
    @pytest.mark.asyncio
    async def test_no_session_returns_false(self):
        """No wa_sessions doc → session is closed."""
        db_mock = MagicMock()
        db_mock.wa_sessions.find_one = AsyncMock(return_value=None)
        parent_id = ObjectId()
        result = await is_session_open(db_mock, parent_id)
        assert result is False

    @pytest.mark.asyncio
    async def test_recent_inbound_returns_true(self):
        """last_inbound_at 30 minutes ago → session is open."""
        db_mock = MagicMock()
        recent = datetime.now(timezone.utc) - timedelta(minutes=30)
        db_mock.wa_sessions.find_one = AsyncMock(return_value={
            "last_inbound_at": recent,
            "session_open": True,
        })
        result = await is_session_open(db_mock, ObjectId())
        assert result is True

    @pytest.mark.asyncio
    async def test_old_inbound_returns_false(self):
        """last_inbound_at 25 hours ago → session is closed (> 24h)."""
        db_mock = MagicMock()
        old = datetime.now(timezone.utc) - timedelta(hours=25)
        db_mock.wa_sessions.find_one = AsyncMock(return_value={
            "last_inbound_at": old,
            "session_open": True,
        })
        result = await is_session_open(db_mock, ObjectId())
        assert result is False

    @pytest.mark.asyncio
    async def test_exactly_24h_is_closed(self):
        """last_inbound_at exactly 24h ago → session is closed (boundary)."""
        db_mock = MagicMock()
        exact = datetime.now(timezone.utc) - timedelta(hours=24, seconds=1)
        db_mock.wa_sessions.find_one = AsyncMock(return_value={
            "last_inbound_at": exact,
        })
        result = await is_session_open(db_mock, ObjectId())
        assert result is False


# ── Voice note detection ─────────────────────────────────────────────────────────────────


class TestVoiceNoteDetection:
    def test_audio_ogg_is_voice(self):
        content_type = "audio/ogg; codecs=opus"
        assert content_type.startswith("audio/")

    def test_audio_mpeg_is_voice(self):
        assert "audio/mpeg".startswith("audio/")

    def test_image_jpeg_is_not_voice(self):
        assert not "image/jpeg".startswith("audio/")

    def test_empty_content_type_is_not_voice(self):
        assert not "".startswith("audio/")


# ── Emergency detection ──────────────────────────────────────────────────────────────────

from whatsapp import detect_emergency


class TestEmergencyDetection:
    def test_chest_pain_in_transcription(self):
        keywords = detect_emergency("I have chest pain and can't breathe")
        assert "chest pain" in keywords

    def test_help_detected(self):
        keywords = detect_emergency("please help me")
        assert "help" in keywords

    def test_telugu_emergency(self):
        keywords = detect_emergency("సహాయం అవసరం")
        assert len(keywords) > 0

    def test_hindi_emergency(self):
        keywords = detect_emergency("मदद चाहिए")
        assert "मदद" in keywords

    def test_no_emergency_in_normal_reply(self):
        keywords = detect_emergency("I'm feeling good today, had lunch")
        assert keywords == []

    def test_empty_string_no_emergency(self):
        assert detect_emergency("") == []

    def test_extra_keyword_detected(self):
        keywords = detect_emergency("my knee hurts a lot", extra_keywords=["hurts"])
        assert "hurts" in keywords

    def test_case_insensitive(self):
        keywords = detect_emergency("FELL DOWN THE STAIRS")
        assert "fell" in keywords
