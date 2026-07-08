import os
from templates_data import DEFAULT_EMERGENCY_KEYWORDS


def whatsapp_enabled() -> bool:
    return os.environ.get("WHATSAPP_ENABLED", "false").strip().lower() == "true"


def _creds():
    return (
        os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        os.environ.get("TWILIO_WHATSAPP_FROM", "").strip(),
    )


def send_whatsapp(to_phone: str, body: str) -> dict:
    """Send a WhatsApp message via Twilio.

    Returns a dict describing the result. When the feature flag is off or
    credentials are missing, the message is *simulated* so the entire app
    flow works end-to-end during testing without incurring cost.
    """
    sid, token, from_number = _creds()
    if not whatsapp_enabled() or not sid or not token or not from_number:
        return {"status": "simulated", "detail": "WhatsApp disabled (test mode)"}
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        msg = client.messages.create(
            from_=f"whatsapp:{from_number}",
            to=f"whatsapp:{to_phone}",
            body=body,
        )
        return {"status": "sent", "sid": msg.sid}
    except Exception as e:
        return {"status": "failed", "detail": str(e)}


def verify_twilio_signature(url: str, params: dict, signature: str) -> bool:
    """Verify inbound Twilio webhook signature. Bypassed in test mode."""
    if not whatsapp_enabled():
        return True
    _, token, _ = _creds()
    if not token:
        return False
    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(token)
        return validator.validate(url, params, signature or "")
    except Exception:
        return False


def detect_emergency(text: str, extra_keywords: list[str] | None = None) -> list[str]:
    if not text:
        return []
    keywords = list(DEFAULT_EMERGENCY_KEYWORDS) + (extra_keywords or [])
    low = text.lower()
    return [k for k in keywords if k.lower() in low]
