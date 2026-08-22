"""
payments.py — Stripe checkout for AYANA, gated behind PAYMENTS_ENABLED.

Uses the official `stripe` SDK directly (Checkout Sessions, async client).
All amounts are defined server-side from pricing.py — the frontend only
ever sends {plan, billing, origin_url}.

While PAYMENTS_ENABLED != "true", server.py keeps its existing trial/test
"skip" behaviour and never calls into this module — so flipping the flag
(plus setting real STRIPE_API_KEY / STRIPE_WEBHOOK_SECRET) is the only
switch needed to go live.

Requires: pip install stripe>=7  (create_async / retrieve_async need v7+)
Env vars:
  STRIPE_API_KEY         — sk_test_... / sk_live_...
  STRIPE_WEBHOOK_SECRET   — whsec_... (from the Stripe Dashboard webhook config)
"""

import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from pricing import PLAN_BY_ID, resolve_plan_id

logger = logging.getLogger("ayana.payments")

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

if not STRIPE_API_KEY:
    logger.warning("STRIPE_API_KEY not set — payment endpoints will fail once PAYMENTS_ENABLED=true")

stripe.api_key = STRIPE_API_KEY


def payments_enabled() -> bool:
    return os.environ.get("PAYMENTS_ENABLED", "false").strip().lower() == "true"


def _plan_amount_cents(plan_id: str, billing: str) -> int:
    """Server-side authoritative price in USD cents (int). Never trust the client."""
    plan = PLAN_BY_ID.get(resolve_plan_id(plan_id)) or PLAN_BY_ID["nitya"]
    usd = plan["price"]["USD"]
    amount = float(usd.get("year") if billing == "year" else usd.get("month"))
    return round(amount * 100)


payments_router = APIRouter(prefix="/api")


class PaymentCheckoutInput(BaseModel):
    plan: str = Field("nitya")
    billing: str = Field("month", pattern="^(month|year)$")
    origin_url: str


async def create_stripe_checkout(user_id: str, payload: PaymentCheckoutInput, request: Request) -> dict:
    """Create a Stripe Checkout session for a plan. Called by server.py's
    /payment/checkout only when PAYMENTS_ENABLED is true."""
    plan_id = resolve_plan_id(payload.plan)
    plan = PLAN_BY_ID.get(plan_id) or PLAN_BY_ID["nitya"]
    amount_cents = _plan_amount_cents(plan_id, payload.billing)
    origin = payload.origin_url.rstrip("/")

    try:
        session = await stripe.checkout.Session.create_async(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": f"AYANA — {plan.get('name', plan_id)} ({payload.billing}ly)",
                    },
                },
                "quantity": 1,
            }],
            success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/payment/cancel",
            metadata={"user_id": user_id, "plan": plan_id, "billing": payload.billing},
        )
    except stripe.error.StripeError as e:
        logger.error("[stripe] checkout session creation failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": user_id,
        "plan": plan_id,
        "billing": payload.billing,
        "amount": amount_cents / 100,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@payments_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    """Unauthenticated status poll — returns only non-sensitive fields."""
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if record.get("payment_status") != "paid" and payments_enabled():
        try:
            session = await stripe.checkout.Session.retrieve_async(session_id)
            if session.payment_status == "paid" or session.status == "complete":
                await _mark_paid(session_id, record)
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError as e:
            logger.warning("[stripe] status poll failed for %s: %s", session_id, e)

    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
    }


async def _mark_paid(session_id: str, record: dict) -> None:
    """Idempotently flip a transaction to paid AND upgrade the user's plan."""
    res = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid",
                  "updated_at": datetime.now(timezone.utc)}},
    )
    if res.modified_count and record.get("user_id"):
        await db.payment_state.update_one(
            {"user_id": record["user_id"]},
            {"$set": {"status": "active", "plan": record.get("plan", "nitya"),
                      "billing": record.get("billing", "month"),
                      "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )


@payments_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("[stripe] STRIPE_WEBHOOK_SECRET not set — rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.warning("[stripe] webhook verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session.get("id")
        if session.get("payment_status") == "paid" and session_id:
            record = await db.payment_transactions.find_one({"session_id": session_id})
            if record:
                await _mark_paid(session_id, record)

    return {"status": "ok"}