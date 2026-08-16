#!/usr/bin/env python3
"""
Backend test for AYANA v2 - Recovery mode and Festival calendar features
"""
import requests
import json
from pymongo import MongoClient
import os

# Configuration
# ADMIN_EMAIL/ADMIN_PASSWORD were previously hardcoded here and had drifted
# from the real .env (this file said "AyanaAdmin@2026", .env has a different
# value) — every run failed at Step 1 (admin login) with no useful error.
# Reading from the environment means this file can never silently go stale
# again; export these (or load your .env) before running.
BASE_URL = os.environ.get("BACKEND_TEST_BASE_URL", "https://service-543.preview.emergentagent.com/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@ayana.care")
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]  # required — no safe default for a password

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(passed, message):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed

def test_recovery_mode():
    """Test Feature 1: Recovery mode (Raksha-gated)"""
    print_test("FEATURE 1: Recovery Mode (Raksha-gated)")
    
    results = []
    
    # Step 1: Login as admin
    print("\n[Step 1] Login as admin...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_resp.status_code != 200:
        print_result(False, f"Admin login failed: {login_resp.status_code} - {login_resp.text}")
        return False
    
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = login_resp.json()["user"]["id"]
    print_result(True, f"Admin logged in successfully. User ID: {user_id}")
    
    # Step 2: Check if admin has a parent, create if needed
    print("\n[Step 2] Check/create parent...")
    parents_resp = requests.get(f"{BASE_URL}/parents", headers=headers)
    
    if parents_resp.status_code != 200:
        print_result(False, f"Failed to get parents: {parents_resp.status_code}")
        return False
    
    parents = parents_resp.json()
    
    if not parents:
        # Create a parent
        print("No parent found, creating one...")
        parent_data = {
            "name": "Test Parent",
            "phone": "+919876543210",
            "language": "en",
            "relationship": "mother"
        }
        create_parent_resp = requests.post(f"{BASE_URL}/parents", json=parent_data, headers=headers)
        
        if create_parent_resp.status_code != 200:
            print_result(False, f"Failed to create parent: {create_parent_resp.status_code} - {create_parent_resp.text}")
            return False
        
        parent_id = create_parent_resp.json()["id"]
        print_result(True, f"Parent created with ID: {parent_id}")
    else:
        parent_id = parents[0]["id"]
        print_result(True, f"Using existing parent ID: {parent_id}")
    
    # Step 3: Check if admin has a schedule, create if needed
    print("\n[Step 3] Check/create schedule...")
    schedules_resp = requests.get(f"{BASE_URL}/schedules", headers=headers)
    
    if schedules_resp.status_code != 200:
        print_result(False, f"Failed to get schedules: {schedules_resp.status_code}")
        return False
    
    schedules = schedules_resp.json()
    
    if not schedules:
        # Create a schedule
        print("No schedule found, creating one...")
        schedule_data = {
            "parent_id": parent_id,
            "mode": "nitya",
            "messages": [
                {"time": "09:00", "category": "morning_wish", "type": "checkin"},
                {"time": "20:00", "category": "goodnight", "type": "checkin"}
            ]
        }
        create_schedule_resp = requests.post(f"{BASE_URL}/schedules", json=schedule_data, headers=headers)
        
        if create_schedule_resp.status_code != 200:
            print_result(False, f"Failed to create schedule: {create_schedule_resp.status_code} - {create_schedule_resp.text}")
            return False
        
        schedule_id = create_schedule_resp.json()["id"]
        print_result(True, f"Schedule created with ID: {schedule_id}")
    else:
        schedule_id = schedules[0]["id"]
        print_result(True, f"Using existing schedule ID: {schedule_id}")
    
    # Step 4: Ensure user is on non-Raksha plan, then test recovery/start (should return 403)
    print("\n[Step 4] Ensure user is on non-Raksha plan...")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Set plan to "nitya" (non-Raksha)
        result = db.payment_state.update_one(
            {"user_id": user_id},
            {"$set": {"plan": "nitya"}},
            upsert=True
        )
        
        # Verify the update
        payment_state = db.payment_state.find_one({"user_id": user_id})
        
        if payment_state and payment_state.get("plan") == "nitya":
            print_result(True, f"User plan set to Nitya (non-Raksha) in DB")
        else:
            print_result(False, f"Failed to set plan to Nitya: {payment_state}")
            client.close()
            return False
        
        client.close()
    except Exception as e:
        print_result(False, f"MongoDB error: {str(e)}")
        return False
    
    print("\n[Step 4b] Test recovery/start with non-Raksha user (expect 403)...")
    recovery_start_data = {
        "days": 30,
        "extra_reminders": [{"time": "12:00", "category": "medicine"}]
    }
    
    recovery_resp = requests.post(
        f"{BASE_URL}/schedules/{schedule_id}/recovery/start",
        json=recovery_start_data,
        headers=headers
    )
    
    if recovery_resp.status_code == 403:
        response_data = recovery_resp.json()
        if "Raksha" in response_data.get("detail", ""):
            print_result(True, f"Correctly returned 403 with Raksha message: {response_data['detail']}")
            results.append(True)
        else:
            print_result(False, f"Got 403 but wrong message: {response_data.get('detail')}")
            results.append(False)
    else:
        print_result(False, f"Expected 403, got {recovery_resp.status_code}: {recovery_resp.text}")
        results.append(False)
    
    # Step 5: Set user to Raksha plan in MongoDB
    print("\n[Step 5] Set user to Raksha plan in MongoDB...")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Update payment_state to set plan to "raksha"
        result = db.payment_state.update_one(
            {"user_id": user_id},
            {"$set": {"plan": "raksha"}},
            upsert=True
        )
        
        # Verify the update
        payment_state = db.payment_state.find_one({"user_id": user_id})
        
        if payment_state and payment_state.get("plan") == "raksha":
            print_result(True, f"User plan set to Raksha in DB: {payment_state}")
            results.append(True)
        else:
            print_result(False, f"Failed to set plan to Raksha: {payment_state}")
            results.append(False)
            client.close()
            return False
        
        client.close()
    except Exception as e:
        print_result(False, f"MongoDB error: {str(e)}")
        results.append(False)
        return False
    
    # Step 6: Test recovery/start with Raksha user (should return 200)
    print("\n[Step 6] Test recovery/start with Raksha user (expect 200)...")
    recovery_resp = requests.post(
        f"{BASE_URL}/schedules/{schedule_id}/recovery/start",
        json=recovery_start_data,
        headers=headers
    )
    
    if recovery_resp.status_code == 200:
        response_data = recovery_resp.json()
        
        # Check response structure
        checks = []
        checks.append(("ok" in response_data and response_data["ok"], "Response has ok:true"))
        checks.append(("recovery_until" in response_data, "Response has recovery_until"))
        checks.append(("schedule" in response_data, "Response has schedule"))
        
        # Get the schedule to verify recovery_mode and messages
        schedule_resp = requests.get(f"{BASE_URL}/schedules", headers=headers)
        if schedule_resp.status_code == 200:
            schedules = schedule_resp.json()
            schedule = next((s for s in schedules if s["id"] == schedule_id), None)
            
            if schedule:
                checks.append((schedule.get("recovery_mode") == True, f"Schedule has recovery_mode=true"))
                
                # Check for is_recovery message
                messages = schedule.get("messages", [])
                recovery_messages = [m for m in messages if m.get("is_recovery")]
                checks.append((len(recovery_messages) == 1, f"Schedule has 1 is_recovery message (found {len(recovery_messages)})"))
                
                if recovery_messages:
                    msg = recovery_messages[0]
                    checks.append((msg.get("time") == "12:00", f"Recovery message time is 12:00"))
                    checks.append((msg.get("category") == "medicine", f"Recovery message category is medicine"))
        
        all_passed = all(check[0] for check in checks)
        for passed, msg in checks:
            print_result(passed, msg)
        
        results.append(all_passed)
    else:
        print_result(False, f"Expected 200, got {recovery_resp.status_code}: {recovery_resp.text}")
        results.append(False)
    
    # Step 7: Test recovery/start with 3 extra_reminders (should return 400)
    print("\n[Step 7] Test recovery/start with 3 extra_reminders (expect 400)...")
    recovery_start_data_3 = {
        "days": 30,
        "extra_reminders": [
            {"time": "12:00", "category": "medicine"},
            {"time": "14:00", "category": "medicine"},
            {"time": "16:00", "category": "medicine"}
        ]
    }
    
    recovery_resp = requests.post(
        f"{BASE_URL}/schedules/{schedule_id}/recovery/start",
        json=recovery_start_data_3,
        headers=headers
    )
    
    if recovery_resp.status_code == 400:
        response_data = recovery_resp.json()
        detail = response_data.get("detail", "")
        if "2" in detail or "extra" in detail.lower():
            print_result(True, f"Correctly returned 400 with cap message: {detail}")
            results.append(True)
        else:
            print_result(False, f"Got 400 but wrong message: {detail}")
            results.append(False)
    else:
        print_result(False, f"Expected 400, got {recovery_resp.status_code}: {recovery_resp.text}")
        results.append(False)
    
    # Step 8: Test recovery/end (should return 200)
    print("\n[Step 8] Test recovery/end (expect 200)...")
    recovery_end_resp = requests.post(
        f"{BASE_URL}/schedules/{schedule_id}/recovery/end",
        headers=headers
    )
    
    if recovery_end_resp.status_code == 200:
        response_data = recovery_end_resp.json()
        
        # Check response structure
        checks = []
        checks.append(("ok" in response_data and response_data["ok"], "Response has ok:true"))
        
        # Get the schedule to verify recovery_mode is false and is_recovery message removed
        schedule_resp = requests.get(f"{BASE_URL}/schedules", headers=headers)
        if schedule_resp.status_code == 200:
            schedules = schedule_resp.json()
            schedule = next((s for s in schedules if s["id"] == schedule_id), None)
            
            if schedule:
                checks.append((schedule.get("recovery_mode") == False, f"Schedule has recovery_mode=false"))
                
                # Check that is_recovery messages are removed
                messages = schedule.get("messages", [])
                recovery_messages = [m for m in messages if m.get("is_recovery")]
                checks.append((len(recovery_messages) == 0, f"Schedule has no is_recovery messages (found {len(recovery_messages)})"))
        
        all_passed = all(check[0] for check in checks)
        for passed, msg in checks:
            print_result(passed, msg)
        
        results.append(all_passed)
    else:
        print_result(False, f"Expected 200, got {recovery_end_resp.status_code}: {recovery_end_resp.text}")
        results.append(False)
    
    return all(results)

def test_festival_calendar():
    """Test Feature 2: Festival calendar / care-watch regression"""
    print_test("FEATURE 2: Festival Calendar / Care-Watch Regression")
    
    results = []
    
    # Step 1: Login as admin
    print("\n[Step 1] Login as admin...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_resp.status_code != 200:
        print_result(False, f"Admin login failed: {login_resp.status_code}")
        return False
    
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print_result(True, "Admin logged in successfully")
    
    # Step 2: Call POST /api/care-watch/run
    print("\n[Step 2] Call POST /api/care-watch/run...")
    care_watch_resp = requests.post(f"{BASE_URL}/care-watch/run", headers=headers)
    
    if care_watch_resp.status_code == 200:
        response_data = care_watch_resp.json()
        
        checks = []
        checks.append(("ok" in response_data and response_data["ok"], "Response has ok:true"))
        checks.append(("ran_at" in response_data, "Response has ran_at timestamp"))
        
        all_passed = all(check[0] for check in checks)
        for passed, msg in checks:
            print_result(passed, msg)
        
        results.append(all_passed)
    else:
        print_result(False, f"Expected 200, got {care_watch_resp.status_code}: {care_watch_resp.text}")
        results.append(False)
    
    # Step 3: Check backend logs for tracebacks (only recent logs after last startup)
    print("\n[Step 3] Check backend logs for tracebacks...")
    try:
        import subprocess
        log_result = subprocess.run(
            ["tail", "-n", "200", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        error_log = log_result.stdout
        
        # Find the last "Application startup complete" to only check logs after that
        lines = error_log.split('\n')
        last_startup_idx = -1
        for i, line in enumerate(lines):
            if "Application startup complete" in line:
                last_startup_idx = i
        
        # Only check logs after the last startup
        if last_startup_idx >= 0:
            recent_logs = '\n'.join(lines[last_startup_idx:])
        else:
            recent_logs = error_log
        
        # Check for common error patterns in recent logs
        error_patterns = ["Traceback", "Exception", "ERROR", "NameError", "AttributeError", "KeyError"]
        found_errors = []
        
        for pattern in error_patterns:
            if pattern in recent_logs:
                # Get context around the error
                recent_lines = recent_logs.split('\n')
                for i, line in enumerate(recent_lines):
                    if pattern in line and "INFO" not in line:  # Skip INFO level logs
                        context_start = max(0, i - 2)
                        context_end = min(len(recent_lines), i + 3)
                        context = '\n'.join(recent_lines[context_start:context_end])
                        found_errors.append(f"Found '{pattern}':\n{context}")
                        break  # Only report first occurrence of each pattern
        
        if found_errors:
            print_result(False, f"Found errors in recent backend logs:\n" + "\n\n".join(found_errors))
            results.append(False)
        else:
            print_result(True, "No tracebacks or errors found in recent backend logs (after last startup)")
            results.append(True)
    
    except Exception as e:
        print_result(False, f"Failed to check logs: {str(e)}")
        results.append(False)
    
    return all(results)

def main():
    print("\n" + "="*80)
    print("AYANA v2 - Backend Testing: Recovery Mode & Festival Calendar")
    print("="*80)
    
    # Test Feature 1: Recovery Mode
    feature1_passed = test_recovery_mode()
    
    # Test Feature 2: Festival Calendar
    feature2_passed = test_festival_calendar()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Feature 1 (Recovery Mode): {'✅ PASSED' if feature1_passed else '❌ FAILED'}")
    print(f"Feature 2 (Festival Calendar): {'✅ PASSED' if feature2_passed else '❌ FAILED'}")
    print("="*80)
    
    return feature1_passed and feature2_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)