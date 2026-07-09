"""AYANA-BOT backend end-to-end tests (iteration 2 — plans + conversational templates).
Covers: health/config, auth, onboarding chain, plan-based schedule limits,
conversational preview with reply footer, parents/schedules CRUD, admin.
"""
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

    def test_config_returns_plans_currencies_categories(self, api_client, api_url):
        r = api_client.get(f"{api_url}/config")
        assert r.status_code == 200
        data = r.json()
        # feature flags
        assert data["payments_enabled"] is False
        # WhatsApp is now LIVE
        assert data["whatsapp_enabled"] is True
        # languages / relationships
        assert isinstance(data["languages"], list) and len(data["languages"]) == 3
        assert isinstance(data["relationships"], list) and len(data["relationships"]) >= 5
        # message templates map
        assert "morning_wish" in data["message_templates"]
        # new: plans
        plans = data["plans"]
        assert isinstance(plans, list) and len(plans) >= 2
        plan_ids = {p["id"] for p in plans}
        assert {"basic", "care_plus"}.issubset(plan_ids)
        basic = next(p for p in plans if p["id"] == "basic")
        care = next(p for p in plans if p["id"] == "care_plus")
        assert basic["limits"]["checkins"] == 3
        assert basic["limits"]["reminders"] == 2
        assert care["limits"]["checkins"] == 10
        assert care["limits"]["reminders"] == 10
        assert basic["price"]["INR"]["month"] == 149
        assert care["price"]["INR"]["month"] == 399
        # new: currencies
        currencies = data["currencies"]
        assert isinstance(currencies, list) and any(c["code"] == "INR" for c in currencies)
        assert any(c["code"] == "USD" for c in currencies)
        # new: categories with type
        cats = data["categories"]
        cat_map = {c["key"]: c for c in cats}
        assert cat_map["morning_wish"]["type"] == "checkin"
        assert cat_map["medicine"]["type"] == "reminder"
        # training video url (may be empty)
        assert "training_video_url" in data


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


# ---------------- Onboarding chain (child -> parent -> plan -> schedule -> activate) ----------------
class TestOnboardingChain:
    def test_full_flow_basic_plan(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]

        # step 0 - child profile
        r = api_client.put(f"{api_url}/profile/child",
                           json={"name": "TEST_Child", "phone": "+919876543210",
                                 "city": "London", "timezone": "Europe/London"}, headers=h)
        assert r.status_code == 200
        assert r.json()["city"] == "London"
        assert r.json()["onboarding_step"] >= 1

        # consent child
        r = api_client.post(f"{api_url}/consent",
                            json={"consent_type": "child", "agreed": True, "text": "consent"}, headers=h)
        assert r.status_code == 200

        # step 1 - create parent
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_Amma", "relationship": "Mother",
                                  "phone": "+919812345678", "language": "te",
                                  "timezone": "Asia/Kolkata", "notes": "care"}, headers=h)
        assert r.status_code == 200, r.text
        parent = r.json()
        assert parent["language"] == "te"
        pid = parent["id"]

        # step 2 - choose plan: BASIC via checkout (payments disabled -> stored)
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "basic", "billing": "month"}, headers=h)
        assert r.status_code == 200
        j = r.json()
        assert j.get("skipped") is True and j.get("plan") == "basic"

        # verify plan state
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.status_code == 200
        assert r.json()["state"]["plan"] == "basic"

        # step 3 - schedule (basic: 3 checkins + 2 reminders)
        msgs = [
            {"time": "08:00", "category": "morning_wish"},   # checkin
            {"time": "13:00", "category": "lunch"},          # checkin
            {"time": "21:00", "category": "goodnight"},      # checkin
            {"time": "09:00", "category": "medicine"},       # reminder
            {"time": "20:00", "category": "water"},          # reminder
        ]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        sched = r.json()
        assert len(sched["messages"]) == 5

        # step 4 - activate (WHATSAPP is live but recipient not joined -> "failed" acceptable)
        r = api_client.post(f"{api_url}/activation/activate", headers=h)
        assert r.status_code == 200, r.text
        activated = r.json()
        assert activated["activated"] is True
        assert activated["whatsapp_enabled"] is True
        assert isinstance(activated["results"], list) and len(activated["results"]) >= 1
        assert activated["results"][0]["status"] in ("simulated", "queued", "sent", "failed")

        # activation state
        r = api_client.get(f"{api_url}/activation", headers=h)
        assert r.status_code == 200
        assert r.json()["whatsapp_activated"] is True

        # user now has onboarding_complete
        r = api_client.get(f"{api_url}/auth/me", headers=h)
        assert r.json()["onboarding_complete"] is True


# ---------------- Plan-based schedule limits ----------------
class TestPlanLimits:
    def _prep(self, api_client, api_url, fresh_user, plan_id):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_LP", "relationship": "Mother",
                                  "phone": "+919812300001", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200
        pid = r.json()["id"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": plan_id, "billing": "month"}, headers=h)
        assert r.status_code == 200
        return h, pid

    def test_basic_rejects_4_checkins(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "basic")
        msgs = [{"time": f"0{i}:00", "category": "morning_wish"} for i in range(4)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 400
        detail = r.json()["detail"].lower()
        assert "3" in detail and "check" in detail

    def test_basic_rejects_3_reminders(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "basic")
        msgs = [{"time": "09:00", "category": "medicine"},
                {"time": "12:00", "category": "water"},
                {"time": "18:00", "category": "bp_check"}]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 400
        assert "2" in r.json()["detail"]

    def test_basic_accepts_3_checkins_and_2_reminders(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "basic")
        msgs = [
            {"time": "08:00", "category": "morning_wish"},
            {"time": "13:00", "category": "lunch"},
            {"time": "21:00", "category": "goodnight"},
            {"time": "09:00", "category": "medicine"},
            {"time": "20:00", "category": "water"},
        ]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "normal",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        assert len(r.json()["messages"]) == 5

    def test_care_plus_allows_10_checkins(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "care_plus")
        msgs = [{"time": f"{i:02d}:00", "category": "morning_wish"} for i in range(10)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "care_plus",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        assert len(r.json()["messages"]) == 10

    def test_empty_messages_rejected(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "basic")
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

        r = api_client.put(f"{api_url}/parents/{pid}",
                           json={"name": "TEST_Edited", "relationship": "Grandmother",
                                 "phone": "+919812300011", "language": "hi",
                                 "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Edited"

        r = api_client.get(f"{api_url}/parents", headers=h)
        assert any(p["id"] == pid and p["name"] == "TEST_Edited" for p in r.json())

        r = api_client.delete(f"{api_url}/parents/{pid}", headers=h)
        assert r.status_code == 200

        r = api_client.get(f"{api_url}/parents", headers=h)
        assert not any(p["id"] == pid for p in r.json())


# ---------------- Schedule toggle/delete ----------------
class TestSchedulesCRUD:
    def test_toggle_and_delete(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        # choose Care+ so we can freely add a schedule
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "care_plus", "billing": "month"}, headers=h)
        assert r.status_code == 200
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_SchP", "relationship": "Father",
                                  "phone": "+919812300020", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "care_plus",
                                  "messages": [{"time": "09:00", "category": "morning_wish"}],
                                  "active": True}, headers=h)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        r = api_client.put(f"{api_url}/schedules/{sid}",
                           json={"parent_id": pid, "mode": "care_plus",
                                 "messages": [{"time": "09:00", "category": "morning_wish"}],
                                 "active": False}, headers=h)
        assert r.status_code == 200
        assert r.json()["active"] is False

        r = api_client.delete(f"{api_url}/schedules/{sid}", headers=h)
        assert r.status_code == 200
        r = api_client.get(f"{api_url}/schedules", headers=h)
        assert not any(s["id"] == sid for s in r.json())


# ---------------- Messages preview (conversational + reply footer) ----------------
class TestMessagesPreview:
    def test_preview_telugu_checkin_has_reply_footer(self, api_client, api_url, auth_headers):
        r = api_client.post(f"{api_url}/messages/preview",
                            json={"category": "how_feeling", "language": "te", "name": "Amma"},
                            headers=auth_headers)
        assert r.status_code == 200
        text = r.json()["text"]
        assert "అమ్మా" in text or "Amma" in text
        # Reply footer (Telugu) includes 👉 arrow and రిప్లై keyword
        assert "👉" in text
        assert "రిప్లై" in text

    def test_preview_english_reminder_has_footer(self, api_client, api_url, auth_headers):
        r = api_client.post(f"{api_url}/messages/preview",
                            json={"category": "medicine", "language": "en", "name": "Amma"},
                            headers=auth_headers)
        assert r.status_code == 200
        text = r.json()["text"]
        assert "👉" in text
        low = text.lower()
        # reminder footer contains "done" and "not yet"
        assert "done" in low and "not yet" in low

    def test_preview_hindi_checkin_has_footer(self, api_client, api_url, auth_headers):
        r = api_client.post(f"{api_url}/messages/preview",
                            json={"category": "morning_wish", "language": "hi", "name": "Amma"},
                            headers=auth_headers)
        assert r.status_code == 200
        text = r.json()["text"]
        assert "अम्मा" in text
        assert "👉" in text

    def test_message_logs_returns_list(self, api_client, api_url, auth_headers):
        r = api_client.get(f"{api_url}/messages/logs", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Payment / plan selection ----------------
class TestPayment:
    def test_checkout_care_plus_stored(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "care_plus", "billing": "year"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "care_plus"
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.json()["state"]["plan"] == "care_plus"
        assert r.json()["state"]["billing"] == "year"

    def test_checkout_invalid_plan_defaults_to_basic(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "unknown_plan", "billing": "month"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "basic"


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
        assert data["whatsapp_enabled"] is True

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
        unique = uuid.uuid4().hex[:8]
        payload = {"name": f"TEST_Del_{unique}", "email": f"del_{unique}@example.com",
                   "phone": "+919877700000", "password": "test1234"}
        r = api_client.post(f"{api_url}/auth/register", json=payload)
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = api_client.delete(f"{api_url}/account", headers=h)
        assert r.status_code == 200
        r = api_client.get(f"{api_url}/auth/me", headers=h)
        assert r.status_code == 401
