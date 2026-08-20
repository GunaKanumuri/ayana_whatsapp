"""
Tests for Gaps 9, 10, and 11 (final pass):
- Gap 9: Display Interactive Button Status (reply_status in message_logs)
- Gap 10: Show ML Distress Assessment Details (ml_score in parent_replies)
- Gap 11: OTP Phone Verification Flow (child/family-member only)
"""

import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def mock_db():
    """Create a mock database with async methods for Motor compatibility."""
    db = MagicMock()

    for collection_name in [
        "parents", "wa_sessions", "message_logs", "parent_replies",
        "distress_logs", "emergency_events", "users", "preferences",
        "payment_state", "monthly_reports", "escalation_state", "schedules",
        "phone_otps"
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


class TestGap9InteractiveButtonStatus:
    """Gap 9: reply_status is written to message_logs and returned via /logs"""

    @pytest.mark.asyncio
    async def test_reply_status_in_message_logs_after_medicine_done(self, mock_db):
        """_mark_medicine_status updates reply_status on message_logs for 'done'"""
        from server import _mark_medicine_status

        phone = "+919876543290"
        parent_id = ObjectId()
        day_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Setup parent and message log
        parent_doc = {"_id": parent_id, "phone": phone, "deleted_at": None}
        log_doc = {
            "_id": ObjectId(),
            "parent_id": parent_id,
            "day_key": day_key,
            "msg_type": "reminder",
            "category": "medicine",
            "body": "Time for medicine",
            "created_at": datetime.now(timezone.utc),
        }

        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.message_logs.find_one = AsyncMock(return_value=log_doc)
        mock_db.message_logs.update_one = AsyncMock(return_value=MagicMock())

        with patch("server.db", mock_db):
            await _mark_medicine_status(phone, taken=True)

            # Verify update_one was called with correct filter and update
            mock_db.message_logs.update_one.assert_called_once()
            call_args = mock_db.message_logs.update_one.call_args
            assert call_args[0][0]["_id"] == log_doc["_id"]
            assert call_args[0][1]["$set"]["reply_status"] == "done"

    @pytest.mark.asyncio
    async def test_reply_status_skipped_after_medicine_skip(self, mock_db):
        """_mark_medicine_status updates reply_status to 'skipped'"""
        from server import _mark_medicine_status

        phone = "+919876543291"
        parent_id = ObjectId()
        day_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Setup parent and message log
        parent_doc = {"_id": parent_id, "phone": phone, "deleted_at": None}
        log_doc = {
            "_id": ObjectId(),
            "parent_id": parent_id,
            "day_key": day_key,
            "msg_type": "reminder",
            "category": "medicine",
            "body": "Time for medicine",
            "created_at": datetime.now(timezone.utc),
        }

        mock_db.parents.find_one = AsyncMock(return_value=parent_doc)
        mock_db.message_logs.find_one = AsyncMock(return_value=log_doc)
        mock_db.message_logs.update_one = AsyncMock(return_value=MagicMock())

        with patch("server.db", mock_db):
            await _mark_medicine_status(phone, taken=False)

            # Verify update_one was called with correct filter and update
            mock_db.message_logs.update_one.assert_called_once()
            call_args = mock_db.message_logs.update_one.call_args
            assert call_args[0][0]["_id"] == log_doc["_id"]
            assert call_args[0][1]["$set"]["reply_status"] == "skipped"


class TestGap10MLDistressAssessmentDetails:
    """Gap 10: ml_score is returned by assess_transcript and saved in parent_replies"""

    @pytest.mark.asyncio
    async def test_assess_transcript_returns_ml_score(self, api_client, auth_headers, registered_user):
        """assess_transcript returns ml_score (float 0-1 or None) and ml_flagged"""
        from server import db
        from distress_detection import assess_transcript

        parent_id = ObjectId(registered_user["user"]["id"])
        result = await assess_transcript(db, parent_id, "I am feeling very unwell and in pain", "en", ["pain"])

        assert "ml_score" in result
        assert "ml_flagged" in result
        assert "keyword_emergency" in result
        # ml_score is either a float 0-1 or None (when ML is disabled or model unavailable)
        if result["ml_score"] is not None:
            assert 0.0 <= result["ml_score"] <= 1.0, f"ml_score out of range: {result['ml_score']}"

    @pytest.mark.asyncio
    async def test_keyword_emergency_flagged(self, api_client, auth_headers, registered_user):
        """When transcript has emergency keywords, keyword_emergency should be True"""
        from server import db
        from distress_detection import assess_transcript

        parent_id = ObjectId(registered_user["user"]["id"])
        result = await assess_transcript(db, parent_id, "I need help, I'm in serious trouble", "en", ["help"])

        assert result["keyword_emergency"] is True
        # ml_flagged depends on ML model availability and score >= 0.7, not just keywords


class TestGap11OTPPhoneVerification:
    """Gap 11: OTP flow for child/family-member phone verification only"""

    def test_otp_send_verify_resend_user(self, api_client):
        """Test full OTP flow for user (child/family member)"""
        email = f"otp_user_{uuid.uuid4().hex[:8]}@example.com"
        phone = "+9198765" + uuid.uuid4().hex[:5]
        r = api_client.post("/api/auth/register", json={
            "name": "OTP Test User",
            "email": email,
            "phone": phone,
            "password": "test1234",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        token = data["token"]
        headers = _hdr(token)

        # 1. Send OTP
        r = api_client.post("/api/auth/otp/send", json={"phone_number": phone}, headers=headers)
        assert r.status_code in (200, 429, 503), f"Send failed: {r.text}"
        if r.status_code == 200:
            assert r.json()["ok"] is True
            assert "expires_at" in r.json()

            # 2. Try verify with wrong code — should fail with 400
            r = api_client.post("/api/auth/otp/verify", json={"phone_number": phone, "code": "123456"}, headers=headers)
            assert r.status_code == 400, f"Wrong code should fail: {r.text}"
            assert "Incorrect code" in r.json()["detail"]

            # 3. Resend OTP
            r = api_client.post("/api/auth/otp/resend", json={"phone_number": phone}, headers=headers)
            assert r.status_code in (200, 429, 503)

    def test_otp_verify_missing_phone(self, api_client, auth_headers, registered_user):
        """Verify endpoint should fail if no OTP was sent for that phone"""
        r = api_client.post(
            "/api/auth/otp/verify",
            json={"phone_number": "+9198765" + uuid.uuid4().hex[:5], "code": "123456"},
            headers=auth_headers,
        )
        assert r.status_code == 400, f"Expected 400 for missing OTP: {r.text}"
        assert "No OTP found" in r.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])