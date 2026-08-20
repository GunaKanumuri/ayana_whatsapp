import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]

# Explicit pool sizing instead of driver defaults — tune via env once you
# know real concurrent load. maxPoolSize caps concurrent connections per
# process; with N API replicas + 1 scheduler worker, total Mongo
# connections ≈ N * maxPoolSize + scheduler's own pool.
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=int(os.environ.get("MONGO_MAX_POOL_SIZE", "50")),
    minPoolSize=int(os.environ.get("MONGO_MIN_POOL_SIZE", "5")),
)
db = client[os.environ["DB_NAME"]]


async def ensure_indexes():
    """
    Single source of truth for indexes — called once at startup by
    server.py. Split out from server.py so scheduler-only worker
    processes (see scheduler.py's distributed lock) can also call this
    without importing the whole FastAPI app.
    """
    await db.users.create_index("email", unique=True)

    # Hot path: every inbound WhatsApp webhook does parents.find_one({"phone": ...})
    # with no index previously — was a full collection scan per message.
    await db.parents.create_index("phone")
    await db.parents.create_index("user_id")

    # Hot path: scheduler's _deliver_due_messages runs every 1 min over
    # all active schedules; _check_reengagement every 15 min.
    await db.schedules.create_index("user_id")
    await db.schedules.create_index([("parent_id", 1), ("active", 1), ("deleted_at", 1)])
    await db.schedules.create_index([("recovery_mode", 1), ("recovery_until", 1), ("deleted_at", 1)])

    await db.message_logs.create_index([("schedule_id", 1), ("message_index", 1), ("day_key", 1)])
    await db.message_logs.create_index([("parent_id", 1), ("day_key", 1)])

    await db.wa_sessions.create_index([("parent_id", 1)], unique=True, sparse=True)
    await db.wa_sessions.create_index([("opener_sent_at", 1), ("reengagement_sent", 1)])

    await db.phone_otps.create_index("phone", unique=True)
    await db.phone_otps.create_index("expires_at", expireAfterSeconds=3600)

    await db.circle_invites.create_index("expires_at", expireAfterSeconds=86400)

    await db.distress_logs.create_index([("parent_id", 1), ("created_at", -1)])

    await db.monthly_reports.create_index([("user_id", 1), ("parent_id", 1), ("period", 1)], unique=True)

    # JWT blacklist for token revocation on logout (auto-expires with TTL)
    await db.jwt_blacklist.create_index("jti", unique=True)
    await db.jwt_blacklist.create_index("expires_at", expireAfterSeconds=0)

    # Preferences now lives on a real, queried collection (was previously
    # a dead read from db.preferences while writes went to db.users —
    # see server.py's _get_emergency_keywords). Index for the read path.
    await db.users.create_index("household_owner_id")

    # Scheduler distributed lock (see scheduler.py) — TTL index so a
    # crashed holder's lock self-expires instead of wedging forever.
    await db.scheduler_locks.create_index("expires_at", expireAfterSeconds=0)

    # NOTE: wa_content_cache collection (Twilio Content SID cache) removed
    # in Meta Cloud API migration — interactive buttons are now inline.

    # Dynamic translation cache (see translation_engine.py) — one doc
    # per (category, language) for languages beyond the static en/te/hi set.
    await db.template_variants_cache.create_index([("category", 1), ("language", 1)], unique=True)