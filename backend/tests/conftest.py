import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://parent-bond-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ayana.care"
ADMIN_PASSWORD = "AyanaAdmin@2026"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


def _register(session, name="Test User"):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_{name}_{unique}",
        "email": f"test_{unique}@example.com",
        "phone": "+919876500000",
        "password": "test1234",
    }
    r = session.post(f"{API}/auth/register", json=payload)
    r.raise_for_status()
    data = r.json()
    return payload, data["token"], data["user"]


@pytest.fixture(scope="session")
def registered_user(api_client):
    payload, token, user = _register(api_client)
    return {"payload": payload, "token": token, "user": user}


@pytest.fixture(scope="session")
def auth_headers(registered_user):
    return {"Authorization": f"Bearer {registered_user['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_headers(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def fresh_user(api_client):
    """A brand-new user with its own token for isolated tests."""
    payload, token, user = _register(api_client, name="Fresh")
    return {"payload": payload, "token": token, "user": user,
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}
