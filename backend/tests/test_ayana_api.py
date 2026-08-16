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
        assert isinstance(data["relationships"], list) and len(data["relationships"]) >= 2
        # message templates map
        assert "morning_wish" in data["message_templates"]
        # plans
        plans = data["plans"]
        assert isinstance(plans, list) and len(plans) >= 3
        plan_ids = {p["id"] for p in plans}
        assert {"nitya", "bandham", "raksha"}.issubset(plan_ids)
        nitya = next(p for p in plans if p["id"] == "nitya")
        raksha = next(p for p in plans if p["id"] == "raksha")
        assert nitya["limits"]["checkins"] == 2
        assert nitya["limits"]["reminders"] == 2
        assert raksha["limits"]["checkins"] == 4
        assert raksha["limits"]["reminders"] == 4
        assert nitya["price"]["INR"]["month"] == 149
        assert raksha["price"]["INR"]["month"] == 429
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
                            json={"email": "admin@ayana.care", "password": "admin@530"})
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
    def test_full_flow_nitya_plan(self, api_client, api_url, fresh_user):
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

        # choose plan FIRST (plan-first onboarding: plan gates parent count)
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "nitya", "billing": "month"}, headers=h)
        assert r.status_code == 200
        j = r.json()
        assert j.get("skipped") is True and j.get("plan") == "nitya"

        # verify plan state
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.status_code == 200
        assert r.json()["state"]["plan"] == "nitya"

        # step 1 - create parent (lowercase relationship, v2 contract)
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_Amma", "relationship": "mother",
                                  "phone": "+919812345678", "language": "te",
                                  "timezone": "Asia/Kolkata", "notes": "care"}, headers=h)
        assert r.status_code == 200, r.text
        parent = r.json()
        assert parent["language"] == "te"
        pid = parent["id"]

        # Nitya allows only ONE parent — adding a second must be rejected
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_Nanna", "relationship": "father",
                                  "phone": "+919812345679", "language": "en",
                                  "timezone": "Asia/Kolkata", "notes": "care"}, headers=h)
        assert r.status_code == 400

        # step 3 - schedule (nitya: 2 checkins + 2 reminders)
        msgs = [
            {"time": "08:00", "category": "morning_wish"},   # checkin
            {"time": "21:00", "category": "goodnight"},      # checkin
            {"time": "09:00", "category": "medicine"},       # reminder
            {"time": "20:00", "category": "water"},          # reminder
        ]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "nitya",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        sched = r.json()
        assert len(sched["messages"]) == 4

        # step 4 - activate (test mode: WhatsApp sends are simulated, not live)
        r = api_client.post(f"{api_url}/activation/activate", headers=h)
        assert r.status_code == 200, r.text
        activated = r.json()
        assert activated["activated"] is True
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
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": plan_id, "billing": "month"}, headers=h)
        assert r.status_code == 200
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_LP", "relationship": "mother",
                                  "phone": "+919812300001", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        assert r.status_code == 200
        pid = r.json()["id"]
        return h, pid

    def test_nitya_rejects_3_checkins(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "nitya")
        msgs = [{"time": f"0{i}:00", "category": "morning_wish"} for i in range(3)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "nitya",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 400
        detail = r.json()["detail"].lower()
        assert "2" in detail and "check" in detail

    def test_nitya_rejects_3_reminders(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "nitya")
        msgs = [{"time": "09:00", "category": "medicine"},
                {"time": "12:00", "category": "water"},
                {"time": "18:00", "category": "bp_check"}]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "nitya",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 400
        assert "2" in r.json()["detail"]

    def test_nitya_accepts_2_checkins_and_2_reminders(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "nitya")
        msgs = [
            {"time": "08:00", "category": "morning_wish"},
            {"time": "21:00", "category": "goodnight"},
            {"time": "09:00", "category": "medicine"},
            {"time": "20:00", "category": "water"},
        ]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "nitya",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        assert len(r.json()["messages"]) == 4

    def test_bandham_allows_4_checkins(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "bandham")
        msgs = [{"time": f"0{i}:00", "category": "morning_wish"} for i in range(4)]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "bandham",
                                  "messages": msgs, "active": True}, headers=h)
        assert r.status_code == 200, r.text
        assert len(r.json()["messages"]) == 4

    def test_empty_messages_rejected(self, api_client, api_url, fresh_user):
        h, pid = self._prep(api_client, api_url, fresh_user, "nitya")
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "nitya",
                                  "messages": [], "active": True}, headers=h)
        assert r.status_code == 400


class TestParentsCRUD:
    def test_parent_update_delete(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_ToEdit", "relationship": "mother",
                                  "phone": "+919812300010", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]

        r = api_client.put(f"{api_url}/parents/{pid}",
                           json={"name": "TEST_Edited", "relationship": "father",
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

    def test_parent_create_with_blank_birthday_does_not_422(self, api_client, api_url, fresh_user):
        # Regression: frontend sends birthday: "" (not omitted) when the
        # optional date picker is left blank. Before the blank_birthday_to_none
        # validator, Pydantic applied the MM-DD regex to "" and rejected it —
        # meaning parent create/update failed for anyone who skipped it.
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_NoBirthday", "relationship": "mother",
                                  "phone": "+919812300020", "language": "en",
                                  "timezone": "Asia/Kolkata", "birthday": ""}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json().get("birthday") in (None, "")

        r2 = api_client.post(f"{api_url}/parents",
                             json={"name": "TEST_WithBirthday", "relationship": "father",
                                   "phone": "+919812300021", "language": "en",
                                   "timezone": "Asia/Kolkata", "birthday": "03-15"}, headers=h)
        assert r2.status_code == 200, r2.text
        assert r2.json()["birthday"] == "03-15"


# ---------------- Schedule toggle/delete ----------------
class TestSchedulesCRUD:
    def test_toggle_and_delete(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        # choose Bandham so we can freely add a schedule
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "bandham", "billing": "month"}, headers=h)
        assert r.status_code == 200
        r = api_client.post(f"{api_url}/parents",
                            json={"name": "TEST_SchP", "relationship": "father",
                                  "phone": "+919812300020", "language": "en",
                                  "timezone": "Asia/Kolkata"}, headers=h)
        pid = r.json()["id"]
        r = api_client.post(f"{api_url}/schedules",
                            json={"parent_id": pid, "mode": "bandham",
                                  "messages": [{"time": "09:00", "category": "morning_wish"}],
                                  "active": True}, headers=h)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        r = api_client.put(f"{api_url}/schedules/{sid}",
                           json={"parent_id": pid, "mode": "bandham",
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
    def test_checkout_bandham_stored(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "bandham", "billing": "year"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "bandham"
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.json()["state"]["plan"] == "bandham"
        assert r.json()["state"]["billing"] == "year"

    def test_checkout_raksha_stored(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "raksha", "billing": "month"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "raksha"

    def test_checkout_invalid_plan_defaults_to_nitya(self, api_client, api_url, fresh_user):
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "unknown_plan", "billing": "month"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "nitya"

    def test_checkout_legacy_alias_resolves(self, api_client, api_url, fresh_user):
        # legacy alias "basic" -> "nitya"
        h = fresh_user["headers"]
        r = api_client.post(f"{api_url}/payment/checkout",
                            json={"plan": "basic", "billing": "month"}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "nitya"
        r = api_client.get(f"{api_url}/payment/state", headers=h)
        assert r.json()["state"]["plan"] == "nitya"


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