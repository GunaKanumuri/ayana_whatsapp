"""AYANA-BOT backend end-to-end tests: health, auth, onboarding chain, dashboard, admin."""
import uuid
import pytest


# ---------------- Health / config ----------------
class TestHealth:
    def test_root(self, api_client, api_url):
        r = api_client.get(f"{api_url}/")
        assert r.status_code == 200
        data = r.json()
        assert data["app"] == "AYANA-BOT"
        assert data["status"] == "ok"

    def test_config(self, api_client, api_url):
        r = api_client.get(f"{api_url}/config")
        assert r.status_code == 200
        data = r.json()
        assert data["payments_enabled"] is False
        assert data["whatsapp_enabled"] is False
        assert isinstance(data["languages"], list) and len(data["languages"]) == 3
        assert isinstance(data["relationships"], list) and len(data["relationships"]) >= 5
        assert "morning_wish" in data["message_templates"]


# ---------------- Auth ----------------
class TestAuth:
    def test_register_new_user(self, api_client, api_url):
        unique = uuid.uuid4().hex[:8]
        payload = {"name": f"TEST_Reg_{unique}", "email": f"reg_{unique}@example.com",
                   "phone": "+919999900000", "password": "test1234"}
        r = api_client.post(f"{api_url}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == payload["email"]
        assert data["user"]["role"] == "user"
        assert data["user"]["onboarding_complete"] is False
        assert "password_hash" not in data["user"]

    def test_register_duplicate_email(self, api_client, api_url, registered_user):
        r = api_client.post(f"{api_url}/auth/register", json=registered_user["payload"])
        assert r.status_code == 400
        assert "already exists" in r.json()["detail"].lower()

    def test_register_invalid_phone(self, api_client, api_url):
        unique = uuid.uuid4().hex[:8]
        payload = {"name": "TEST_Bad", "email": f"bad_{unique}@example.com",
                   "phone": "9876543210", "password": "test1234"}
        r = api_client.post(f"{api_url}/auth/register", json=payload)
        assert r.status_code == 422

    def test_login_success(self, api_client, api_url, registered_user):
        r = api_client.post(f"{api_url}/auth/login",
                            json={"email": registered_user["payload"]["email"],
                                  "password": registered_user["payload"]["password"]})
        assert r.status_code == 200
        assert "token" in r.json()
        assert r.json()["user"]["email"] == registered_user["payload"]["email"]

    def test_login_wrong_password(self, api_client, api_url, registered_user):
        r = api_client.post(f"{api_url}/auth/login",
                            json={"email": registered_user["payload"]["email"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_admin_login(self, api_client, api_url):
        r = api_client.post(f"{api_url}/auth/login",
                            json={"email": "admin@ayana.care", "password": "AyanaAdmin@2026"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "admin"

    def test_me_requires_auth(self, api_client, api_url):
        r = api_client.get(f"{api_url}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, api_client, api_url, auth_headers, registered_user):
        r = api_client.get(f"{api_url}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == registered_user["payload"]["email"]


# ---------------- Onboarding chain (child -> parent -> schedule -> checkout -> activate) ----------------
class TestOnboardingChain:
    def test_full_flow(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]

        # step 0 - child profile
        child_payload = {"name": "TEST_Child", "phone": "+919876543210",
                         "city": "London", "timezone": "Europe/London"}
        r = api_client.put(f"{api_url}/profile/child", json=child_payload, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["city"] == "London"
        assert r.json()["onboarding_step"] >= 1

        # consent child
        r = api_client.post(f"{api_url}/consent",
                            json={"consent_type": "child", "agreed": True, "text": "consent"}, headers=h)
        assert r.status_code == 200

        # step 1 - create parent
        parent_payload = {"name": "TEST_Amma", "relationship": "Mother",
                          "phone": "+919812345678", "language": "te",
                          "timezone": "Asia/Kolkata", "notes": "care"}
        r = api_client.post(f"{api_url}/parents", json=parent_payload, headers=h)
        assert r.status_code == 200, r.text
        parent = r.json()
        assert parent["name"] == "TEST_Amma"
        assert parent["language"] == "te"
        pid = parent["id"]

        # GET parents lists it
        r = api_client.get(f"{api_url}/parents", headers=h)
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        # step 2 - schedule (normal, 3 messages)
        sched_payload = {
            "parent_id": pid, "mode": "normal", "active": True,
            "messages": [
                {"time": "08:00", "category": "morning_wish"},
                {"time": "13:00", "category": "lunch"},
                {"time": "21:00", "category": "goodnight"},
            ],
        }
        r = api_client.post(f"{api_url}/schedules", json=sched_payload, headers=h)
        assert r.status_code == 200, r.text
        sched = r.json()
        assert sched["mode"] == "normal"
        assert len(sched["messages"]) == 3
        sid = sched["id"]

        # step 3 - checkout (payments disabled -> skipped)
        r = api_client.post(f"{api_url}/payment/checkout", headers=h)
        assert r.status_code == 200
        assert r.json().get("skipped") is True

        # payment state trial
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.status_code == 200
        assert r.json()["payments_enabled"] is False
        assert r.json()["state"]["status"] == "trial"

        # step 4 - activate
        r = api_client.post(f"{api_url}/activation/activate", headers=h)
        assert r.status_code == 200, r.text
        activated = r.json()
        assert activated["activated"] is True
        assert activated["whatsapp_enabled"] is False  # simulated
        assert isinstance(activated["results"], list) and len(activated["results"]) >= 1
        # WHATSAPP_ENABLED=false -> status should be simulated (per problem statement)
        assert activated["results"][0]["status"] in ("simulated", "queued", "sent")

        # activation state
        r = api_client.get(f"{api_url}/activation", headers=h)
        assert r.status_code == 200
        assert r.json()["whatsapp_activated"] is True

        # user now has onboarding_complete
        r = api_client.get(f"{api_url}/auth/me", headers=h)
        assert r.json()["onboarding_complete"] is True

        # keep ids for downstream tests
        fresh_user["parent_id"] = pid
        fresh_user["schedule_id"] = sid


# ---------------- Schedule mode limits ----------------
class TestScheduleValidation:
    def test_normal_mode_caps_at_5(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        # Create parent first
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_P", "relationship": "Father",
                                  "phone": "+919812300001", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200
        pid = r.json()["id"]
        # 6 messages in normal -> 400
        msgs = [{"time": f"0{i}:00", "category": "morning_wish"} for i in range(6)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 400
        assert "5" in r.json()["detail"]

    def test_care_plus_allows_10(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_P2", "relationship": "Mother",
                                  "phone": "+919812300002", "language": "hi",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        msgs = [{"time": f"{i:02d}:00", "category": "morning_wish"} for i in range(10)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "care_plus",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200
        assert len(r.json()["messages"]) == 10

    def test_empty_messages_rejected(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_P3", "relationship": "Aunt",
                                  "phone": "+919812300003", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": [], "active": True}, headers=h)
        assert r.status_code == 400


# ---------------- Parents CRUD ----------------
class TestParentsCRUD:
    def test_parent_update_delete(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_ToEdit", "relationship": "Mother",
                                  "phone": "+919812300010", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        # update
        r = api_client.put(f"{api_url}/parents/{pid}",
                           json={"name": "TEST_Edited", "relationship": "Grandmother",
                                 "phone": "+919812300011", "language": "hi",
                                 "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Edited"
        assert r.json()["language"] == "hi"

        # verify persisted via list
        r = api_client.get(f"{api_url}/parents", headers=h)
        found = [p for p in r.json() if p["id"] == pid]
        assert found and found[0]["name"] == "TEST_Edited"

        # delete
        r = api_client.delete(f"{api_url}/parents/{pid}", headers=h)
        assert r.status_code == 200

        # verify removed from list
        r = api_client.get(f"{api_url}/parents", headers=h)
        assert not any(p["id"] == pid for p in r.json())


# ---------------- Schedule update/toggle/delete ----------------
class TestSchedulesCRUD:
    def test_toggle_and_delete_schedule(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        # create parent + schedule
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_SchP", "relationship": "Father",
                                  "phone": "+919812300020", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": [{"time": "09:00", "category": "morning_wish"}],
                                  "active": True}, headers=h)
        assert r.status_code == 200
        sid = r.json()["id"]

        # toggle active off via update
        r = api_client.put(f"{api_url}/schedules/{sid}",
                           json={"parent_id": pid, "mode": "normal",
                                 "messages": [{"time": "09:00", "category": "morning_wish"}],
                                 "active": False}, headers=h)
        assert r.status_code == 200
        assert r.json()["active"] is False

        # delete
        r = api_client.delete(f"{api_url}/schedules/{sid}", headers=h)
        assert r.status_code == 200

        # verify not listed
        r = api_client.get(f"{api_url}/schedules", headers=h)
        assert not any(s["id"] == sid for s in r.json())


# ---------------- Messages preview + logs ----------------
class TestMessages:
    def test_preview_message(self, api_client, api_url, auth_headers):
        r = api_client.post(f"{api_url}/messages/preview",
                            json={"category": "morning_wish", "language": "te", "name": "Amma"},
                            headers=auth_headers)
        assert r.status_code == 200
        assert "text" in r.json() and len(r.json()["text"]) > 0

    def test_message_logs_returns_list(self, api_client, api_url, auth_headers):
        r = api_client.get(f"{api_url}/messages/logs", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_stats(self, api_client, api_url, admin_headers):
        r = api_client.get(f"{api_url}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("total_users", "completed_onboarding", "activated", "parents",
                  "active_schedules", "messages_delivered", "open_emergencies", "whatsapp_enabled"):
            assert k in data
        assert isinstance(data["total_users"], int)

    def test_admin_users(self, api_client, api_url, admin_headers):
        r = api_client.get(f"{api_url}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        if users:
            u = users[0]
            for k in ("id", "email", "activated", "parents_count", "schedules_count"):
                assert k in u

    def test_admin_messages(self, api_client, api_url, admin_headers):
        r = api_client.get(f"{api_url}/admin/messages", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_emergencies(self, api_client, api_url, admin_headers):
        r = api_client.get(f"{api_url}/admin/emergencies", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_requires_admin_role(self, api_client, api_url, auth_headers):
        r = api_client.get(f"{api_url}/admin/stats", headers=auth_headers)
        assert r.status_code == 403


# ---------------- Account delete ----------------
class TestAccountDelete:
    def test_delete_account(self, api_client, api_url):
        # Register a throwaway user
        unique = uuid.uuid4().hex[:8]
        payload = {"name": f"TEST_Del_{unique}", "email": f"del_{unique}@example.com",
                   "phone": "+919877700000", "password": "test1234"}
        r = api_client.post(f"{api_url}/auth/register", json=payload)
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # delete
        r = api_client.delete(f"{api_url}/account", headers=h)
        assert r.status_code == 200

        # subsequent /auth/me should fail (user has deleted_at)
        r = api_client.get(f"{api_url}/auth/me", headers=h)
        assert r.status_code == 401
