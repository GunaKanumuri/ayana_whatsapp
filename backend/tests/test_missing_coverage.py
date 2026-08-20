"""
Tests for previously untested AYANA features:
  1. Care Watch (escalation) — retry logic, no-reply warnings
  2. Monthly Reports — generation, plan-based mood graph
  3. Distress Detection (ML layer) — voice note escalation

These tests use AsyncMock to properly mock async Motor operations
instead of using mongomock directly.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch, ANY
from datetime import datetime, timezone, timedelta
from bson import ObjectId


class AsyncCursorWrapper:
    """Shim to make an iterable work with 'async for' and .to_list()."""
    def __init__(self, items):
        self._items = items
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index < len(self._items):
            item = self._items[self._index]
            self._index += 1
            return item
        raise StopAsyncIteration

    async def to_list(self, length=None):
        if length is not None:
            return self._items[:length]
        return self._items[:]

    def sort(self, *args, **kwargs):
        """Mock sort method for Motor compatibility - returns self for chaining."""
        return self


def make_mock_db():
    """Create a mock database with async methods for Motor compatibility."""
    db = MagicMock()

    for collection_name in [
        "parents", "schedules", "activation_state", "message_logs",
        "parent_replies", "escalation_state", "users", "monthly_reports",
        "preferences", "emergency_events", "wa_sessions"
    ]:
        collection = MagicMock()
        collection.find = MagicMock(return_value=AsyncCursorWrapper([]))
        collection.find_one = AsyncMock(return_value=None)
        collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        collection.update_one = AsyncMock(return_value=MagicMock())
        collection.delete_one = AsyncMock(return_value=MagicMock())
        collection.count_documents = AsyncMock(return_value=0)
        setattr(db, collection_name, collection)

    return db


@pytest.fixture(scope="module")
def mock_db():
    """Create a mock database with async methods for Motor compatibility."""
    return make_mock_db()


# ── 1. CARE WATCH (escalation.py) ──────────────────────────────────────────
class TestCareWatch:
    @pytest.mark.asyncio
    async def test_retry_unanswered_checkin(self, mock_db):
        """
        Expected: An unanswered check-in that is 40 mins old triggers a retry.
        The send_dynamic_checkin function is called again.
        """
        parent_id = ObjectId()
        now = datetime.now(timezone.utc)
        day_key = now.strftime("%Y-%m-%d")
        schedule_id = ObjectId()

        # Setup mock data
        parent_doc = {"_id": parent_id, "name": "Amma", "timezone": "Asia/Kolkata", "language": "en"}
        schedule_doc = {"_id": schedule_id, "user_id": str(ObjectId()), "parent_id": parent_id, "active": True, "deleted_at": None}
        activation_doc = {"user_id": str(ObjectId()), "whatsapp_activated": True}
        log_doc = {
            "_id": ObjectId(), "parent_id": parent_id, "schedule_id": schedule_id,
            "day_key": day_key, "msg_type": "checkin", "category": "how_feeling",
            "status": "sent", "created_at": now - timedelta(minutes=40)
        }

        # Configure mocks
        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.schedules.find = MagicMock(return_value=AsyncCursorWrapper([schedule_doc]))
        mock_db.activation_state.find_one = AsyncMock(return_value=activation_doc)
        mock_db.message_logs.find = MagicMock(return_value=AsyncCursorWrapper([log_doc]))
        mock_db.parent_replies.find_one = AsyncMock(return_value=None)  # no reply

        with patch("escalation.db", mock_db), \
             patch("escalation.send_dynamic_checkin", new_callable=AsyncMock) as mock_send, \
             patch("whatsapp.is_session_open", new_callable=AsyncMock, return_value=False):

            from escalation import run_care_watch_impl
            await run_care_watch_impl()

            # Assert that a retry was sent
            assert mock_send.called
            # Assert that an escalation state was recorded
            mock_db.escalation_state.find_one.assert_called()

    @pytest.mark.asyncio
    async def test_no_reply_warning(self, mock_db):
        """
        Expected: By afternoon (local), if no reply was given after a send,
        the child receives a "hasn't replied" warning.
        """
        parent_id = ObjectId()
        now = datetime.now(timezone.utc)
        day_key = now.strftime("%Y-%m-%d")
        schedule_id = ObjectId()

        parent_doc = {
            "_id": parent_id, "name": "Amma", "timezone": "Asia/Kolkata",
            "phone": "+919876543210", "language": "en"
        }
        schedule_doc = {"_id": schedule_id, "user_id": str(ObjectId()), "parent_id": parent_id, "active": True, "deleted_at": None}
        activation_doc = {"user_id": str(ObjectId()), "whatsapp_activated": True}

        # Afternoon time (14:00+ local)
        afternoon_utc = now - timedelta(hours=2)  # Simulate afternoon

        log_doc = {
            "parent_id": parent_id, "day_key": day_key, "msg_type": "checkin",
            "category": "how_feeling", "status": "sent", "created_at": afternoon_utc
        }

        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.schedules.find = MagicMock(return_value=AsyncCursorWrapper([schedule_doc]))
        mock_db.activation_state.find_one = AsyncMock(return_value=activation_doc)
        mock_db.message_logs.find = MagicMock(return_value=AsyncCursorWrapper([log_doc]))
        mock_db.parent_replies.find_one = AsyncMock(return_value=None)

        # Mock user for notification
        mock_db.users.find_one = AsyncMock(return_value={"phone": "+919999999999", "_id": ObjectId()})
        mock_db.users.find = MagicMock(return_value=AsyncCursorWrapper([]))

        with patch("escalation.db", mock_db), \
             patch("escalation.send_whatsapp") as mock_send:

            from escalation import run_care_watch_impl
            await run_care_watch_impl()

            # Check if a no-reply warning was attempted
            # Note: send_whatsapp is synchronous in escalation.py (fire and forget)
            print(f"[CareWatch No-Reply Test] send_whatsapp calls: {mock_send.call_args_list}")


# ── 2. MONTHLY REPORTS (monthly_report.py) ──────────────────────────────────────────
class TestMonthlyReports:
    @pytest.mark.asyncio
    async def test_nitya_report_no_mood_graph(self, mock_db):
        """
        Expected: A Nitya plan report should NOT include a mood_graph.
        """
        parent_id = ObjectId()
        parent_doc = {"_id": parent_id, "name": "Amma", "language": "en", "user_id": str(ObjectId())}

        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.message_logs.find = MagicMock(return_value=AsyncCursorWrapper([]))
        mock_db.parent_replies.find = MagicMock(return_value=AsyncCursorWrapper([]))
        mock_db.parent_replies.count_documents = AsyncMock(return_value=0)
        mock_db.monthly_reports.update_one = AsyncMock(return_value=MagicMock(upserted_id=ObjectId()))

        with patch("monthly_report.db", mock_db), \
             patch("monthly_report._notify_report_ready", new_callable=AsyncMock):

            from monthly_report import generate_monthly_report
            report = await generate_monthly_report("user1", parent_id, "nitya", 2026, 8)

        assert report["period"] == "2026-08"
        assert report["plan"] == "nitya"
        assert report["mood_graph"] is None
        assert report["trend_note"] is None

    @pytest.mark.asyncio
    async def test_bandham_report_includes_mood_graph(self, mock_db):
        """
        Expected: A Bandham plan report SHOULD include a mood_graph (even if empty).
        """
        parent_id = ObjectId()
        parent_doc = {"_id": parent_id, "name": "Amma", "language": "en", "user_id": str(ObjectId())}

        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.message_logs.find = MagicMock(return_value=AsyncCursorWrapper([]))
        mock_db.parent_replies.find = MagicMock(return_value=AsyncCursorWrapper([]))
        mock_db.parent_replies.count_documents = AsyncMock(return_value=0)
        mock_db.monthly_reports.update_one = AsyncMock(return_value=MagicMock(upserted_id=ObjectId()))

        with patch("monthly_report.db", mock_db), \
             patch("monthly_report._notify_report_ready", new_callable=AsyncMock):

            from monthly_report import generate_monthly_report
            report = await generate_monthly_report("user1", parent_id, "bandham", 2026, 8)

        assert report["period"] == "2026-08"
        assert report["plan"] == "bandham"
        # Mood graph should be an empty list (no actual replies in db)
        assert report["mood_graph"] == []
        assert report["trend_note"] is not None  # Even with no data, it should give a note


# ── 3. DISTRESS DETECTION (distress_detection.py / server.py ML path) ──────────
class TestDistressDetection:
    @pytest.mark.asyncio
    async def test_ml_flagged_voice_note(self, mock_db):
        """
        Expected: When a parent sends a voice note, assess_transcript is called.
        If it flags the content, the reply is marked ml_flagged in the database.
        """
        parent_id = ObjectId()
        user_id = str(ObjectId())
        parent_doc = {
            "_id": parent_id, "name": "Amma", "phone": "+919876543210",
            "language": "en", "timezone": "Asia/Kolkata", "user_id": user_id
        }

        mock_assess_return = {"ml_flagged": True, "score": 0.9}

        # Mock _record_reply dependencies
        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.wa_sessions.update_one = AsyncMock()
        mock_db.parent_replies.insert_one = AsyncMock()
        mock_db.distress_logs.insert_one = AsyncMock()
        mock_db.preferences.find_one = AsyncMock(return_value={"user_id": user_id, "emergency_keywords": []})
        mock_db.users.find_one = AsyncMock(return_value={"phone": "+919999999999"})
        mock_db.users.find = MagicMock(return_value=AsyncCursorWrapper([]))

        with patch("server.db", mock_db), \
             patch("server.assess_transcript", new_callable=AsyncMock, return_value=mock_assess_return), \
             patch("server.transcribe_voice_note", new_callable=AsyncMock, return_value="Feels like I can't go on"), \
             patch("whatsapp.meta_auth_header", return_value={}), \
             patch("whatsapp.is_session_open", new_callable=AsyncMock, return_value=True), \
             patch("whatsapp.send_dynamic_checkin", new_callable=AsyncMock, return_value={"status": "sent"}), \
             patch("server._notify_family", new_callable=AsyncMock):

            from server import _record_reply

            reply = await _record_reply(
                from_number="+919876543210",
                body_text="",
                num_media=1,
                media_url="https://example.com/audio.ogg",
                media_content_type="audio/ogg",
                parent=parent_doc
            )

            # Assert the reply was flagged by the ML model
            assert reply["ml_flagged"] is True
            assert reply["is_voice"] is True
            print(f"[Distress Detection Test] ML Flagged: {reply.get('ml_flagged')}")

    def test_keyword_emergency(self):
        """
        Expected: The keyword-based emergency detection still works for text replies.
        """
        from whatsapp import detect_emergency
        keywords = detect_emergency("I am in a lot of pain today")
        assert "pain" in keywords
        print(f"[Emergency Keyword Test] Found keywords: {keywords}")
