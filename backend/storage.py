"""
Emergent object storage wrapper for AYANA moment-image uploads.

Replaces pod-local disk storage (backend/static/uploads/) with the
platform's S3-compatible object store so uploaded images survive deploys
and are reachable across replicas. Images are served back to Meta (and the
dashboard) via the signed-URL endpoint in server.py, which streams bytes
fetched here — no direct storage URL is ever exposed.
"""

import logging
import os

import requests

logger = logging.getLogger("ayana.storage")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "ayana"

_storage_key = None


def init_storage(force: bool = False):
    """Call once at startup. Returns a session-scoped, reusable storage key."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes. Returns {"path": ..., "size": ..., "etag": ...}."""
    key = init_storage()
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
        if resp.status_code == 404:
            key = init_storage(force=True)
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("[storage] put failed for %s: %s", path, e)
        raise


def get_object(path: str) -> tuple[bytes, str]:
    """Download bytes. Returns (content, content_type)."""
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 404:
        # storage_key may have gone stale — retry once with a fresh key
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
