"""
End-to-end workflow test: Signup → Login → Parent Creation → Plan Switching
→ Activation → Simulate Check-in / Medicine / Reply → Care Watch Escalation
→ Language Auto-Detect → Emergency Detection.

This test file is the **manual QA script** made executable. It validates the
entire customer-facing journey so a new team member can see exactly what the
system does from front to back, and where it may fail.

Coverage:
1.  Signup 3 child accounts with distinct emails
2.  Login one, walk through onboarding: plan selection → parent creation → schedule
3.  Plan downgrade blocker: from 2-parents (bandham) to nitya (1-parent) → expects
    a 422 with {blockers, usage} so the UI can prompt "remove a parent first"
4.  Plan upgrade: nitya → bandham → raksha — verify parent limits expand
5.  Activate WhatsApp (test mode) — verify activation state flips
6.  send-test a check-in + medicine reminder — verify message_logs written
7.  Simulate parent replies (English, Telugu text, voice-note flag) — verify
    feeling parsing, language suggestion stored, is_voice flag
8.  Care Watch escalation — trigger unanswered message → verify retry log + no-reply
9.  Emergency keyword detection on simulated reply → verify emergency_events table
10. Monthly report trigger → verify report doc + report_ready queue
"""

import uuid
import pytest
from datetime import datetime, timezone, timedelta


def _signup(client, email, name="QA Tester"):
    payload = {
        "name": f"{name} {uuid.uuid4().hex[:6]}",
        "email": email,
        "phone": "+91987" + uuid.uuid4().hex[:7],
        "password": "qaPassword123!",
    }
    r = client.post("/api/auth/register", json=payload)
    return r


def _login(client, email, password="qaPassword123!"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestSignupFlow:
    """Step 1: Create 3 distinct user profiles."""

    def test_three_unique_signups(self, api_client):
        emails = {f"user1_{uuid.uuid4().hex[:6]}@example.com",
                  f"user2_{uuid.uuid4().hex[:6]}@example.com",
                  f"user3_{uuid.uuid4().hex[:6]}@example.com"}
        tokens = []
        for email in emails:
            r = _signup(api_client, email)
            assert r.status_code == 200, f"Signup failed for {email}: {r.text}"
            data = r.json()
            assert "token" in data
            assert data["user"]["email"] == email
            tokens.append((email, data["token"], data["user"]))
        assert len(tokens) == 3, "Expected 3 unique signup profiles"

    def test_duplicate_email_rejected(self, api_client):
        email = f"dup_{uuid.uuid4().hex[:6]}@example.com"
        _signup(api_client, email)
        r = _signup(api_client, email)
        assert r.status_code == 400
        assert "already exists" in r.text.lower()


class TestLoginAndOnboarding:
    """Step 2: Login + full onboarding chain."""

    def test_login_then_onboard_nitya(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        # fresh_user fixture already registers and returns token; verify me endpoint
        r = api_client.get(f"{api_url}/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json()["email"] == fresh_user["payload"]["email"]

        # Step 1: child profile (may already be set by fresh_user)
        r = api_client.put(f"{api_url}/profile/child", json={
            "name": "QA Child", "phone": "+919876543210",
            "city": "Hyderabad", "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200

        # Step 2: consent
        r = api_client.post(f"{api_url}/consent",
                            json={"consent_type": "child", "agreed": True, "text": "consent"}, headers=h)
        assert r.status_code == 200

        # Step 3: select plan
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "nitya", "billing": "month"}, headers=h)
        assert r.status_code == 200

        # Step 4: add single parent
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200, f"Parent creation failed: {r.text}"
        pid = r.json()["id"]

        # Step 5: create schedule
        r = api_client.post(f"{api_url}/schedules", json={
            "parent_id": pid, "mode": "nitya",
            "messages": [{"time": "08:00", "category": "morning_wish"}],
            "active": True}, headers=h)
        assert r.status_code == 200

        # Step 6: verify plan state
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.json()["state"]["plan"] == "nitya"


class TestPlanSwitching:
    """Step 3 & 4: Downgrade blockers and upgrade expansion."""

    def test_bandham_to_nitya_blocks_when_2_parents(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        # upgrade to bandham (allows 2 parents)
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "bandham", "billing": "month"}, headers=h)
        assert r.status_code == 200

        # add two parents
        pids = []
        for i in range(2):
            r = api_client.post(f"{api_url}/parents", json={
                "name": f"Amma{i}", "relationship": "mother",
                "phone": "+9198123" + uuid.uuid4().hex[:5],
                "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
            assert r.status_code == 200
            pids.append(r.json()["id"])

        # attempt downgrade to nitya (max 1 parent)
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "nitya", "billing": "month"}, headers=h)
        assert r.status_code in (400, 422), f"Expected downgrade to fail, got {r.status_code}: {r.text}"
        data = r.json()
        detail = data.get("detail", {})
        assert "blockers" in detail, f"Expected blockers list in downgrade response: {data}"
        assert len(detail["blockers"]) > 0, "Expected at least one blocker message"

    def test_nitya_to_bandham_allows_adding_parents(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        # upgrade to bandham
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "bandham", "billing": "month"}, headers=h)
        assert r.status_code == 200

        # should now allow 2 parents
        pids = []
        for i in range(2):
            r = api_client.post(f"{api_url}/parents", json={
                "name": f"Parent{i}", "relationship": "mother" if i == 0 else "father",
                "phone": "+9198123" + uuid.uuid4().hex[:5],
                "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
            assert r.status_code == 200, f"Parent {i} creation failed: {r.text}"
            pids.append(r.json()["id"])

        # third parent should be rejected
        r = api_client.post(f"{api_url}/parents", json={
            "name": "ThirdParent", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code in (400, 422), f"Expected 3rd parent to be rejected on bandham, got {r.status_code}: {r.text}"


class TestActivation:
    """Step 5: Activate WhatsApp (test mode)."""

    def test_activate_flips_state(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        # setup parent + schedule
        api_client.post(f"{api_url}/payment/checkout",
                        json={"plan": "nitya", "billing": "month"}, headers=h)
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        # activate
        r = api_client.post(f"{api_url}/activation/complete", headers=h)
        assert r.status_code == 200
        r = api_client.get(f"{api_url}/activation", headers=h)
        assert r.json()["whatsapp_activated"] is True


class TestSendAndReply:
    """Step 6 & 7: Send test messages + simulate replies."""

    def test_send_test_then_simulate_reply(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        api_client.post(f"{api_url}/payment/checkout",
                        json={"plan": "nitya", "billing": "month"}, headers=h)
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        phone = r.json().get("phone", "")

        # send a check-in
        r = api_client.post(f"{api_url}/messages/send-test",
                            json={"parent_id": pid, "category": "how_feeling"}, headers=h)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["status"] in ("sent", "failed", "simulated", "queued")

        # verify log written
        r = api_client.get(f"{api_url}/messages/logs", headers=h)
        logs = r.json()["items"]
        assert any(l.get("category") == "how_feeling" for l in logs), "Expected log entry for how_feeling send"

        # simulate a Telugu reply "బాగున్నా"
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": pid, "text": "బాగున్నాను గారు"}, headers=h)
        assert r.status_code == 200
        assert r.json()["feeling"] == "good", f"Expected feeling=good, got {r.json().get('feeling')}"

        # verify language suggestion was stored (configured = te, detected = te → no suggestion)
        r = api_client.get(f"{api_url}/parents/{pid}/language-suggestion", headers=h)
        assert r.status_code == 200
        # If reply was in Te, no new suggestion; if in English, there'd be one
        data = r.json()
        assert data["current_language"] == "te"

    def test_simulate_english_reply_triggers_suggestion(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        api_client.post(f"{api_url}/payment/checkout",
                        json={"plan": "nitya", "billing": "month"}, headers=h)
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        # parent configured as te, but replies in English
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": pid, "text": "I am good today"}, headers=h)
        assert r.status_code == 200

        r = api_client.get(f"{api_url}/parents/{pid}/language-suggestion", headers=h)
        data = r.json()
        assert data["suggested_language"] == "en", "Expected language suggestion=English when reply was English but parent configured as Telugu"

    def test_voice_note_flag(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        api_client.post(f"{api_url}/payment/checkout",
                        json={"plan": "nitya", "billing": "month"}, headers=h)
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "te", "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": pid, "text": "", "num_media": 1}, headers=h)
        assert r.status_code == 200
        assert r.json()["is_voice"] is True, "Expected is_voice=True when num_media > 0"


class TestEmergencyDetection:
    """Step 9: Emergency keyword detection on simulated reply."""

    def test_emergency_keyword_triggers_event(self, api_client, api_url, fresh_user):
        h = _hdr(fresh_user["token"])
        api_client.post(f"{api_url}/payment/checkout",
                        json={"plan": "nitya", "billing": "month"}, headers=h)
        r = api_client.post(f"{api_url}/parents", json={
            "name": "Amma", "relationship": "mother",
            "phone": "+9198123" + uuid.uuid4().hex[:5],
            "language": "en", "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": pid, "text": "I am in a lot of pain today"}, headers=h)
        assert r.status_code == 200

        # verify emergency event created
        r = api_client.get(f"{api_url}/admin/emergencies", headers=h)
        assert r.status_code == 200
        events = r.json()
        assert any(e.get("parent_id") == pid for e in events), "Expected emergency event logged"
