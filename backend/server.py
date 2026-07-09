import logging
import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import Body, Depends, FastAPI, APIRouter, HTTPException, Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from models import (
    RegisterInput, LoginInput, ChildProfileInput, ParentInput,
    ScheduleInput, PreferencesInput, ConsentInput,
)
from auth import (
    hash_password, verify_password, create_access_token, serialize,
    get_current_user, get_current_admin, seed_admin,
)
from templates_data import (
    MESSAGE_TEMPLATES, LANGUAGES, RELATIONSHIPS, DEFAULT_EMERGENCY_KEYWORDS,
    render_message, public_categories, category_type,
)
from pricing import PLANS, CURRENCIES, PLAN_BY_ID, plan_limits
from whatsapp import send_whatsapp, verify_twilio_signature, detect_emergency, whatsapp_enabled
from scheduler import start_scheduler, shutdown_scheduler
from email_sender import send_invite_email

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ayana")


# ---------------------------------------------------------------------------
# Rate limiter  (slowapi — in-memory, no Redis needed for MVP)
# ---------------------------------------------------------------------------
_limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])


# ---------------------------------------------------------------------------
# Lifespan — replaces deprecated @app.on_event (FastAPI ≥ 0.93)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await db.users.create_index("email", unique=True)
    await db.parents.create_index("user_id")
    await db.schedules.create_index("user_id")
    await db.message_logs.create_index(
        [("schedule_id", 1), ("message_index", 1), ("day_key", 1)]
    )
    await seed_admin()
    start_scheduler()
    logger.info("AYANA-BOT backend ready")
    yield
    # ── Shutdown ──
    shutdown_scheduler()
    client.close()


app = FastAPI(title="AYANA-BOT API", lifespan=lifespan)
app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api = APIRouter(prefix="/api")


async def audit(user_id, action, meta=None):
    await db.audit_logs.insert_one({
        "user_id": str(user_id) if user_id else None,
        "action": action,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    })


def scope(user) -> str:
    """The user_id that owns the household data. Members share the owner's scope."""
    return user.get("household_owner_id") or str(user["_id"])


def is_member(user) -> bool:
    return bool(user.get("household_owner_id"))


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
        "message_templates": {
            k: {"label": v["label"], "icon": v["icon"], "type": v["type"]}
            for k, v in MESSAGE_TEMPLATES.items()
        },
        "plans": PLANS,
        "currencies": CURRENCIES,
        "training_video_url": os.environ.get("TRAINING_VIDEO_URL", ""),
    }


# ---------------- Auth ----------------
@api.post("/auth/register")
@_limiter.limit("5/minute")
async def register(request: Request, payload: RegisterInput):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    # Auto-link if this email was invited to a care circle
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
        await db.payment_state.insert_one({"user_id": uid, "status": "trial", "plan": "basic", "billing": "month", "updated_at": datetime.now(timezone.utc)})
    await audit(uid, "register", {"linked_household": household_owner_id})
    token = create_access_token(uid, email, "user")
    user = await db.users.find_one({"_id": res.inserted_id})
    return {"token": token, "user": serialize(user)}


@api.post("/auth/login")
@_limiter.limit("10/minute")
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


# ---------------- Child profile (self) ----------------
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
    uid = scope(user)
    # ── Enforce plan parent limit ──
    ps = await db.payment_state.find_one({"user_id": uid})
    plan_id = (ps or {}).get("plan", "basic")
    max_parents = plan_limits(plan_id).get("parents", 2)
    current_count = await db.parents.count_documents({"user_id": uid, "deleted_at": None})
    if current_count >= max_parents:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Your plan allows up to {max_parents} parent(s). "
                "Upgrade to Care+ to add more."
            ),
        )
    doc = payload.model_dump()
    doc.update({"user_id": uid, "created_at": datetime.now(timezone.utc), "deleted_at": None})
    res = await db.parents.insert_one(doc)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 2)}},
    )
    await audit(user["_id"], "create_parent", {"parent_id": str(res.inserted_id)})
    return serialize(await db.parents.find_one({"_id": res.inserted_id}))


@api.put("/parents/{parent_id}")
async def update_parent(parent_id: str, payload: ParentInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    # Guard: only update live (non-deleted) records
    await db.parents.update_one(
        {"_id": ObjectId(parent_id), "deleted_at": None},
        {"$set": payload.model_dump()},
    )
    return serialize(await db.parents.find_one({"_id": ObjectId(parent_id)}))


@api.delete("/parents/{parent_id}")
async def delete_parent(parent_id: str, user: dict = Depends(get_current_user)):
    await db.parents.update_one({"_id": ObjectId(parent_id), "user_id": scope(user)},
                                {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await db.schedules.update_many({"parent_id": ObjectId(parent_id)}, {"$set": {"deleted_at": datetime.now(timezone.utc), "active": False}})
    return {"ok": True}


# ---------------- Schedules ----------------
@api.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    docs = await db.schedules.find({"user_id": scope(user), "deleted_at": None}).to_list(50)
    return [serialize(d) for d in docs]


async def _validate_by_plan(user, messages):
    ps = await db.payment_state.find_one({"user_id": scope(user)})
    plan_id = (ps or {}).get("plan", "basic")
    limits = plan_limits(plan_id)
    if not messages:
        raise HTTPException(status_code=400, detail="Add at least one daily check-in.")
    checkins = sum(1 for m in messages if category_type(m.category) == "checkin")
    reminders = sum(1 for m in messages if category_type(m.category) == "reminder")
    if checkins > limits["checkins"]:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {limits['checkins']} daily check-ins. Upgrade to Care+ for more.")
    if reminders > limits["reminders"]:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {limits['reminders']} reminders. Upgrade to Care+ for more.")
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
    }})
    return serialize(await db.schedules.find_one({"_id": ObjectId(schedule_id)}))


@api.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    await db.schedules.update_one({"_id": ObjectId(schedule_id), "user_id": scope(user)},
                                  {"$set": {"deleted_at": datetime.now(timezone.utc), "active": False}})
    return {"ok": True}


# ---------------- Consent ----------------
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


# ---------------- Preferences ----------------
@api.put("/preferences")
async def update_prefs(payload: PreferencesInput, user: dict = Depends(get_current_user)):
    # Use MongoDB dot-notation to patch individual preference keys
    # instead of $set: {preferences: {...}} which would wipe the whole object.
    upd = {f"preferences.{k}": v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
    return serialize(await db.users.find_one({"_id": user["_id"]}))


# ---------------- Payment (feature-flagged, disabled) ----------------
@api.get("/payment/state")
async def payment_state(user: dict = Depends(get_current_user)):
    state = await db.payment_state.find_one({"user_id": scope(user)})
    return {
        "payments_enabled": os.environ.get("PAYMENTS_ENABLED", "false").lower() == "true",
        "state": serialize(state) if state else {"status": "trial", "plan": "basic", "billing": "month"},
        "plans": PLANS,
        "currencies": CURRENCIES,
    }


@api.post("/payment/checkout")
async def payment_checkout(body: dict = Body(default={}), user: dict = Depends(get_current_user)):
    if is_member(user):
        raise HTTPException(status_code=403, detail="Only the account owner can change the plan.")
    plan = body.get("plan", "basic")
    billing = body.get("billing", "month")
    if plan not in PLAN_BY_ID:
        plan = "basic"
    if os.environ.get("PAYMENTS_ENABLED", "false").lower() != "true":
        # Test mode: skip payment, store chosen plan, grant trial and continue the flow.
        await db.payment_state.update_one(
            {"user_id": str(user["_id"])},
            {"$set": {"status": "trial", "plan": plan, "billing": billing, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 3)}})
        await audit(user["_id"], "payment_skipped_test_mode", {"plan": plan, "billing": billing})
        return {"skipped": True, "plan": plan, "message": "Payments are disabled in testing mode. Trial access granted."}
    # Real payment integration would go here (Stripe/Razorpay), behind the flag.
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
    results = []
    video = os.environ.get("TRAINING_VIDEO_URL", "").strip()
    for p in parents:
        lang = p.get("language", "en")
        name = p.get("name", "")
        greet = render_message("morning_wish", lang, name, with_footer=False)
        intro = {
            "en": f"🌸 Hi {name}! From today, your family has set up warm daily messages just for you on WhatsApp. 💛",
            "te": f"🌸 హాయ్ {name}! ఈరోజు నుండి మీ కుటుంబం మీ కోసం రోజూ ప్రేమతో మెసేజ్‌లు పెట్టారు. 💛",
            "hi": f"🌸 हाय {name}! आज से आपके परिवार ने आपके लिए रोज़ प्यार भरे मैसेज सेट किए हैं। 💛",
        }.get(lang)
        howto = {
            "en": "\n\nReplying is easy: tap a number option, or hold the 🎤 mic button to send a voice note.",
            "te": "\n\nరిప్లై చాలా సులభం: నంబర్ ఆప్షన్ నొక్కండి, లేదా 🎤 మైక్ నొక్కి వాయిస్ పంపండి.",
            "hi": "\n\nजवाब देना आसान है: कोई नंबर चुनें, या 🎤 माइक दबाकर वॉइस भेजें।",
        }.get(lang)
        welcome = f"{intro}\n\n{greet}{howto}"
        if video:
            welcome += {
                "en": f"\n\n▶️ Watch how to reply: {video}",
                "te": f"\n\n▶️ ఎలా రిప్లై చేయాలో చూడండి: {video}",
                "hi": f"\n\n▶️ जवाब कैसे दें, देखें: {video}",
            }.get(lang)
        r = send_whatsapp(p.get("phone"), welcome)
        results.append({"parent": p.get("name"), "status": r.get("status")})
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
async def message_logs(user: dict = Depends(get_current_user)):
    docs = await db.message_logs.find({"user_id": scope(user)}).sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]


@api.post("/messages/send-test")
async def send_test_message(body: dict, user: dict = Depends(get_current_user)):
    parent_id = body.get("parent_id")
    category = body.get("category", "how_feeling")
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    text = render_message(category, parent.get("language", "en"), parent.get("name", ""))
    result = send_whatsapp(parent.get("phone"), text)
    await db.message_logs.insert_one({
        "user_id": scope(user), "parent_id": parent["_id"], "schedule_id": None,
        "message_index": -1, "day_key": datetime.now(timezone.utc).strftime("%Y-%m-%d-test"),
        "category": category, "body": text, "status": result.get("status"),
        "detail": result.get("detail"), "sid": result.get("sid"),
        "created_at": datetime.now(timezone.utc),
    })
    await audit(user["_id"], "send_test_message", {"parent": parent.get("name"), "status": result.get("status")})
    return {"status": result.get("status"), "detail": result.get("detail"), "text": text}


@api.post("/messages/preview")
async def preview_message(body: dict, user: dict = Depends(get_current_user)):
    category = body.get("category", "love_note")
    language = body.get("language", "en")
    name = body.get("name", "Amma")
    custom = body.get("custom_text")
    return {"text": render_message(category, language, name, custom)}


# ---------------- Care Circle (Care+ co-care) ----------------
@api.get("/circle")
async def get_circle(user: dict = Depends(get_current_user)):
    if is_member(user):
        owner = await db.users.find_one({"_id": ObjectId(user["household_owner_id"])})
        return {"role": "member", "owner": {"name": owner.get("name") if owner else "", "email": owner.get("email") if owner else ""}}
    uid = str(user["_id"])
    ps = await db.payment_state.find_one({"user_id": uid})
    plan_id = (ps or {}).get("plan", "basic")
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
async def invite_member(body: dict, user: dict = Depends(get_current_user)):
    if is_member(user):
        raise HTTPException(status_code=403, detail="Only the account owner can invite family members.")
    uid = str(user["_id"])
    ps = await db.payment_state.find_one({"user_id": uid})
    plan_id = (ps or {}).get("plan", "basic")
    max_members = plan_limits(plan_id).get("family_members", 1)
    if max_members <= 1:
        raise HTTPException(status_code=403, detail="Family co-care is a Care+ feature. Upgrade to invite siblings.")
    email = (body.get("email") or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if email == user.get("email"):
        raise HTTPException(status_code=400, detail="That's your own email 🙂")
    current = await db.users.count_documents({"household_owner_id": uid, "deleted_at": None})
    pending = await db.circle_invites.count_documents({"owner_id": uid, "status": "pending"})
    if current + pending >= max_members:
        raise HTTPException(status_code=400, detail=f"Your plan allows up to {max_members} family members.")
    if await db.circle_invites.find_one({"owner_id": uid, "email": email, "status": "pending"}):
        raise HTTPException(status_code=400, detail="You've already invited this email.")
    tok = secrets.token_urlsafe(24)
    await db.circle_invites.insert_one({
        "owner_id": uid, "email": email, "token": tok, "status": "pending",
        "created_at": datetime.now(timezone.utc),
    })
    await audit(uid, "circle_invite", {"email": email})
    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{frontend}/signup?invite={email}" if frontend else f"/signup?invite={email}"
    # ── Send invite email (fires-and-forgets result; never blocks the API) ──
    email_result = await send_invite_email(
        to_email=email,
        owner_name=user.get("name", "Someone"),
        invite_link=link,
    )
    logger.info("Care circle invite for %s → email_status=%s", email, email_result.get("status"))
    return {"ok": True, "email": email, "invite_link": link, "email_status": email_result.get("status")}


@api.post("/circle/accept")
async def accept_invite(user: dict = Depends(get_current_user)):
    invite = await db.circle_invites.find_one({"email": user.get("email"), "status": "pending"})
    if not invite:
        raise HTTPException(status_code=404, detail="No pending invite for your email.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"household_owner_id": invite["owner_id"], "onboarding_complete": True}})
    await db.circle_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc), "member_id": str(user["_id"])}})
    return {"ok": True}


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


# ---------------- Parent replies: parsing + notify child ----------------
FEELING_MAP = {
    "good": {"emoji": "😊", "label": {"en": "Good", "te": "బాగున్నారు", "hi": "ठीक हैं"}},
    "okay": {"emoji": "🙂", "label": {"en": "Okay", "te": "ఫర్వాలేదు", "hi": "ठीक-ठाक"}},
    "not_well": {"emoji": "😟", "label": {"en": "Not well", "te": "ఒంట్లో బాలేదు", "hi": "तबीयत ठीक नहीं"}},
    "done": {"emoji": "✅", "label": {"en": "Done", "te": "అయ్యింది", "hi": "हो गया"}},
}
_GOOD = ["1", "good", "fine", "great", "బాగున్నా", "బాగుంది", "ठीक हूँ", "अच्छा"]
_OKAY = ["2", "okay", "ok", "theek", "ఫర్వాలేదు", "పర్వాలేదు", "ठीक-ठाक", "ठीक ठाक"]
_BAD = ["3", "not well", "sick", "bad", "ఒంట్లో బాలేదు", "బాలేదు", "तबीयत ठीक नहीं", "बीमार"]
_DONE = ["yes", "done", "అయ్యింది", "వేసుకున్నా", "हो गया", "ले लिया"]


def _word_in(text: str, keywords: list[str]) -> bool:
    """
    Return True if any keyword appears as a whole word in text.

    Strategy:
      • ASCII keywords  → regex \\b word boundary (so "bad" won't match "badam").
      • Indic / Telugu  → plain substring match (no ASCII word boundaries exist
        in Devanagari / Telugu scripts, but the phrases are distinct enough).
    """
    t_lower = text.lower()
    for kw in keywords:
        if kw.isascii():
            if re.search(r"\b" + re.escape(kw) + r"\b", t_lower, re.IGNORECASE):
                return True
        else:
            if kw.lower() in t_lower:
                return True
    return False


def parse_reply(text: str) -> str | None:
    """Parse a parent's WhatsApp reply into a structured feeling label."""
    if not text:
        return None
    t = text.strip()
    # Check worst-case first so we don't accidentally mark "bad" replies as "good"
    if _word_in(t, _BAD):
        return "not_well"
    if _word_in(t, _GOOD):
        return "good"
    if _word_in(t, _OKAY):
        return "okay"
    if _word_in(t, _DONE):
        return "done"
    return None


async def _notify_family(owner_id: str, parent, feeling: str | None, is_voice: bool, body: str, keywords: list):
    owner = await db.users.find_one({"_id": ObjectId(owner_id)})
    members = await db.users.find({"household_owner_id": owner_id, "deleted_at": None}).to_list(20)
    recipients = [owner] + members if owner else members
    pname = parent.get("name", "Your parent") if parent else "Your parent"
    if keywords:
        head = f"🚨 {pname} may need attention. They sent: \"{body}\""
    elif is_voice:
        head = f"🎤 {pname} sent you a voice note on WhatsApp. Open the chat to listen 💛"
    elif feeling:
        f = FEELING_MAP.get(feeling, {})
        head = f"💬 {pname} replied to your check-in: {f.get('emoji','')} {f.get('label',{}).get('en', feeling)}"
    else:
        head = f"💬 {pname} replied: \"{body}\""
    for r in recipients:
        if r and r.get("phone"):
            send_whatsapp(r["phone"], head)


async def _record_reply(from_number, body_text, num_media=0, parent=None):
    if parent is None:
        parent = await db.parents.find_one({"phone": from_number, "deleted_at": None})
    is_voice = num_media and int(num_media) > 0
    feeling = parse_reply(body_text)
    keywords = detect_emergency(body_text)
    owner_id = parent["user_id"] if parent else None
    reply_doc = {
        "from_phone": from_number,
        "parent_id": parent["_id"] if parent else None,
        "user_id": owner_id,
        "body": body_text,
        "feeling": feeling,
        "is_voice": bool(is_voice),
        "emergency_keywords": keywords,
        "created_at": datetime.now(timezone.utc),
    }
    await db.parent_replies.insert_one(reply_doc)
    if keywords and parent:
        await db.emergency_events.insert_one({
            "user_id": owner_id, "parent_id": parent["_id"], "phone": from_number,
            "body": body_text, "keywords": keywords, "status": "open",
            "created_at": datetime.now(timezone.utc),
        })
    if parent and owner_id:
        await _notify_family(owner_id, parent, feeling, bool(is_voice), body_text, keywords)
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
async def simulate_reply(body: dict, user: dict = Depends(get_current_user)):
    """Demo/testing helper: simulate a parent's WhatsApp reply and trigger the family notification."""
    parent_id = body.get("parent_id")
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": scope(user), "deleted_at": None})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    reply = await _record_reply(parent.get("phone"), body.get("text", ""), body.get("num_media", 0), parent=parent)
    return {"ok": True, "feeling": reply.get("feeling"), "is_voice": reply.get("is_voice")}


# ---------------- WhatsApp inbound webhook ----------------
@api.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    form = await request.form()
    params = dict(form)
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    if not verify_twilio_signature(url, params, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")
    from_number = (params.get("From", "") or "").replace("whatsapp:", "")
    await _record_reply(from_number, params.get("Body", ""), params.get("NumMedia", 0))
    return Response(content="<Response></Response>", media_type="application/xml")


# ---------------- Account deletion (privacy) ----------------
@api.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"deleted_at": now}})
    await db.parents.update_many({"user_id": uid}, {"$set": {"deleted_at": now}})
    await db.schedules.update_many({"user_id": uid}, {"$set": {"deleted_at": now, "active": False}})
    await db.activation_state.update_one({"user_id": uid}, {"$set": {"whatsapp_activated": False}})
    await audit(uid, "delete_account")
    return {"ok": True}


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


@api.get("/admin/users")
async def admin_users(
    admin: dict = Depends(get_current_admin),
    skip: int = 0,
    limit: int = 50,
):
    limit = max(1, min(limit, 100))  # clamp: 1–100
    skip = max(0, skip)
    total = await db.users.count_documents({"role": "user"})
    users = (
        await db.users.find({"role": "user"})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    out = []
    for u in users:
        uid = str(u["_id"])
        act = await db.activation_state.find_one({"user_id": uid})
        pcount = await db.parents.count_documents({"user_id": uid, "deleted_at": None})
        scount = await db.schedules.count_documents({"user_id": uid, "deleted_at": None})
        s = serialize(u)
        s["activated"] = bool(act and act.get("whatsapp_activated"))
        s["parents_count"] = pcount
        s["schedules_count"] = scount
        out.append(s)
    return {"total": total, "skip": skip, "limit": limit, "items": out}


@api.get("/admin/messages")
async def admin_messages(
    admin: dict = Depends(get_current_admin),
    skip: int = 0,
    limit: int = 100,
):
    limit = max(1, min(limit, 200))  # clamp: 1–200
    skip = max(0, skip)
    total = await db.message_logs.count_documents({})
    docs = (
        await db.message_logs.find({})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    return {"total": total, "skip": skip, "limit": limit, "items": [serialize(d) for d in docs]}


@api.get("/admin/emergencies")
async def admin_emergencies(admin: dict = Depends(get_current_admin)):
    docs = await db.emergency_events.find({}).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]


app.include_router(api)

# Build a strict allowed-origins list.
# Default to localhost for dev; set CORS_ORIGINS=https://yourdomain.com in production.
_cors_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Twilio-Signature"],
)


# Startup and shutdown are handled by the lifespan context manager above.
