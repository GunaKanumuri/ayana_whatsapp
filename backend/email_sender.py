"""
email_sender.py — Transactional email for AYANA (Care Circle invitations).

Provider: Resend (https://resend.com) — minimal, modern, easy to set up.
Falls back to simulation (log-only) when EMAIL_ENABLED=false.

Required env vars when EMAIL_ENABLED=true:
  RESEND_API_KEY   Your Resend API key (starts with re_...)
  EMAIL_FROM       Verified sender address, e.g. care@ayana.care
  FRONTEND_URL     Full base URL so invite links are absolute
"""

import logging
import os
from datetime import datetime

import httpx

logger = logging.getLogger("ayana.email")

_RESEND_ENDPOINT = "https://api.resend.com/emails"
_REQUEST_TIMEOUT = 10.0  # seconds


# ---------------------------------------------------------------------------
# Feature flag
# ---------------------------------------------------------------------------

def email_enabled() -> bool:
    return os.environ.get("EMAIL_ENABLED", "false").strip().lower() == "true"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_invite_email(
    to_email: str,
    inviter_name: str,
    invite_link: str,
    parent_display_name: str = "",
    expiry_days: int = 7,
    # Legacy alias — old callers used owner_name=
    owner_name: str = "",
) -> dict:
    """
    Send a Care Circle invitation email to *to_email*.

    Args:
      to_email            Recipient email address.
      inviter_name        Name of the person sending the invite (e.g. "Rahul").
      invite_link         Full URL to the claim page (/invite/{token}).
      parent_display_name Casual name of the parent whose care circle this is
                          (e.g. "Amma"). Falls back to generic copy if empty.
      expiry_days         Number of days before the link expires (shown in email).
      owner_name          Deprecated alias for inviter_name — kept for backward compat.

    Returns one of:
      {"status": "sent",      "email_id": "<resend-id>"}
      {"status": "simulated", "detail":   "..."}
      {"status": "failed",    "detail":   "..."}
    """
    # Backward compat: old callers passed owner_name as positional arg
    if owner_name and not inviter_name:
        inviter_name = owner_name
    inviter_name = inviter_name or "Someone"

    if not email_enabled():
        logger.info(
            "[email] Disabled (EMAIL_ENABLED=false). Invite for %s → %s",
            to_email,
            invite_link,
        )
        return {"status": "simulated", "detail": "Email disabled — EMAIL_ENABLED=false"}

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.error("[email] EMAIL_ENABLED=true but RESEND_API_KEY is missing.")
        return {"status": "failed", "detail": "RESEND_API_KEY is not configured."}

    from_addr = os.environ.get("EMAIL_FROM", "care@ayana.care").strip()
    parent_snippet = f" to care for {_esc(parent_display_name)}" if parent_display_name else ""
    subject = f"{_esc(inviter_name)} invited you to co-care on AYANA 💛"
    html = _build_html(inviter_name, invite_link, parent_display_name, expiry_days)

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(
                _RESEND_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"from": from_addr, "to": [to_email], "subject": subject, "html": html},
            )

        if resp.status_code in (200, 201):
            data = resp.json()
            email_id = data.get("id", "")
            logger.info("[email] Sent invite to %s (id=%s)", to_email, email_id)
            return {"status": "sent", "email_id": email_id}

        logger.error(
            "[email] Resend API error %s for %s: %s",
            resp.status_code,
            to_email,
            resp.text[:200],
        )
        return {
            "status": "failed",
            "detail": f"Resend API returned HTTP {resp.status_code}",
        }

    except httpx.TimeoutException:
        logger.error("[email] Resend API timed out for %s", to_email)
        return {"status": "failed", "detail": "Email service timed out — try again later."}
    except Exception as exc:
        logger.exception("[email] Unexpected error sending invite to %s", to_email)
        return {"status": "failed", "detail": str(exc)}


# ---------------------------------------------------------------------------
# HTML template (inline-styles only — Gmail-safe)
# ---------------------------------------------------------------------------

def _build_html(inviter_name: str, invite_link: str, parent_display_name: str = "", expiry_days: int = 7) -> str:
    year       = datetime.now().year
    safe_name  = _esc(inviter_name)
    safe_link  = _esc(invite_link)
    safe_parent = _esc(parent_display_name)

    # Warm, personalised parent snippet
    if safe_parent:
        circle_desc = (
            f"<strong>{safe_name}</strong> has invited you to join their "
            f"<strong>AYANA care circle</strong> for "
            f"<strong style=\"color:#1E564C;\">{safe_parent}</strong> — sending warm daily "
            f"WhatsApp check-ins together."
        )
    else:
        circle_desc = (
            f"<strong>{safe_name}</strong> has invited you to join their "
            f"<strong>AYANA care circle</strong> — sending warm daily WhatsApp "
            f"check-ins to their parents, together."
        )

    expiry_note = f"{expiry_days}\u00a0days" if expiry_days else "7\u00a0days"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to {safe_name}'s AYANA care circle</title>
</head>
<body style="margin:0;padding:0;background:#F9F6F0;font-family:Georgia,'Times New Roman',serif;
             color:#2C2825;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#F9F6F0;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;border:1px solid #E5DFD3;
                    overflow:hidden;max-width:560px;width:100%;">

        <!-- ── Header ── -->
        <tr>
          <td style="background:#1E564C;padding:28px 40px;text-align:center;">
            <span style="font-size:26px;color:#ffffff;font-weight:bold;letter-spacing:2px;">
              &#x2764;&#xFE0F;&nbsp;AYANA
            </span>
            <p style="margin:8px 0 0;font-size:13px;color:#A8D5C2;letter-spacing:0.5px;">
              Daily care, together.
            </p>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#2C2825;">
              You're invited to co-care &#x1F49B;
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#6B635E;line-height:1.65;">
              {circle_desc}
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6B635E;line-height:1.65;">
              As a care circle member you can view and manage parents, schedules, and
              replies &mdash; while the account owner handles billing.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="{safe_link}"
                   style="display:inline-block;padding:14px 40px;background:#C05A46;
                          color:#ffffff;text-decoration:none;border-radius:50px;
                          font-size:15px;font-weight:bold;letter-spacing:0.5px;
                          mso-padding-alt:0;text-align:center;">
                  Accept Invitation &rarr;
                </a>
              </td></tr>
            </table>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #E5DFD3;margin:0 0 20px;" />

            <!-- What to expect -->
            <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#2C2825;">What to expect:</p>
            <ul style="margin:0 0 24px;padding-left:20px;font-size:13px;color:#6B635E;line-height:1.8;">
              <li>See daily well-being updates from {safe_parent or 'the parents'} in real time</li>
              <li>Get alerted if something seems off &mdash; together you won't miss a thing</li>
              <li>No extra cost &mdash; all managed under {safe_name}'s account</li>
            </ul>

            <p style="margin:0;font-size:13px;color:#9E9590;line-height:1.6;text-align:center;">
              If you weren't expecting this invite, you can safely ignore this email.<br/>
              This invitation link expires in&nbsp;{expiry_note}.
            </p>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#F9F6F0;padding:20px 40px;text-align:center;
                     border-top:1px solid #E5DFD3;">
            <p style="margin:0;font-size:12px;color:#9E9590;">
              &copy; {year} AYANA &middot; Made with care.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _esc(text: str) -> str:
    """Minimal HTML escaping for user-supplied strings inside the template."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
    )
