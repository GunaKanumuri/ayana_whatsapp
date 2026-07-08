import logging
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import Depends, FastAPI, APIRouter, HTTPException, Request, Response
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
    MESSAGE_TEMPLATES, LANGUAGES, RELATIONSHIPS, DEFAULT_EMERGENCY_KEYWORDS, render_message,
)
from whatsapp import send_whatsapp, verify_twilio_signature, detect_emergency, whatsapp_enabled
from scheduler import start_scheduler, shutdown_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ayana")

app = FastAPI(title="AYANA-BOT API")
api = APIRouter(prefix="/api")


async def audit(user_id, action, meta=None):
    await db.audit_logs.insert_one({
        "user_id": str(user_id) if user_id else None,
        "action": action,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    })


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
        "message_templates": {
            k: {"label": v["label"], "icon": v["icon"], "preview": v["en"]}
            for k, v in MESSAGE_TEMPLATES.items()
        },
    }


# ---------------- Auth ----------------
@api.post("/auth/register")
async def register(payload: RegisterInput):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    doc = {
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "user",
        "onboarding_complete": False,
        "onboarding_step": 0,
        "city": None,
        "timezone": None,
        "created_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    await db.activation_state.insert_one({"user_id": uid, "whatsapp_activated": False, "activated_at": None})
    await db.payment_state.insert_one({"user_id": uid, "status": "trial", "plan": "care_basic", "updated_at": datetime.now(timezone.utc)})
    await audit(uid, "register")
    token = create_access_token(uid, email, "user")
    user = await db.users.find_one({"_id": res.inserted_id})
    return {"token": token, "user": serialize(user)}


@api.post("/auth/login")
async def login(payload: LoginInput):
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
    docs = await db.parents.find({"user_id": str(user["_id"]), "deleted_at": None}).to_list(50)
    return [serialize(d) for d in docs]


@api.post("/parents")
async def create_parent(payload: ParentInput, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"user_id": str(user["_id"]), "created_at": datetime.now(timezone.utc), "deleted_at": None})
    res = await db.parents.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 2)}})
    await audit(user["_id"], "create_parent", {"parent_id": str(res.inserted_id)})
    return serialize(await db.parents.find_one({"_id": res.inserted_id}))


@api.put("/parents/{parent_id}")
async def update_parent(parent_id: str, payload: ParentInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(parent_id), "user_id": str(user["_id"])})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    await db.parents.update_one({"_id": ObjectId(parent_id)}, {"$set": payload.model_dump()})
    return serialize(await db.parents.find_one({"_id": ObjectId(parent_id)}))


@api.delete("/parents/{parent_id}")
async def delete_parent(parent_id: str, user: dict = Depends(get_current_user)):
    await db.parents.update_one({"_id": ObjectId(parent_id), "user_id": str(user["_id"])},
                                {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await db.schedules.update_many({"parent_id": ObjectId(parent_id)}, {"$set": {"deleted_at": datetime.now(timezone.utc), "active": False}})
    return {"ok": True}


# ---------------- Schedules ----------------
@api.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    docs = await db.schedules.find({"user_id": str(user["_id"]), "deleted_at": None}).to_list(50)
    return [serialize(d) for d in docs]


@api.post("/schedules")
async def create_schedule(payload: ScheduleInput, user: dict = Depends(get_current_user)):
    parent = await db.parents.find_one({"_id": ObjectId(payload.parent_id), "user_id": str(user["_id"])})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    limit = 5 if payload.mode == "normal" else 10
    if len(payload.messages) > limit:
        raise HTTPException(status_code=400, detail=f"{payload.mode} mode allows up to {limit} daily messages.")
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Add at least one daily message.")
    doc = {
        "user_id": str(user["_id"]),
        "parent_id": ObjectId(payload.parent_id),
        "mode": payload.mode,
        "messages": [m.model_dump() for m in payload.messages],
        "active": payload.active,
        "created_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    res = await db.schedules.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_step": max(user.get("onboarding_step", 0), 3)}})
    await audit(user["_id"], "create_schedule", {"schedule_id": str(res.inserted_id)})
    return serialize(await db.schedules.find_one({"_id": res.inserted_id}))


@api.put("/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, payload: ScheduleInput, user: dict = Depends(get_current_user)):
    sched = await db.schedules.find_one({"_id": ObjectId(schedule_id), "user_id": str(user["_id"])})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    limit = 5 if payload.mode == "normal" else 10
    if len(payload.messages) > limit:
        raise HTTPException(status_code=400, detail=f"{payload.mode} mode allows up to {limit} daily messages.")
    await db.schedules.update_one({"_id": ObjectId(schedule_id)}, {"$set": {
        "mode": payload.mode,
        "messages": [m.model_dump() for m in payload.messages],
        "active": payload.active,
    }})
    return serialize(await db.schedules.find_one({"_id": ObjectId(schedule_id)}))


@api.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    await db.schedules.update_one({"_id": ObjectId(schedule_id), "user_id": str(user["_id"])},
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
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"preferences": upd}})
    return serialize(await db.users.find_one({"_id": user["_id"]}))


# ---------------- Payment (feature-flagged, disabled) ----------------
@api.get("/payment/state")
async def payment_state(user: dict = Depends(get_current_user)):
    state = await db.payment_state.find_one({"user_id": str(user["_id"])})
    return {
        "payments_enabled": os.environ.get("PAYMENTS_ENABLED", "false").lower() == "true",
        "state": serialize(state) if state else {"status": "trial", "plan": "care_basic"},
    }


@api.post("/payment/checkout")
async def payment_checkout(user: dict = Depends(get_current_user)):
    if os.environ.get("PAYMENTS_ENABLED", "false").lower() != "true":
        # Test mode: skip payment, grant trial and continue the flow.
        await db.payment_state.update_one(
            {"user_id": str(user["_id"])},
            {"$set": {"status": "trial", "plan": "care_basic", "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        await audit(user["_id"], "payment_skipped_test_mode")
        return {"skipped": True, "message": "Payments are disabled in testing mode. Trial access granted."}
    # Real payment integration would go here (Stripe/Razorpay), behind the flag.
    raise HTTPException(status_code=501, detail="Live payments are not enabled yet.")


# ---------------- Activation ----------------
@api.get("/activation")
async def get_activation(user: dict = Depends(get_current_user)):
    state = await db.activation_state.find_one({"user_id": str(user["_id"])})
    return serialize(state) if state else {"whatsapp_activated": False}


@api.post("/activation/activate")
async def activate(user: dict = Depends(get_current_user)):
    parents = await db.parents.find({"user_id": str(user["_id"]), "deleted_at": None}).to_list(50)
    schedules = await db.schedules.find({"user_id": str(user["_id"]), "deleted_at": None}).to_list(50)
    if not parents or not schedules:
        raise HTTPException(status_code=400, detail="Please add a parent and a schedule before activating.")
    results = []
    for p in parents:
        welcome = render_message("morning_wish", p.get("language", "en"), p.get("name", ""))
        welcome = (
            f"🌸 AYANA Care Circle activated. {p.get('name','')} will now receive warm daily check-ins.\n\n"
            + welcome
        )
        r = send_whatsapp(p.get("phone"), welcome)
        results.append({"parent": p.get("name"), "status": r.get("status")})
    await db.activation_state.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"whatsapp_activated": True, "activated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"onboarding_complete": True, "onboarding_step": 5}})
    await audit(user["_id"], "activate_whatsapp", {"results": results})
    return {"activated": True, "whatsapp_enabled": whatsapp_enabled(), "results": results}


# ---------------- Message logs / dashboard ----------------
@api.get("/messages/logs")
async def message_logs(user: dict = Depends(get_current_user)):
    docs = await db.message_logs.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(100)
    return [serialize(d) for d in docs]


@api.post("/messages/preview")
async def preview_message(body: dict, user: dict = Depends(get_current_user)):
    category = body.get("category", "love_note")
    language = body.get("language", "en")
    name = body.get("name", "Amma")
    custom = body.get("custom_text")
    return {"text": render_message(category, language, name, custom)}


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
    body_text = params.get("Body", "")
    parent = await db.parents.find_one({"phone": from_number, "deleted_at": None})
    keywords = detect_emergency(body_text)
    reply_doc = {
        "from_phone": from_number,
        "parent_id": parent["_id"] if parent else None,
        "user_id": parent["user_id"] if parent else None,
        "body": body_text,
        "emergency_keywords": keywords,
        "created_at": datetime.now(timezone.utc),
    }
    await db.parent_replies.insert_one(reply_doc)
    if keywords and parent:
        await db.emergency_events.insert_one({
            "user_id": parent["user_id"],
            "parent_id": parent["_id"],
            "phone": from_number,
            "body": body_text,
            "keywords": keywords,
            "status": "open",
            "created_at": datetime.now(timezone.utc),
        })
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
async def admin_users(admin: dict = Depends(get_current_admin)):
    users = await db.users.find({"role": "user"}).sort("created_at", -1).to_list(500)
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
    return out


@api.get("/admin/messages")
async def admin_messages(admin: dict = Depends(get_current_admin)):
    docs = await db.message_logs.find({}).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]


@api.get("/admin/emergencies")
async def admin_emergencies(admin: dict = Depends(get_current_admin)):
    docs = await db.emergency_events.find({}).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.parents.create_index("user_id")
    await db.schedules.create_index("user_id")
    await db.message_logs.create_index([("schedule_id", 1), ("message_index", 1), ("day_key", 1)])
    await seed_admin()
    start_scheduler()
    logger.info("AYANA-BOT backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    shutdown_scheduler()
    client.close()
