"""Iteration 3 — Care Circle (co-care) + Send test check-in.

Covers:
- POST /api/messages/send-test writes a message_log and returns a status
- Care+ owner can GET /circle (role=owner), invite by email, list invites,
  cancel invite, and remove a member.
- Basic plan owner is blocked from invite (403).
- Auto-link on register: an invited email registers -> becomes member,
  onboarding_complete=true, household_owner_id set, and sees the OWNER's
  parents/schedules.
- Member cannot change plan / invite (403).
"""
import uuid
import pytest


# ---------- helpers ----------
def _register(client, api, email=None, name="TEST_Circle"):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"{name}_{unique}",
        "email": email or f"c_{unique}@example.com",
        "phone": "+919812345000",
        "password": "test1234",
    }
    r = client.post(f"{api}/auth/register", json=payload)
    r.raise_for_status()
    data = r.json()
    return {
        "payload": payload,
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"},
    }


def _make_owner_with_parent(client, api, plan="raksha"):
    owner = _register(client, api, name="TEST_Owner")
    h = owner["headers"]
    # choose raksha (payments disabled -> stored)
    r = client.post(f"{api}/payment/checkout", json={"plan": plan, "billing": "month"}, headers=h)
    assert r.status_code == 200
    # create parent (lowercase relationship per v2 backend contract)
    r = client.post(f"{api}/parents", json={
        "name": "TEST_OwnerAmma", "relationship": "mother",
        "phone": "+919812399000", "language": "te", "timezone": "Asia/Kolkata",
    }, headers=h)
    assert r.status_code == 200, r.text
    parent = r.json()
    # create a schedule too (mode = plan id, per v2 contract)
    r = client.post(f"{api}/schedules", json={
        "parent_id": parent["id"], "mode": "raksha",
        "messages": [{"time": "09:00", "category": "morning_wish"}],
        "active": True,
    }, headers=h)
    assert r.status_code == 200, r.text
    schedule = r.json()
    return owner, parent, schedule


# ---------------- Send test check-in ----------------
class TestSendTest:
    def test_send_test_returns_status_and_logs(self, api_client, api_url):
        owner, parent, _ = _make_owner_with_parent(api_client, api_url)
        h = owner["headers"]
        r = api_client.post(f"{api_url}/messages/send-test",
                            json={"parent_id": parent["id"], "category": "how_feeling"},
                            headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] in ("sent", "failed", "simulated", "queued")
        assert isinstance(data.get("text"), str) and len(data["text"]) > 0
        # Message rendered in parent's language (te) — should include reply footer arrow
        assert "👉" in data["text"]

        # verify message log written
        r = api_client.get(f"{api_url}/messages/logs", headers=h)
        assert r.status_code == 200
        logs = r.json()
        assert any(l.get("category") == "how_feeling" and l.get("body") == data["text"] for l in logs)

    def test_send_test_medicine_reminder(self, api_client, api_url):
        owner, parent, _ = _make_owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/messages/send-test",
                            json={"parent_id": parent["id"], "category": "medicine"},
                            headers=owner["headers"])
        assert r.status_code == 200
        assert r.json()["status"] in ("sent", "failed", "simulated", "queued")

    def test_send_test_parent_not_found(self, api_client, api_url, fresh_user):
        r = api_client.post(f"{api_url}/messages/send-test",
                            json={"parent_id": "507f1f77bcf86cd799439011", "category": "how_feeling"},
                            headers=fresh_user["headers"])
        assert r.status_code == 404


# ---------------- Care Circle: Raksha owner (only plan with family_members > 0) ----------------
class TestRakshaCircle:
    def test_raksha_get_circle(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "owner"
        assert data["plan"] == "raksha"
        assert data["max_members"] == 2
        assert isinstance(data["members"], list)
        assert isinstance(data["invites"], list)

    def test_raksha_invite_and_list(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        invitee = f"sib_{uuid.uuid4().hex[:8]}@example.com"
        r = api_client.post(f"{api_url}/circle/invite", json={"email": invitee}, headers=owner["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["email"] == invitee

        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        invites = r.json()["invites"]
        assert any(i["email"] == invitee for i in invites)

    def test_invite_duplicate_rejected(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        email = f"dup_{uuid.uuid4().hex[:6]}@example.com"
        r = api_client.post(f"{api_url}/circle/invite", json={"email": email}, headers=owner["headers"])
        assert r.status_code == 200
        r = api_client.post(f"{api_url}/circle/invite", json={"email": email}, headers=owner["headers"])
        assert r.status_code == 400
        assert "already invited" in r.json()["detail"].lower()

    def test_invite_own_email_rejected(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        r = api_client.post(f"{api_url}/circle/invite",
                            json={"email": owner["payload"]["email"]}, headers=owner["headers"])
        assert r.status_code == 400

    def test_invite_bad_email(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        r = api_client.post(f"{api_url}/circle/invite", json={"email": "notanemail"}, headers=owner["headers"])
        assert r.status_code == 400

    def test_cancel_invite(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        email = f"cancel_{uuid.uuid4().hex[:6]}@example.com"
        r = api_client.post(f"{api_url}/circle/invite", json={"email": email}, headers=owner["headers"])
        assert r.status_code == 200
        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        inv = next(i for i in r.json()["invites"] if i["email"] == email)
        r = api_client.delete(f"{api_url}/circle/invite/{inv['id']}", headers=owner["headers"])
        assert r.status_code == 200
        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        assert not any(i["email"] == email for i in r.json()["invites"])


# ---------------- Non-Raksha plan: invite blocked ----------------
class TestNonRakshaPlanBlocked:
    def test_bandham_owner_cannot_invite(self, api_client, api_url, fresh_user):
        # Bandham has family_members=0, so invites are blocked
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "bandham", "billing": "month"},
                            headers=fresh_user["headers"])
        assert r.status_code == 200
        r = api_client.post(f"{api_url}/circle/invite",
                            json={"email": f"nope_{uuid.uuid4().hex[:6]}@example.com"},
                            headers=fresh_user["headers"])
        assert r.status_code == 403
        detail = r.json()["detail"].lower()
        assert "raksha" in detail or "upgrade" in detail


# ---------------- Auto-link on register + shared household ----------------
class TestAutoLinkOnRegister:
    def test_invited_email_becomes_member_on_register(self, api_client, api_url):
        owner, parent, schedule = _make_owner_with_parent(api_client, api_url, plan="raksha")
        invitee_email = f"member_{uuid.uuid4().hex[:8]}@example.com"

        # owner invites
        r = api_client.post(f"{api_url}/circle/invite", json={"email": invitee_email}, headers=owner["headers"])
        assert r.status_code == 200

        # invitee registers with that email
        payload = {"name": "TEST_Member", "email": invitee_email,
                   "phone": "+919812301111", "password": "test1234"}
        r = api_client.post(f"{api_url}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        member = r.json()
        assert member["user"]["onboarding_complete"] is True
        assert member["user"].get("household_owner_id") == owner["user"]["id"]

        mh = {"Authorization": f"Bearer {member['token']}", "Content-Type": "application/json"}

        # member sees OWNER's parent
        r = api_client.get(f"{api_url}/parents", headers=mh)
        assert r.status_code == 200
        parents = r.json()
        assert any(p["id"] == parent["id"] for p in parents)

        # member sees OWNER's schedule
        r = api_client.get(f"{api_url}/schedules", headers=mh)
        assert r.status_code == 200
        assert any(s["id"] == schedule["id"] for s in r.json())

        # /circle shows role=member with owner info
        r = api_client.get(f"{api_url}/circle", headers=mh)
        assert r.status_code == 200
        cdata = r.json()
        assert cdata["role"] == "member"
        assert cdata["owner"]["email"] == owner["payload"]["email"]

        # owner's /circle shows the accepted member
        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        assert any(m["email"] == invitee_email for m in r.json()["members"])

        # member cannot change plan (non-raksha plans)
        r = api_client.post(f"{api_url}/payment/checkout", json={"plan": "nitya"}, headers=mh)
        assert r.status_code == 403

        # member cannot invite others
        r = api_client.post(f"{api_url}/circle/invite",
                            json={"email": f"other_{uuid.uuid4().hex[:6]}@example.com"}, headers=mh)
        assert r.status_code == 403

    def test_owner_can_remove_member(self, api_client, api_url):
        owner, _, _ = _make_owner_with_parent(api_client, api_url, plan="raksha")
        invitee_email = f"toremove_{uuid.uuid4().hex[:8]}@example.com"
        api_client.post(f"{api_url}/circle/invite", json={"email": invitee_email}, headers=owner["headers"])
        # invitee registers -> becomes member
        r = api_client.post(f"{api_url}/auth/register", json={
            "name": "TEST_ToRemove", "email": invitee_email,
            "phone": "+919812302222", "password": "test1234",
        })
        assert r.status_code == 200
        member_id = r.json()["user"]["id"]

        # remove
        r = api_client.delete(f"{api_url}/circle/member/{member_id}", headers=owner["headers"])
        assert r.status_code == 200

        # owner no longer sees them as a member
        r = api_client.get(f"{api_url}/circle", headers=owner["headers"])
        assert not any(m["id"] == member_id for m in r.json()["members"])

        # detached user can no longer see owner's parents (their own scope is empty)
        member_token = None
        r = api_client.post(f"{api_url}/auth/login", json={"email": invitee_email, "password": "test1234"})
        assert r.status_code == 200
        member_token = r.json()["token"]
        mh = {"Authorization": f"Bearer {member_token}", "Content-Type": "application/json"}
        r = api_client.get(f"{api_url}/parents", headers=mh)
        assert r.status_code == 200
        # should now be empty (own scope, no parents created)
        assert r.json() == []
