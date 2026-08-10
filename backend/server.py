import logging
import os
import secrets
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import Depends, FastAPI, APIRouter, HTTPException, Request, Response, Query
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from models import (
    RegisterInput, LoginInput, ChildProfileInput, ParentInput,
    ScheduleInput, PreferencesInput, ConsentInput,
    EmergencyContactsInput, MomentInput,
)

class CheckoutInput(BaseModel):
    plan: str = "nitya"
    billing: str = "month"

class SendTestInput(BaseModel):
    parent_id: str
    category: str = "how_feeling"

class PreviewInput(BaseModel):
    parent_id: str
    category: str = "how_feeling"

class InviteInput(BaseModel):
    email: str
    parent_id: str = ""

class OtpSendInput(BaseModel):
    phone_number: str

class OtpVerifyInput(BaseModel):
    phone_number: str
    code: str

class OtpResendInput(BaseModel):
    phone_number: str

class SimulateReplyInput(BaseModel):
    parent_id: str
    text: str

from auth import (
    hash_password, verify_password, create_access_token, serialize,
    get_current_user, get_current_admin, seed_admin,
)
from templates_data import (
    LANGUAGES, RELATIONSHIPS, DEFAULT_EMERGENCY_KEYWORDS,
    public_categories, category_type,
    render_slot_body, render_slot_buttons,
)
from pricing import PLANS, CURRENCIES, PLAN_BY_ID, plan_limits
from scheduler import start_scheduler, shutdown_scheduler
from email_sender import send_invite_email
from otp import create_and_send_otp, verify_otp_code, _normalize_phone as normalize_phone
from sarvam_stt import transcribe_voice_note, stt_enabled
from whatsapp import (
    send_whatsapp, send_whatsapp_opener, send_dynamic_checkin,
    send_medicine_template, send_meal_template, send_mood_template,
    send_reengagement,
    send_moment,
    refresh_session, is_session_open, parse_intent,
    verify_twilio_signature, detect_emergency, whatsapp_enabled,
)
from distress_detection import assess_transcript
from monthly_report import generate_monthly_report
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ayana")

app = FastAPI(title="AYANA-BOT API")
api = APIRouter(prefix="/api")

limiter = Limiter(key_func=get_remote_address, default_limits=[])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

async def audit(user_id, action, meta=None):
    await db.audit_logs.insert_one({
        "user_id": str(user_id) if user_id else None,
        "action": action,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    })

def scope(user) -> str:
    return user.get("household_owner_id") or str(user["_id"])

def is_member(user) -> bool:
    return bool(user.get("household_owner_id"))

async def _get_plan_id(user) -> str:
    ps = await db.payment_state.find_one({"user_id": scope(user)})
    return (ps or {}).get("plan", "nitya")

# ---------------- Health / meta ----------------
@api.get("/")
async def root():
    return {"app": "AYANA-BOT", "status": "ok"}

@api.get("/config")
async def public_config():
    return {
        "payments_enabled": os.environ.get("PAYMENTS_ENABLED", "false").lower() == "true",
        "whatsapp_enabled": whatsapp_enabled(),
        "languages": LANGUAGES,
        "relationships": RELATIONSHIPS,
        "categories": public_categories(),
        "plans": PLANS,
        "currencies": CURRENCIES,
        "training_video_url": os.environ.get("TRAINING_VIDEO_URL", ""),
        "feeling_map": {
            "good": {"emoji": "😊", "label": {"en": "Good", "te": "బాగున్నారు", "hi": "ठीक हूँ"}},
            "okay": {"emoji": "😐", "label": {"en": "Okay", "te": "ఫర్వాలేదు", "hi": "ठीक-ठाक"}},
            "not_well": {"emoji": "😟", "label": {"en": "Not well", "te": "ఒంట్లో బాలేదు", "hi": "तबीयत ठीक नहीं"}},
            "done": {"emoji": "✅", "label": {"en": "Done", "te": "అయ్యింది", "hi": "हो गया"}},
        },
        "reply_mode": "quick_reply_buttons",
    }

# ---------------- Auth ----------------
@api.post("/auth/register")
@limiter.limit("10/minute")
async def register(request: Request, payload: RegisterInput):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    invite = await db.circle_invites.find_one({"email": email, "status": "pending"})
    household_owner_id = invite["owner_id"] if invite else None
    doc = {
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "user",
        "household_owner_id": household_owner_id,
        "onboarding_complete": bool(household_owner_id),
        "onboarding_step": 5 if household_owner_id else 0,
        "city": None,
        "timezone": None,
        "created_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    if invite:
        await db.circle_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc), "member_id": uid}})
    else:
        await db.activation_state.insert_one({"user_id": uid, "whatsapp_activated": False, "activated_at": None})
        await db.payment_state.insert_one({"user_id": uid, "status": "trial", "plan": "nitya", "billing": "month", "updated_at": datetime.now(timezone.utc)})
    await audit(uid, "register", {"linked_household": household_owner_id})
    token = create_access_token(uid, email, "user")
    user = await db.users.find_one({"_id": res.inserted_id})
    return {"token": token, "user": serialize(user)}

@api.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginInput):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or user.get("deleted_at") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(str(user["_id"]), email, user.get("role", "user"))
    await audit(str(user["_id"]), "login")
    return {"token": token, "user": serialize(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize(user)

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ---------------- Child profile ----------------
@api.put("/profile/child")
async def update_child(payload: ChildProfileInput, user: dict = Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "city": payload.city,
        "timezone": payload.timezone,
        "onboarding_step": max(user.get("onboarding_step", 0), 1),
    }})
    await audit(user["_id"], "update_child_profile")
    return serialize(await db.users.find_one({"_id": user["_id"]}))

# ---------------- Parents ----------------
@api.get("/parents")
async def list_parents(user: dict = Depends(get_current_user)):
    docs = await db.parents.find({"user_id": scope(user), "deleted_at": None}).to_list(50)
    return [serialize(d) for d in docs]

@api.post("/parents")
async def create_parent(payload: ParentInput, user: dict = Depends(get_current_user)):
    plan_id = await _get_plan_id(user)
    max_nick = plan_limits(plan_id)["nicknames_max"]
    if len(payload.nicknames) > max_nick:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {max_nick} nicknames.")
    doc = payload.model_dump()
    doc.update({"user_id": scope(user), "created_at": datetime.now(timezone.utc), "deleted_at": None})
    res = await db.parents.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 2)}})
    await audit(user["_id"], "create_parent", {"parent_id": str(res.inserted_id)})
    return serialize(await db.parents.find_one({"_id": res.inserted_id}))

@api.put("/parents/{parent_id}")
async def update_parent(parent_id: str, payload: ParentInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    plan_id = await _get_plan_id(user)
    max_nick = plan_limits(plan_id)["nicknames_max"]
    if len(payload.nicknames) > max_nick:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {max_nick} nicknames.")
    await db.parents.update_one({"_id": ObjectId(parent_id)}, {"$set": payload.model_dump()})
    return serialize(await db.parents.find_one({"_id": ObjectId(parent_id)}))

@api.delete("/parents/{parent_id}")
async def delete_parent(parent_id: str, user: dict = Depends(get_current_user)):
    await db.parents.update_one({"_id": ObjectId(parent_id), "user_id": scope(user)},
                                {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await db.schedules.update_many({"parent_id": ObjectId(parent_id)}, {"$set": {"deleted_at": datetime.now(timezone.utc), "active": False}})
    return {"ok": True}

# ---------------- Emergency contacts (distinct from Care Circle) ----------------
@api.get("/parents/{parent_id}/emergency-contacts")
async def get_emergency_contacts(parent_id: str, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    return {"contacts": parent.get("emergency_contacts", [])}

@api.put("/parents/{parent_id}/emergency-contacts")
async def set_emergency_contacts(parent_id: str, payload: EmergencyContactsInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    contacts = [c.model_dump() for c in payload.contacts]
    await db.parents.update_one({"_id": ObjectId(parent_id)}, {"$set": {"emergency_contacts": contacts}})
    await audit(user["_id"], "set_emergency_contacts", {"parent_id": parent_id, "count": len(contacts)})
    return {"ok": True, "contacts": contacts}

# ---------------- Two-way moments (child -> parent) ----------------
@api.post("/moments")
async def send_moment_api(payload: MomentInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    sender_name = user.get("name") or "Your family"
    result = await send_moment(db, parent, payload.text, sender_name, payload.image_url or "")
    doc = {
        "user_id": scope(user), "parent_id": parent["_id"], "sender_name": sender_name,
        "text": payload.text, "image_url": payload.image_url,
        "status": (result or {}).get("status"), "created_at": datetime.now(timezone.utc),
    }
    await db.moments.insert_one(doc)
    return {"ok": True, "status": (result or {}).get("status"), "moment": serialize(doc)}

@api.get("/moments")
async def list_moments(user: dict = Depends(get_current_user)):
    docs = await db.moments.find({"user_id": scope(user)}).sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]

# ---------------- Care Watch manual trigger (testing/ops) ----------------
@api.post("/care-watch/run")
async def run_care_watch_now(user: dict = Depends(get_current_user)):
    from escalation import run_care_watch_impl
    await run_care_watch_impl()
    return {"ok": True, "ran_at": datetime.now(timezone.utc).isoformat()}

# ---------------- Schedules ----------------
@api.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    docs = await db.schedules.find({"user_id": scope(user), "deleted_at": None}).to_list(50)
    return [serialize(d) for d in docs]

async def _validate_by_plan(user, messages):
    plan_id = await _get_plan_id(user)
    limits = plan_limits(plan_id)
    if not messages:
        raise HTTPException(status_code=400, detail="Add at least one daily check-in.")
    checkins = sum(1 for m in messages if category_type(m.category) == "checkin")
    reminders = sum(1 for m in messages if category_type(m.category) == "reminder")
    if checkins > limits["checkins"]:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {limits['checkins']} daily check-ins. Upgrade for more.")
    if reminders > limits["reminders"]:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {limits['reminders']} reminders. Upgrade for more.")
    return plan_id

@api.post("/schedules")
async def create_schedule(payload: ScheduleInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": scope(user)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    await _validate_by_plan(user, payload.messages)
    doc = {
        "user_id": scope(user),
        "parent_id": ObjectId(payload.parent_id),
        "mode": payload.mode,
        "messages": [m.model_dump() for m in payload.messages],
        "active": payload.active,
        "recovery_mode": payload.recovery_mode,
        "recovery_until": payload.recovery_until,
        "reengagement_hours": payload.reengagement_hours,
        "created_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    res = await db.schedules.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 4)}})
    await audit(user["_id"], "create_schedule", {"schedule_id": str(res.inserted_id)})
    return serialize(await db.schedules.find_one({"_id": res.inserted_id}))

@api.put("/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, payload: ScheduleInput, user: dict = Depends(get_current_user)):
    sched = await db.schedules.find_one({"_id": ObjectId(schedule_id), "user_id": scope(user)})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await _validate_by_plan(user, payload.messages)
    await db.schedules.update_one({"_id": ObjectId(schedule_id)}, {"$set": {
        "mode": payload.mode,
        "messages": [m.model_dump() for m in payload.messages],
        "active": payload.active,
        "recovery_mode": payload.recovery_mode,
        "recovery_until": payload.recovery_until,
        "reengagement_hours": payload.reengagement_hours,
    }})
    return serialize(await db.schedules.find_one({"_id": ObjectId(schedule_id)}))

@api.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    await db.schedules.update_one({"_id": ObjectId(schedule_id), "user_id": scope(user)},
                                  {"$set": {"deleted_at": datetime.now(timezone.utc), "active": False}})
    return {"ok": True}

# ---------------- Consent & Preferences ----------------
@api.post("/consent")
async def log_consent(payload: ConsentInput, request: Request, user: dict = Depends(get_current_user)):
    await db.consent_logs.insert_one({
        "user_id": str(user["_id"]),
        "consent_type": payload.consent_type,
        "agreed": payload.agreed,
        "text": payload.text,
        "ip": request.client.host if request.client else None,
        "created_at": datetime.now(timezone.utc),
    })
    await audit(user["_id"], "consent", {"type": payload.consent_type, "agreed": payload.agreed})
    return {"ok": True}

@api.put("/preferences")
async def update_prefs(payload: PreferencesInput, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"preferences": upd}})
    return serialize(await db.users.find_one({"_id": user["_id"]}))

# ---------------- Payment ----------------
@api.get("/payment/state")
async def payment_state(user: dict = Depends(get_current_user)):
    state = await db.payment_state.find_one({"user_id": scope(user)})
    return {
        "payments_enabled": os.environ.get("PAYMENTS_ENABLED", "false").lower() == "true",
        "state": serialize(state) if state else {"status": "trial", "plan": "nitya", "billing": "month"},
        "plans": PLANS,
        "currencies": CURRENCIES,
    }

@api.post("/payment/checkout")
async def payment_checkout(payload: CheckoutInput, user: dict = Depends(get_current_user)):
    if is_member(user):
        raise HTTPException(status_code=403, detail="Only the account owner can change the plan.")
    plan = payload.plan
    billing = payload.billing
    if plan not in PLAN_BY_ID:
        plan = "nitya"
    if os.environ.get("PAYMENTS_ENABLED", "false").lower() != "true":
        await db.payment_state.update_one(
            {"user_id": str(user["_id"])},
            {"$set": {"status": "trial", "plan": plan, "billing": billing, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 3)}})
        await audit(user["_id"], "payment_skipped_test_mode", {"plan": plan, "billing": billing})
        return {"skipped": True, "plan": plan, "message": "Payments are disabled in testing mode. Trial access granted."}
    raise HTTPException(status_code=501, detail="Live payments are not enabled yet.")

# ---------------- Activation ----------------
@api.get("/activation")
async def get_activation(user: dict = Depends(get_current_user)):
    state = await db.activation_state.find_one({"user_id": scope(user)})
    return serialize(state) if state else {"whatsapp_activated": False}

@api.post("/activation/activate")
async def activate(user: dict = Depends(get_current_user)):
    parents = await db.parents.find({"user_id": scope(user), "deleted_at": None}).to_list(50)
    schedules = await db.schedules.find({"user_id": scope(user), "deleted_at": None}).to_list(50)
    if not parents or not schedules:
        raise HTTPException(status_code=400, detail="Please add a parent and a schedule before activating.")

    plan_id = await _get_plan_id(user)
    variants_per_slot = plan_limits(plan_id)["variants_per_slot"]
    day_index = datetime.now(timezone.utc).timetuple().tm_yday

    results = []
    for p in parents:
        r = await send_whatsapp_opener(db, p, day_index, variants_per_slot)
        results.append({"parent": p.get("name"), "status": r.get("status"), "skipped": r.get("skipped", False)})

    await db.activation_state.update_one(
        {"user_id": scope(user)},
        {"$set": {"whatsapp_activated": True, "activated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_complete": True, "onboarding_step": 5}})
    await audit(user["_id"], "activate_whatsapp", {"results": results})
    return {"activated": True, "whatsapp_enabled": whatsapp_enabled(), "results": results}

# ---------------- Message logs / dashboard ----------------
@api.get("/messages/logs")
async def message_logs(
    user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    query = {"user_id": scope(user)}
    total = await db.message_logs.count_documents(query)
    docs = await db.message_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "skip": skip, "limit": limit, "items": [serialize(d) for d in docs]}

@api.post("/whatsapp/send-test")
async def send_test(payload: SendTestInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    slot_type = payload.category or "morning_wish"
    session_open = await is_session_open(db, parent["_id"])

    plan_id = await _get_plan_id(user)
    variants_per_slot = plan_limits(plan_id)["variants_per_slot"]
    day_index = datetime.now(timezone.utc).timetuple().tm_yday

    if session_open:
        if slot_type in ["medicine", "bp_check", "sugar_check"]:
            result = await send_dynamic_checkin(db, parent, slot_type, day_index, variants_per_slot, medicine_name="your medicine")
        else:
            result = await send_dynamic_checkin(db, parent, slot_type, day_index, variants_per_slot)
    else:
        if slot_type in ["medicine", "bp_check", "sugar_check", "water", "health_check"]:
            result = await send_medicine_template(db, parent, day_index, variants_per_slot, medicine_name="your medicine")
        elif slot_type in ["breakfast", "lunch", "dinner", "afternoon_checkin"]:
            result = await send_meal_template(db, parent, meal_type=slot_type, day_index=day_index, variants_per_slot=variants_per_slot)
        elif slot_type in ["goodnight", "love_note", "how_feeling"]:
            result = await send_mood_template(db, parent, category=slot_type, day_index=day_index, variants_per_slot=variants_per_slot)
        else:
            result = await send_whatsapp_opener(db, parent, day_index, variants_per_slot)

    await audit(user["_id"], "send_test", {"parent_id": str(parent["_id"]), "slot_type": slot_type, "session_open": session_open, "template_used": result.get("template_type", "dynamic")})
    return {"ok": True, "status": result.get("status"), "detail": result.get("detail"), "session_open": session_open, "template_type": result.get("template_type", "dynamic")}

@api.post("/messages/preview")
async def preview_message(payload: PreviewInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    category = payload.category
    language = parent.get("language", "en")
    plan_id = await _get_plan_id(user)
    variants_per_slot = plan_limits(plan_id)["variants_per_slot"]
    day_index = datetime.now(timezone.utc).timetuple().tm_yday
    body = render_slot_body(category, language, parent, day_index, "your medicine", variants_per_slot)
    buttons = render_slot_buttons(category, language)
    return {"text": body, "buttons": buttons, "language": language}

# ---------------- Care Circle ----------------
@api.get("/circle")
async def get_circle(user: dict = Depends(get_current_user)):
    if is_member(user):
        owner = await db.users.find_one({"_id": ObjectId(user["household_owner_id"])})
        return {"role": "member", "owner": {"name": owner.get("name") if owner else "", "email": owner.get("email") if owner else ""}}
    uid = str(user["_id"])
    plan_id = await _get_plan_id(user)
    max_members = plan_limits(plan_id).get("family_members", 1)
    members = await db.users.find({"household_owner_id": uid, "deleted_at": None}).to_list(20)
    invites = await db.circle_invites.find({"owner_id": uid, "status": "pending"}).to_list(20)
    return {
        "role": "owner",
        "plan": plan_id,
        "max_members": max_members,
        "members": [{"id": str(m["_id"]), "name": m.get("name"), "email": m.get("email")} for m in members],
        "invites": [{"id": str(i["_id"]), "email": i.get("email")} for i in invites],
    }

@api.post("/circle/invite")
async def invite_member(payload: InviteInput, user: dict = Depends(get_current_user)):
    if is_member(user):
        raise HTTPException(status_code=403, detail="Only the account owner can invite family members.")
    uid = str(user["_id"])
    plan_id = await _get_plan_id(user)
    max_members = plan_limits(plan_id).get("family_members", 1)
    if max_members <= 1:
        raise HTTPException(status_code=403, detail="Family co-care requires Bandham or Raksha. Upgrade to invite siblings.")
    email = (payload.email or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if email == user.get("email"):
        raise HTTPException(status_code=400, detail="That's your own email 🙂")
    current = await db.users.count_documents({"household_owner_id": uid, "deleted_at": None})
    pending = await db.circle_invites.count_documents({"owner_id": uid, "status": "pending"})
    if current + pending >= max_members:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {max_members} family members.")
    existing_member = await db.users.find_one({"email": email, "household_owner_id": uid, "deleted_at": None})
    if existing_member:
        raise HTTPException(status_code=400, detail="This person is already in your care circle.")
    if await db.circle_invites.find_one({"owner_id": uid, "email": email, "status": "pending"}):
        raise HTTPException(status_code=400, detail="You've already invited this email. Check the Care circle tab to resend.")
    import jwt as _jwt
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite_res = await db.circle_invites.insert_one({
        "owner_id": uid, "email": email, "status": "pending",
        "created_at": datetime.now(timezone.utc), "expires_at": expires_at,
        "inviter_name": user.get("name", "Someone"), "parent_id": payload.parent_id or None,
    })
    invite_id = str(invite_res.inserted_id)
    signed_token = _jwt.encode(
        {"sub": invite_id, "email": email, "owner_id": uid, "exp": expires_at, "type": "invite"},
        os.environ["JWT_SECRET"], algorithm="HS256",
    )
    await db.circle_invites.update_one({"_id": invite_res.inserted_id}, {"$set": {"signed_token": signed_token}})
    parent_display_name = ""
    if payload.parent_id:
        p = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": uid})
        if p:
            parent_display_name = p.get("preferred_name") or p.get("name", "")
    else:
        all_parents = await db.parents.find({"user_id": uid, "deleted_at": None}).to_list(3)
        if len(all_parents) == 1:
            parent_display_name = all_parents[0].get("preferred_name") or all_parents[0].get("name", "")
    await audit(uid, "circle_invite", {"email": "[redacted]"})
    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    link = f"{frontend}/invite/{signed_token}"
    logger.info("[circle] Care circle invite created (id=%s)", invite_id)
    email_result = await send_invite_email(
        to_email=email, inviter_name=user.get("name", "Someone"),
        invite_link=link, parent_display_name=parent_display_name, expiry_days=7,
    )
    return {"ok": True, "invite_id": invite_id, "invite_link": link, "email_status": email_result["status"]}

@api.get("/circle/invite/{token}")
async def get_invite_preview(token: str):
    import jwt as _jwt
    try:
        payload = _jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        if payload.get("type") != "invite":
            raise HTTPException(status_code=400, detail="Invalid invite token.")
    except _jwt.ExpiredSignatureError:
        raise HTTPException(status_code=410, detail="This invite link has expired. Ask the owner to send a new one.")
    except _jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid invite token.")
    invite = await db.circle_invites.find_one({"_id": ObjectId(payload["sub"])})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"This invite has already been {invite.get('status')}.")
    parent_display_name = ""
    if invite.get("parent_id"):
        p = await db.parents.find_one({"_id": ObjectId(invite["parent_id"])})
        if p:
            parent_display_name = p.get("preferred_name") or p.get("name", "")
    return {
        "invite_id": str(invite["_id"]), "email": invite.get("email"),
        "inviter_name": invite.get("inviter_name", ""), "parent_display_name": parent_display_name,
        "expires_at": invite["expires_at"].isoformat() if invite.get("expires_at") else None,
        "status": invite.get("status"),
    }

@api.post("/circle/invite/{token}/accept")
async def accept_invite_by_token(token: str, user: dict = Depends(get_current_user)):
    import jwt as _jwt
    try:
        payload = _jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        if payload.get("type") != "invite":
            raise HTTPException(status_code=400, detail="Invalid invite token.")
    except _jwt.ExpiredSignatureError:
        raise HTTPException(status_code=410, detail="This invite link has expired.")
    except _jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid invite token.")
    invite = await db.circle_invites.find_one({"_id": ObjectId(payload["sub"])})
    if not invite or invite.get("status") != "pending":
        raise HTTPException(status_code=409, detail="This invite is no longer valid.")
    if invite.get("email") != user.get("email"):
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address.")
    now = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"household_owner_id": invite["owner_id"], "onboarding_complete": True}})
    await db.circle_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "accepted", "accepted_at": now, "member_id": str(user["_id"])}})
    await audit(str(user["_id"]), "circle_invite_accepted", {"invite_id": str(invite["_id"])})
    return {"ok": True, "owner_id": invite["owner_id"]}

# ---------------- OTP ----------------
@api.post("/auth/otp/send")
@limiter.limit("5/minute")
async def otp_send(request: Request, payload: OtpSendInput):
    result = await create_and_send_otp(payload.phone_number)
    if result["status"] == "rate_limited":
        raise HTTPException(status_code=429, detail=result["detail"], headers={"Retry-After": str(result.get("retry_after_seconds", 600))})
    if result["status"] == "failed":
        raise HTTPException(status_code=503, detail=result["detail"])
    return {"ok": True, "status": result["status"], "phone": result["phone"], "expires_at": result["expires_at"], "detail": result.get("detail")}

@api.post("/auth/otp/verify")
@limiter.limit("10/minute")
async def otp_verify(request: Request, payload: OtpVerifyInput, user: dict = Depends(get_current_user)):
    result = await verify_otp_code(payload.phone_number, payload.code)
    if not result["ok"]:
        code = result.get("code", "invalid")
        status = 429 if code == "too_many_attempts" else 400
        raise HTTPException(status_code=status, detail=result["detail"])
    phone = result["phone"]
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"phone_verified": True, "phone": phone, "phone_verified_at": datetime.now(timezone.utc)}})
    await audit(str(user["_id"]), "phone_verified", {})
    return {"ok": True, "phone_verified": True}

@api.post("/auth/otp/resend")
@limiter.limit("3/minute")
async def otp_resend(request: Request, payload: OtpResendInput):
    result = await create_and_send_otp(payload.phone_number)
    if result["status"] == "rate_limited":
        raise HTTPException(status_code=429, detail=result["detail"], headers={"Retry-After": str(result.get("retry_after_seconds", 600))})
    if result["status"] == "failed":
        raise HTTPException(status_code=503, detail=result["detail"])
    return {"ok": True, "status": result["status"], "expires_at": result["expires_at"], "detail": result.get("detail")}

@api.delete("/circle/member/{member_id}")
async def remove_member(member_id: str, user: dict = Depends(get_current_user)):
    if is_member(user):
        raise HTTPException(status_code=403, detail="Only the account owner can remove members.")
    await db.users.update_one({"_id": ObjectId(member_id), "household_owner_id": str(user["_id"])}, {"$set": {"household_owner_id": None}})
    return {"ok": True}

@api.delete("/circle/invite/{invite_id}")
async def cancel_invite(invite_id: str, user: dict = Depends(get_current_user)):
    await db.circle_invites.update_one({"_id": ObjectId(invite_id), "owner_id": str(user["_id"])}, {"$set": {"status": "cancelled"}})
    return {"ok": True}

# ---------------- Monthly reports (NEW) ----------------
@api.get("/reports/monthly")
async def get_monthly_report(parent_id: str, period: str, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    report = await db.monthly_reports.find_one({"user_id": scope(user), "parent_id": ObjectId(parent_id), "period": period})
    if not report:
        raise HTTPException(status_code=404, detail="No report generated for that period yet.")
    return serialize(report)

@api.post("/reports/monthly/generate")
async def generate_monthly_report_now(parent_id: str, period: str, user: dict = Depends(get_current_user)):
    """Manual 'generate now' action — no automatic monthly cron is wired up yet
    (see README 'Open items': report delivery channel is still undecided)."""
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    year, month = (int(x) for x in period.split("-"))
    plan_id = await _get_plan_id(user)
    report = await generate_monthly_report(scope(user), parent["_id"], plan_id, year, month)
    await audit(user["_id"], "generate_monthly_report", {"parent_id": parent_id, "period": period})
    return report

# ---------------- Parent replies ----------------
FEELING_MAP = {
    "good": {"emoji": "😊", "label": {"en": "Good", "te": "బాగున్నారు", "hi": "ठीक हैं"}},
    "okay": {"emoji": "😐", "label": {"en": "Okay", "te": "ఫర్వాలేదు", "hi": "ठीक-ठाक"}},
    "not_well": {"emoji": "😟", "label": {"en": "Not well", "te": "ఒంట్లో బాలేదు", "hi": "तबीयत ठीक नहीं"}},
    "done": {"emoji": "✅", "label": {"en": "Done", "te": "అయ్యింది", "hi": "हो गया"}},
}

async def _notify_family(owner_id: str, parent, feeling: str | None, is_voice: bool, body: str, keywords: list, ml_flagged: bool = False):
    owner = await db.users.find_one({"_id": ObjectId(owner_id)})
    members = await db.users.find({"household_owner_id": owner_id, "deleted_at": None}).to_list(20)
    recipients = [owner] + members if owner else members
    pname = parent.get("name", "Your parent") if parent else "Your parent"
    if keywords:
        head = f"🚨 {pname} may need attention. They sent: \"{body}\""
    elif ml_flagged:
        head = f"💛 Worth checking in on {pname} — something in their voice note stood out."
    elif is_voice:
        head = f"🎤 {pname} sent you a voice note on WhatsApp. Open the chat to listen 💛"
    elif feeling:
        f = FEELING_MAP.get(feeling, {})
        head = f"💬 {pname} replied: {f.get('emoji','')} {f.get('label',{}).get('en', feeling)}"
    else:
        head = f"💬 {pname} replied: \"{body}\""
    for r in recipients:
        if r and r.get("phone"):
            send_whatsapp(r["phone"], head)
    # On a real emergency, also alert the parent's dedicated emergency contacts.
    if keywords and parent:
        member_phones = {r.get("phone") for r in recipients if r}
        for c in (parent.get("emergency_contacts") or []):
            cph = c.get("phone")
            if cph and cph not in member_phones:
                send_whatsapp(cph, head)

async def _record_reply(from_number: str, body_text: str, num_media: int = 0, parent=None, button_payload: str | None = None, media_url: str | None = None, media_content_type: str | None = None, raw_payload: dict | None = None):
    if parent is None:
        parent = await db.parents.find_one({"phone": from_number, "deleted_at": None})
    if parent:
        await refresh_session(db, parent["_id"])
    is_voice = False
    transcription = None
    intent = None
    lang = parent.get("language", "en") if parent else "en"
    ml_flagged = False
    if button_payload:
        intent = button_payload
    elif media_url and (media_content_type or "").startswith("audio/"):
        is_voice = True
        transcription = await transcribe_voice_note(media_url, language=lang)
        effective_text = transcription or "[voice note]"
        intent = parse_intent(None, effective_text)
        body_text = effective_text
    else:
        last_log = None
        if parent:
            last_log = await db.message_logs.find_one({"parent_id": parent["_id"]}, sort=[("created_at", -1)])
        last_msg_type = (last_log or {}).get("msg_type", "checkin")
        intent = parse_intent(None, body_text, last_msg_type=last_msg_type)
    user_prefs = None
    if parent:
        user_prefs = await db.preferences.find_one({"user_id": parent["user_id"]})
    extra_kw = (user_prefs or {}).get("emergency_keywords", [])
    keywords = detect_emergency(body_text, extra_kw)

    if is_voice and parent:
        assessment = await assess_transcript(db, parent["_id"], body_text, lang, keywords)
        ml_flagged = assessment.get("ml_flagged", False)

    owner_id = parent["user_id"] if parent else None
    reply_doc = {
        "from_phone": from_number, "parent_id": parent["_id"] if parent else None,
        "user_id": owner_id, "body": body_text, "button_payload": button_payload,
        "intent": intent, "is_voice": is_voice, "transcription": transcription,
        "media_url": media_url, "emergency_keywords": keywords, "ml_flagged": ml_flagged,
        "raw_payload": raw_payload or {}, "created_at": datetime.now(timezone.utc),
    }
    await db.parent_replies.insert_one(reply_doc)
    if keywords and parent:
        await db.emergency_events.insert_one({
            "user_id": owner_id, "parent_id": parent["_id"], "phone": from_number,
            "body": body_text, "keywords": keywords, "intent": intent,
            "is_voice": is_voice, "status": "open", "created_at": datetime.now(timezone.utc),
        })
    if parent and owner_id:
        feeling = intent.split(":")[1] if intent and ":" in intent else intent
        await _notify_family(owner_id, parent, feeling, is_voice, body_text, keywords, ml_flagged)
    return reply_doc

@api.get("/replies")
async def list_replies(user: dict = Depends(get_current_user)):
    docs = await db.parent_replies.find({"user_id": scope(user)}).sort("created_at", -1).to_list(100)
    parents = {str(p["_id"]): p.get("name") for p in await db.parents.find({"user_id": scope(user)}).to_list(50)}
    out = []
    for d in docs:
        s = serialize(d)
        s["parent_name"] = parents.get(str(d.get("parent_id")), "Parent")
        out.append(s)
    return out

@api.post("/replies/simulate")
async def simulate_reply(payload: SimulateReplyInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    reply = await _record_reply(parent.get("phone"), payload.text, 0, parent=parent)
    return {"ok": True, "feeling": reply.get("feeling"), "is_voice": reply.get("is_voice")}

# ---------------- WhatsApp webhook ----------------
@api.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    form = await request.form()
    params = dict(form)
    raw_payload = {k: v for k, v in params.items()}
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    if not whatsapp_enabled():
        dev_token = os.environ.get("WEBHOOK_DEV_TOKEN", "").strip()
        if dev_token:
            provided = request.headers.get("X-Dev-Token", "")
            if provided != dev_token:
                raise HTTPException(status_code=403, detail="Invalid dev token")
    elif not verify_twilio_signature(url, params, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
    from_number = (params.get("From", "") or "").replace("whatsapp:", "")
    body_text = (params.get("Body", "") or "").strip()
    button_payload = (params.get("ButtonPayload", "") or "").strip() or None
    num_media = int(params.get("NumMedia", "0") or "0")
    media_url = params.get("MediaUrl0", "") or None
    media_content_type = params.get("MediaContentType0", "") or None
    logger.info("[webhook] Inbound from %s | payload=%s | media=%s | body=%.60s", from_number, button_payload or "–", media_content_type or "–", body_text or "–")
    await _record_reply(
        from_number=from_number, body_text=body_text, num_media=num_media,
        button_payload=button_payload, media_url=media_url,
        media_content_type=media_content_type, raw_payload=raw_payload,
    )
    return Response(content="<Response></Response>", media_type="application/xml")

# ---------------- Account ----------------
@api.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "deleted_at": now, "name": "[deleted]",
        "email": f"deleted_{uid}@ayana.deleted", "phone": "[deleted]",
    }})
    await db.parents.update_many({"user_id": uid}, {"$set": {"deleted_at": now}})
    await db.schedules.update_many({"user_id": uid}, {"$set": {"deleted_at": now, "active": False}})
    await db.activation_state.update_one({"user_id": uid}, {"$set": {"whatsapp_activated": False}})
    await audit(uid, "delete_account")
    return {"ok": True}

@api.get("/account/audit")
async def get_my_audit(user: dict = Depends(get_current_user)):
    docs = await db.audit_logs.find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(50).to_list(50)
    return [
        {"action": d["action"], "meta": d.get("meta", {}), "created_at": d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else str(d.get("created_at"))}
        for d in docs
    ]

# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    total_users = await db.users.count_documents({"role": "user", "deleted_at": None})
    completed = await db.users.count_documents({"role": "user", "onboarding_complete": True, "deleted_at": None})
    activated = await db.activation_state.count_documents({"whatsapp_activated": True})
    parents = await db.parents.count_documents({"deleted_at": None})
    schedules = await db.schedules.count_documents({"deleted_at": None, "active": True})
    messages = await db.message_logs.count_documents({})
    emergencies = await db.emergency_events.count_documents({"status": "open"})
    return {
        "total_users": total_users, "completed_onboarding": completed,
        "activated": activated, "parents": parents, "active_schedules": schedules,
        "messages_delivered": messages, "open_emergencies": emergencies,
        "whatsapp_enabled": whatsapp_enabled(),
    }

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()],
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.parents.create_index("user_id")
    await db.schedules.create_index("user_id")
    await db.message_logs.create_index([("schedule_id", 1), ("message_index", 1), ("day_key", 1)])
    await db.wa_sessions.create_index([('parent_id', 1)], unique=True, sparse=True)
    await db.phone_otps.create_index("phone", unique=True)
    await db.phone_otps.create_index("expires_at", expireAfterSeconds=3600)
    await db.circle_invites.create_index("expires_at", expireAfterSeconds=86400)
    await db.distress_logs.create_index([("parent_id", 1), ("created_at", -1)])
    await db.monthly_reports.create_index([("user_id", 1), ("parent_id", 1), ("period", 1)], unique=True)
    await seed_admin()
    start_scheduler()
    logger.info("AYANA-BOT backend ready")

@app.on_event("shutdown")
async def on_shutdown():
    shutdown_scheduler()
    client.close()