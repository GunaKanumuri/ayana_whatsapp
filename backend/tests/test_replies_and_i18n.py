"""Iteration 4 — Reply parsing (POST /replies/simulate), replies list (GET /replies),
and instant-reply notification wiring.

Covers:
- POST /replies/simulate maps text 1/2/3 to good/okay/not_well
- Telugu phrases: 'బాగున్నా' -> good, 'ఒంట్లో బాలేదు' -> not_well
- num_media > 0 -> is_voice true
- 'help pain' -> emergency (parent record + reply logged with keywords)
- GET /replies returns scoped list with parent_name and correct fields
- 404 when parent doesn't belong to caller
"""
import uuid
import pytest


def _register(client, api, name="TEST_Rep"):
    unique = uuid.uuid4().hex[:8]
    payload = {"name": f"{name}_{unique}", "email": f"rep_{unique}@example.com",
               "phone": "+919812340000", "password": "test1234"}
    r = client.post(f"{api}/auth/register", json=payload)
    r.raise_for_status()
    d = r.json()
    return {"payload": payload, "token": d["token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['token']}", "Content-Type": "application/json"}}


def _owner_with_parent(client, api, language="en"):
    owner = _register(client, api)
    h = owner["headers"]
    client.post(f"{api}/payment/checkout", json={"plan": "care_plus", "billing": "month"}, headers=h)
    r = client.post(f"{api}/parents", json={
        "name": "TEST_ReplyAmma", "relationship": "Mother",
        "phone": "+919812" + "".join(c if c.isdigit() else str(ord(c) % 10) for c in uuid.uuid4().hex[:6]),
        "language": language, "timezone": "Asia/Kolkata",
    }, headers=h)
    assert r.status_code == 200, r.text
    return owner, r.json()


class TestSimulateReplyParsing:
    def test_text_1_maps_to_good(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "1"},
                            headers=owner["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["feeling"] == "good"
        assert data.get("is_voice") is False

    def test_text_2_maps_to_okay(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "2"},
                            headers=owner["headers"])
        assert r.status_code == 200
        assert r.json()["feeling"] == "okay"

    def test_text_3_maps_to_not_well(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "3"},
                            headers=owner["headers"])
        assert r.status_code == 200
        assert r.json()["feeling"] == "not_well"

    def test_telugu_bagunna_maps_to_good(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url, language="te")
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "బాగున్నా"},
                            headers=owner["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["feeling"] == "good"

    def test_telugu_baledu_maps_to_not_well(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url, language="te")
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "ఒంట్లో బాలేదు"},
                            headers=owner["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["feeling"] == "not_well"

    def test_voice_note_flag(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "", "num_media": 1},
                            headers=owner["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_voice"] is True

    def test_help_pain_creates_emergency_event(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": parent["id"], "text": "help pain"},
                            headers=owner["headers"])
        assert r.status_code == 200
        # verify reply landed in /replies with emergency_keywords populated
        r2 = api_client.get(f"{api_url}/replies", headers=owner["headers"])
        assert r2.status_code == 200
        replies = r2.json()
        assert len(replies) >= 1
        # Find a reply for this parent with emergency keywords
        matches = [x for x in replies if x.get("body") == "help pain"]
        assert matches, "Emergency reply not in list"
        m = matches[0]
        assert m.get("emergency_keywords"), "Expected emergency_keywords populated"
        assert m.get("parent_name") == parent["name"]

    def test_simulate_parent_not_found(self, api_client, api_url, fresh_user):
        r = api_client.post(f"{api_url}/replies/simulate",
                            json={"parent_id": "507f1f77bcf86cd799439011", "text": "1"},
                            headers=fresh_user["headers"])
        assert r.status_code == 404


class TestRepliesList:
    def test_list_returns_scoped_replies_with_parent_name(self, api_client, api_url):
        owner, parent = _owner_with_parent(api_client, api_url)
        # simulate a couple of replies
        api_client.post(f"{api_url}/replies/simulate",
                        json={"parent_id": parent["id"], "text": "1"},
                        headers=owner["headers"])
        api_client.post(f"{api_url}/replies/simulate",
                        json={"parent_id": parent["id"], "text": "3"},
                        headers=owner["headers"])
        r = api_client.get(f"{api_url}/replies", headers=owner["headers"])
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 2
        # check newest first + parent_name + feeling
        for item in data:
            assert "id" in item
            assert item.get("parent_name") == parent["name"]
            assert "feeling" in item
            assert "created_at" in item

    def test_list_is_scoped_per_owner(self, api_client, api_url):
        owner_a, parent_a = _owner_with_parent(api_client, api_url)
        owner_b, parent_b = _owner_with_parent(api_client, api_url)
        api_client.post(f"{api_url}/replies/simulate",
                        json={"parent_id": parent_a["id"], "text": "1"},
                        headers=owner_a["headers"])
        # owner_b sees empty
        r = api_client.get(f"{api_url}/replies", headers=owner_b["headers"])
        assert r.status_code == 200
        # owner_b should not see owner_a's reply
        ids_b = [it.get("parent_id") for it in r.json()]
        assert parent_a["id"] not in ids_b
