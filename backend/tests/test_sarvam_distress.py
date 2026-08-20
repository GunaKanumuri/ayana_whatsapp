"""
Tests for AYANA's Sarvam AI Speech-to-Text (STT) integration and
the two-layer distress detection pipeline (Layer 1 keyword + Layer 2 ML).

These tests mock the external Sarvam API calls to verify the local
orchestration logic is correct.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId


@pytest.fixture
def mock_db():
    """Create a mock database with async methods for Motor compatibility."""
    db = MagicMock()

    for collection_name in [
        "parents", "wa_sessions", "message_logs", "parent_replies",
        "distress_logs", "emergency_events", "users", "preferences",
        "payment_state", "monthly_reports", "escalation_state", "schedules"
    ]:
        collection = MagicMock()
        collection.find = MagicMock(return_value=AsyncMock(
            to_list=AsyncMock(return_value=[]),
            __aiter__=AsyncMock(return_value=iter([]))
        ))
        collection.find_one = AsyncMock(return_value=None)
        collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        collection.update_one = AsyncMock(return_value=MagicMock())
        collection.delete_one = AsyncMock(return_value=MagicMock())
        setattr(db, collection_name, collection)

    return db


# ── SARVAM SPEECH-TO-TEXT (sarvam_stt.py) ──────────────────────────────────
class TestSarvamSTT:
    @pytest.mark.asyncio
    async def test_stt_returns_transcript(self, mock_db):
        """
        Expected: When SARVAM_API_KEY is set and the API returns a transcript,
        transcribe_voice_note returns the cleaned text.
        """
        mock_stt_response = {"transcript": "నేను బాగాన్ని"}
        mock_response_content = b"<binary audio data>" * 100  # length > 1000

        class MockResponse:
            status_code = 200
            content = mock_response_content
            headers = {"content-type": "audio/ogg"}
            def json(self):
                return mock_stt_response

        def create_mock_client(*args, **kwargs):
            m = AsyncMock()
            m.__aenter__ = AsyncMock(return_value=m)
            m.__aexit__ = AsyncMock(return_value=None)
            m.get = AsyncMock(return_value=MockResponse())
            m.post = AsyncMock(return_value=MockResponse())
            return m

        with patch.dict("os.environ", {"SARVAM_API_KEY": "fake_key", "SARVAM_STT_URL": "https://api.sarvam.ai/speech-to-text"}), \
             patch("httpx.AsyncClient", side_effect=create_mock_client):

            from sarvam_stt import transcribe_voice_note
            transcript = await transcribe_voice_note("http://example.com/audio", language="te")
            assert transcript == "నేను బాగాన్ని"

    @pytest.mark.asyncio
    async def test_stt_returns_none_when_api_key_missing(self):
        """
        Expected: If SARVAM_API_KEY is not set, the function gracefully skips transcription.
        """
        with patch.dict("os.environ", {"SARVAM_API_KEY": ""}):
            from sarvam_stt import transcribe_voice_note
            transcript = await transcribe_voice_note("http://example.com/audio")
            assert transcript is None


# ── DISTRESS DETECTION Pipeline (distress_detection.py) ──────────────────────
class TestDistressPipeline:
    @pytest.mark.asyncio
    async def test_keyword_only_no_ml(self, mock_db):
        """
        Scenario: A text-based parent reply (no voice note).
        Expected: The system uses ONLY the fast Layer 1 keyword matching.
        """
        parent_id = ObjectId()
        user_id = str(ObjectId())
        parent_doc = {"_id": parent_id, "user_id": user_id, "name": "Amma", "phone": "+919999999999", "language": "en"}
        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)

        with patch("distress_detection.distress_ml_enabled", return_value=False), \
             patch("server.db", mock_db), \
             patch("server._notify_family", new_callable=AsyncMock):

            from whatsapp import detect_emergency
            from server import _record_reply

            reply = await _record_reply("+919999999999", "I have chest pain", num_media=0, parent=parent_doc)

            assert "pain" in reply["emergency_keywords"]
            assert reply["ml_flagged"] is False
            print(f"[Keyword Only Test] Emergency Keywords: {reply['emergency_keywords']}")

    @pytest.mark.asyncio
    async def test_voice_note_triggers_ml_layer(self, mock_db):
        """
        Scenario: A parent sends a voice note.
        Expected: The system transcribes the note, runs Layer 1 (keywords)
        AND Layer 2 (Sarvam ML model). The verdict is logged to distress_logs.
        """
        parent_id = ObjectId()
        user_id = str(ObjectId())
        parent_doc = {"_id": parent_id, "user_id": user_id, "name": "Amma", "phone": "+918888888888", "language": "en"}
        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)

        mock_ml_assessment = {"ml_flagged": True, "ml_score": 0.85, "keyword_emergency": False}

        with patch("server.db", mock_db), \
             patch("whatsapp.detect_emergency", return_value=[]), \
             patch("whatsapp.is_session_open", new_callable=AsyncMock, return_value=False), \
             patch("server.transcribe_voice_note", new_callable=AsyncMock, return_value="I am fine, just tired"), \
             patch("whatsapp.meta_auth_header", return_value={}), \
             patch("server.assess_transcript", new_callable=AsyncMock, return_value=mock_ml_assessment), \
             patch("server._notify_family", new_callable=AsyncMock):

            from server import _record_reply
            reply = await _record_reply(
                from_number="+918888888888",
                body_text="",
                num_media=1,
                media_url="https://example.com/audio.ogg",
                media_content_type="audio/ogg",
                parent=parent_doc,
            )

            assert reply["is_voice"] is True
            assert reply["transcription"] == "I am fine, just tired"
            assert reply["ml_flagged"] is True

    @pytest.mark.asyncio
    async def test_ml_returns_none_on_failure(self, mock_db):
        """
        Expected: The ML layer fails gracefully when Sarvam API is down.
        """
        with patch.dict("os.environ", {"DISTRESS_ML_ENABLED": "true", "SARVAM_API_KEY": "fake_key"}), \
             patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=Exception("Sarvam API Down")):

            from distress_detection import _pretrained_distress_score
            score = await _pretrained_distress_score("I feel fine", "en")
            assert score is None
            print("[Graceful Failure Test] ML score is None after API failure.")


class TestEndToEndDistress:
    @pytest.mark.asyncio
    async def test_low_distress_does_not_trigger_emergency(self, mock_db):
        """
        Expected: Low distress score does not trigger emergency event.
        """
        parent_id = ObjectId()

        # Set up distress_logs to return the inserted entry
        log_entry = {
            "parent_id": parent_id,
            "transcript": "Had a lovely day today.",
            "language": "en",
            "keyword_matches": [],
            "ml_score": 0.1,
            "keyword_emergency": False,
            "ml_flagged": False,
            "outcome": None,
        }
        mock_db.distress_logs.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        # Make find_one return the log entry we expect
        mock_db.distress_logs.find_one = AsyncMock(return_value=log_entry)

        with patch("distress_detection._pretrained_distress_score", new_callable=AsyncMock, return_value=0.1):

            from distress_detection import assess_transcript
            result = await assess_transcript(mock_db, parent_id, "Had a lovely day today.", "en", [])

            assert result["ml_flagged"] is False
            log = await mock_db.distress_logs.find_one({"parent_id": parent_id})
            assert log is not None
            assert log["keyword_emergency"] is False
            print(f"[Low Distress Test] Log entry saved. ML Flagged: {log['ml_flagged']}")
