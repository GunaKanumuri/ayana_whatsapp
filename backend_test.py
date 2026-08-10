"""
Backend test suite for AYANA v2 features.
Tests emergency contacts, two-way moments, Care Watch, parent birthday, and pricing config.
"""
import requests
import json
import time
from datetime import datetime

# Backend base URL from frontend/.env REACT_APP_BACKEND_URL
BASE_URL = "https://service-543.preview.emergentagent.com/api"

# Admin credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@ayana.care"
ADMIN_PASSWORD = "AyanaAdmin@2026"

# Test state
token = None
user_id = None
parent_id = None
parent_id_2 = None

def log(msg):
    print(f"[TEST] {msg}")

def assert_status(response, expected_status, context=""):
    if response.status_code != expected_status:
        log(f"❌ FAILED {context}: Expected {expected_status}, got {response.status_code}")
        log(f"   Response: {response.text[:500]}")
        return False
    return True

def test_config():
    """Test GET /api/config - verify plans and currencies"""
    log("Testing GET /api/config...")
    resp = requests.get(f"{BASE_URL}/config")
    
    if not assert_status(resp, 200, "GET /api/config"):
        return False
    
    data = resp.json()
    
    # Check plans
    plans = data.get("plans", [])
    plan_ids = [p.get("id") for p in plans]
    
    if "nitya" not in plan_ids or "bandham" not in plan_ids or "raksha" not in plan_ids:
        log(f"❌ FAILED: Expected plans nitya, bandham, raksha. Got: {plan_ids}")
        return False
    
    # Check currencies - should NOT include INR, USD should be present
    currencies = data.get("currencies", [])
    currency_codes = [c.get("code") for c in currencies]
    
    if "INR" in currency_codes:
        log(f"❌ FAILED: INR should be removed from currencies. Got: {currency_codes}")
        return False
    
    if "USD" not in currency_codes:
        log(f"❌ FAILED: USD should be in currencies. Got: {currency_codes}")
        return False
    
    # Check USD is first
    if currencies and currencies[0].get("code") != "USD":
        log(f"⚠️  WARNING: USD is not first currency. Got: {currencies[0].get('code')}")
    
    log(f"✅ GET /api/config passed - plans: {plan_ids}, currencies: {currency_codes}")
    return True

def test_auth_register():
    """Register a fresh child user"""
    global token, user_id
    
    # Generate unique email
    timestamp = int(time.time())
    email = f"testchild{timestamp}@ayana.test"
    
    log(f"Testing POST /api/auth/register with {email}...")
    
    payload = {
        "name": "Test Child",
        "email": email,
        "phone": "+919876543210",
        "password": "TestPass123"
    }
    
    resp = requests.post(f"{BASE_URL}/auth/register", json=payload)
    
    if not assert_status(resp, 200, "POST /api/auth/register"):
        return False
    
    data = resp.json()
    token = data.get("token")
    user_data = data.get("user", {})
    user_id = user_data.get("id")
    
    if not token:
        log("❌ FAILED: No token returned from register")
        return False
    
    log(f"✅ Registration passed - user_id: {user_id}")
    return True

def test_auth_login_admin():
    """Login as admin"""
    global token, user_id
    
    log("Testing POST /api/auth/login (admin)...")
    
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    resp = requests.post(f"{BASE_URL}/auth/login", json=payload)
    
    if not assert_status(resp, 200, "POST /api/auth/login"):
        return False
    
    data = resp.json()
    token = data.get("token")
    user_data = data.get("user", {})
    user_id = user_data.get("id")
    
    if not token:
        log("❌ FAILED: No token returned from login")
        return False
    
    log(f"✅ Admin login passed - user_id: {user_id}")
    return True

def test_create_parent_with_birthday():
    """Test POST /api/parents with valid birthday MM-DD"""
    global parent_id
    
    log("Testing POST /api/parents with birthday...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Test Amma",
        "preferred_name": "Amma",
        "relationship": "mother",
        "phone": "+919876543211",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "birthday": "03-15",  # Valid MM-DD format
        "nicknames": ["Amma", "Ma"]
    }
    
    resp = requests.post(f"{BASE_URL}/parents", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "POST /api/parents with birthday"):
        return False
    
    data = resp.json()
    parent_id = data.get("id")
    
    if data.get("birthday") != "03-15":
        log(f"❌ FAILED: Birthday not persisted correctly. Got: {data.get('birthday')}")
        return False
    
    log(f"✅ Create parent with birthday passed - parent_id: {parent_id}")
    return True

def test_create_parent_without_birthday():
    """Test POST /api/parents without birthday"""
    global parent_id_2
    
    log("Testing POST /api/parents without birthday...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Test Nanna",
        "preferred_name": "Nanna",
        "relationship": "father",
        "phone": "+919876543212",
        "language": "te",
        "timezone": "Asia/Kolkata",
        "nicknames": ["Nanna"]
    }
    
    resp = requests.post(f"{BASE_URL}/parents", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "POST /api/parents without birthday"):
        return False
    
    data = resp.json()
    parent_id_2 = data.get("id")
    
    log(f"✅ Create parent without birthday passed - parent_id: {parent_id_2}")
    return True

def test_update_parent_birthday():
    """Test PUT /api/parents/{id} to update birthday"""
    log("Testing PUT /api/parents/{id} to update birthday...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Test Nanna",
        "preferred_name": "Nanna",
        "relationship": "father",
        "phone": "+919876543212",
        "language": "te",
        "timezone": "Asia/Kolkata",
        "birthday": "06-20",  # Add birthday
        "nicknames": ["Nanna"]
    }
    
    resp = requests.put(f"{BASE_URL}/parents/{parent_id_2}", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "PUT /api/parents/{id}"):
        return False
    
    data = resp.json()
    
    if data.get("birthday") != "06-20":
        log(f"❌ FAILED: Birthday not updated correctly. Got: {data.get('birthday')}")
        return False
    
    log("✅ Update parent birthday passed")
    return True

def test_invalid_birthday():
    """Test invalid birthday formats are rejected"""
    log("Testing invalid birthday rejection...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Invalid format "15-40"
    payload = {
        "name": "Test Parent",
        "relationship": "mother",
        "phone": "+919876543213",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "birthday": "15-40",  # Invalid month
        "nicknames": []
    }
    
    resp = requests.post(f"{BASE_URL}/parents", json=payload, headers=headers)
    
    if resp.status_code < 400:
        log(f"❌ FAILED: Invalid birthday '15-40' should be rejected. Got status: {resp.status_code}")
        return False
    
    # Test 2: Full date format "1990-03-15"
    payload["birthday"] = "1990-03-15"
    resp = requests.post(f"{BASE_URL}/parents", json=payload, headers=headers)
    
    if resp.status_code < 400:
        log(f"❌ FAILED: Invalid birthday '1990-03-15' should be rejected. Got status: {resp.status_code}")
        return False
    
    log("✅ Invalid birthday rejection passed")
    return True

def test_set_emergency_contacts():
    """Test PUT /api/parents/{id}/emergency-contacts"""
    log("Testing PUT /api/parents/{id}/emergency-contacts...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "contacts": [
            {
                "name": "Ravi",
                "phone": "+919876543210",
                "relation": "Son"
            }
        ]
    }
    
    resp = requests.put(f"{BASE_URL}/parents/{parent_id}/emergency-contacts", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "PUT /api/parents/{id}/emergency-contacts"):
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        log(f"❌ FAILED: Expected ok:true. Got: {data}")
        return False
    
    log("✅ Set emergency contacts passed")
    return True

def test_get_emergency_contacts():
    """Test GET /api/parents/{id}/emergency-contacts"""
    log("Testing GET /api/parents/{id}/emergency-contacts...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/parents/{parent_id}/emergency-contacts", headers=headers)
    
    if not assert_status(resp, 200, "GET /api/parents/{id}/emergency-contacts"):
        return False
    
    data = resp.json()
    contacts = data.get("contacts", [])
    
    if len(contacts) != 1:
        log(f"❌ FAILED: Expected 1 contact. Got: {len(contacts)}")
        return False
    
    contact = contacts[0]
    if contact.get("name") != "Ravi" or contact.get("phone") != "+919876543210":
        log(f"❌ FAILED: Contact data mismatch. Got: {contact}")
        return False
    
    log("✅ Get emergency contacts passed")
    return True

def test_invalid_phone_emergency_contact():
    """Test non-E.164 phone is rejected"""
    log("Testing invalid phone format rejection...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "contacts": [
            {
                "name": "Invalid",
                "phone": "9876543210",  # Missing +91
                "relation": "Friend"
            }
        ]
    }
    
    resp = requests.put(f"{BASE_URL}/parents/{parent_id}/emergency-contacts", json=payload, headers=headers)
    
    if resp.status_code < 400:
        log(f"❌ FAILED: Invalid phone should be rejected. Got status: {resp.status_code}")
        return False
    
    log("✅ Invalid phone rejection passed")
    return True

def test_max_emergency_contacts():
    """Test >5 contacts are rejected"""
    log("Testing max 5 contacts limit...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "contacts": [
            {"name": f"Contact{i}", "phone": f"+9198765432{i:02d}", "relation": "Family"}
            for i in range(6)  # 6 contacts
        ]
    }
    
    resp = requests.put(f"{BASE_URL}/parents/{parent_id}/emergency-contacts", json=payload, headers=headers)
    
    if resp.status_code < 400:
        log(f"❌ FAILED: >5 contacts should be rejected. Got status: {resp.status_code}")
        return False
    
    log("✅ Max contacts limit passed")
    return True

def test_post_moment_text():
    """Test POST /api/moments with text"""
    log("Testing POST /api/moments with text...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "parent_id": parent_id,
        "text": "Thinking of you Amma! Hope you're having a wonderful day."
    }
    
    resp = requests.post(f"{BASE_URL}/moments", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "POST /api/moments (text)"):
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        log(f"❌ FAILED: Expected ok:true. Got: {data}")
        return False
    
    if "status" not in data:
        log(f"❌ FAILED: Expected status field. Got: {data}")
        return False
    
    log(f"✅ Post moment (text) passed - status: {data.get('status')}")
    return True

def test_post_moment_with_image():
    """Test POST /api/moments with image_url"""
    log("Testing POST /api/moments with image_url...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "parent_id": parent_id,
        "text": "Look at this beautiful sunset!",
        "image_url": "https://example.com/sunset.jpg"
    }
    
    resp = requests.post(f"{BASE_URL}/moments", json=payload, headers=headers)
    
    if not assert_status(resp, 200, "POST /api/moments (image)"):
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        log(f"❌ FAILED: Expected ok:true. Got: {data}")
        return False
    
    if "status" not in data:
        log(f"❌ FAILED: Expected status field. Got: {data}")
        return False
    
    log(f"✅ Post moment (image) passed - status: {data.get('status')}")
    return True

def test_get_moments():
    """Test GET /api/moments"""
    log("Testing GET /api/moments...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/moments", headers=headers)
    
    if not assert_status(resp, 200, "GET /api/moments"):
        return False
    
    data = resp.json()
    
    if not isinstance(data, list):
        log(f"❌ FAILED: Expected list. Got: {type(data)}")
        return False
    
    if len(data) < 2:
        log(f"❌ FAILED: Expected at least 2 moments. Got: {len(data)}")
        return False
    
    log(f"✅ Get moments passed - found {len(data)} moments")
    return True

def test_moment_wrong_parent():
    """Test posting moment for non-owned parent returns 404"""
    log("Testing POST /api/moments for non-owned parent...")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "parent_id": "000000000000000000000000",  # Non-existent parent
        "text": "This should fail"
    }
    
    resp = requests.post(f"{BASE_URL}/moments", json=payload, headers=headers)
    
    if resp.status_code != 404:
        log(f"❌ FAILED: Expected 404 for non-owned parent. Got: {resp.status_code}")
        return False
    
    log("✅ Moment wrong parent rejection passed")
    return True

def test_care_watch_run():
    """Test POST /api/care-watch/run"""
    log("Testing POST /api/care-watch/run (first call)...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/care-watch/run", headers=headers)
    
    if not assert_status(resp, 200, "POST /api/care-watch/run"):
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        log(f"❌ FAILED: Expected ok:true. Got: {data}")
        return False
    
    if "ran_at" not in data:
        log(f"❌ FAILED: Expected ran_at field. Got: {data}")
        return False
    
    log(f"✅ Care Watch run (1st) passed - ran_at: {data.get('ran_at')}")
    return True

def test_care_watch_idempotent():
    """Test POST /api/care-watch/run twice (idempotent)"""
    log("Testing POST /api/care-watch/run (second call - idempotent)...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/care-watch/run", headers=headers)
    
    if not assert_status(resp, 200, "POST /api/care-watch/run (2nd)"):
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        log(f"❌ FAILED: Expected ok:true on second call. Got: {data}")
        return False
    
    log("✅ Care Watch idempotent passed")
    return True

def test_regression_get_parents():
    """Regression: GET /api/parents still works"""
    log("Testing regression: GET /api/parents...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/parents", headers=headers)
    
    if not assert_status(resp, 200, "GET /api/parents"):
        return False
    
    data = resp.json()
    
    if not isinstance(data, list):
        log(f"❌ FAILED: Expected list. Got: {type(data)}")
        return False
    
    if len(data) < 2:
        log(f"❌ FAILED: Expected at least 2 parents. Got: {len(data)}")
        return False
    
    log(f"✅ Regression GET /api/parents passed - found {len(data)} parents")
    return True

def test_regression_get_schedules():
    """Regression: GET /api/schedules still works"""
    log("Testing regression: GET /api/schedules...")
    
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/schedules", headers=headers)
    
    if not assert_status(resp, 200, "GET /api/schedules"):
        return False
    
    data = resp.json()
    
    if not isinstance(data, list):
        log(f"❌ FAILED: Expected list. Got: {type(data)}")
        return False
    
    log(f"✅ Regression GET /api/schedules passed - found {len(data)} schedules")
    return True

def run_all_tests():
    """Run all backend tests"""
    log("=" * 60)
    log("AYANA v2 Backend Test Suite")
    log("=" * 60)
    
    results = []
    
    # 1. Config test (no auth needed)
    results.append(("GET /api/config", test_config()))
    
    # 2. Auth - try register first, fallback to admin login
    if not test_auth_register():
        log("⚠️  Registration failed, trying admin login...")
        results.append(("Auth (admin login)", test_auth_login_admin()))
    else:
        results.append(("Auth (register)", True))
    
    # 3. Parents with birthday
    results.append(("POST /api/parents (with birthday)", test_create_parent_with_birthday()))
    results.append(("POST /api/parents (without birthday)", test_create_parent_without_birthday()))
    results.append(("PUT /api/parents (update birthday)", test_update_parent_birthday()))
    results.append(("Invalid birthday rejection", test_invalid_birthday()))
    
    # 4. Emergency contacts
    results.append(("PUT /api/parents/{id}/emergency-contacts", test_set_emergency_contacts()))
    results.append(("GET /api/parents/{id}/emergency-contacts", test_get_emergency_contacts()))
    results.append(("Invalid phone rejection", test_invalid_phone_emergency_contact()))
    results.append(("Max 5 contacts limit", test_max_emergency_contacts()))
    
    # 5. Two-way moments
    results.append(("POST /api/moments (text)", test_post_moment_text()))
    results.append(("POST /api/moments (image)", test_post_moment_with_image()))
    results.append(("GET /api/moments", test_get_moments()))
    results.append(("Moment wrong parent (404)", test_moment_wrong_parent()))
    
    # 6. Care Watch
    results.append(("POST /api/care-watch/run (1st)", test_care_watch_run()))
    results.append(("POST /api/care-watch/run (2nd - idempotent)", test_care_watch_idempotent()))
    
    # 7. Regression tests
    results.append(("Regression: GET /api/parents", test_regression_get_parents()))
    results.append(("Regression: GET /api/schedules", test_regression_get_schedules()))
    
    # Summary
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"{status}: {name}")
    
    log("=" * 60)
    log(f"TOTAL: {passed}/{total} tests passed")
    log("=" * 60)
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
