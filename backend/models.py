from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth ----------
class RegisterInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "")
        if not v.startswith("+"):
            raise ValueError("Phone must be in E.164 format, e.g. +919876543210")
        return v


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


# ---------- Child profile (extends user) ----------
class ChildProfileInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=6, max_length=20)
    city: Optional[str] = Field(None, max_length=80)
    timezone: str = Field(..., min_length=2, max_length=64)


# ---------- Parent profile ----------
class ParentInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    relationship: str = Field(..., min_length=1, max_length=40)
    phone: str = Field(..., min_length=6, max_length=20)
    language: str = Field(..., pattern="^(en|te|hi)$")
    timezone: str = Field(..., min_length=2, max_length=64)
    notes: Optional[str] = Field(None, max_length=300)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "")
        if not v.startswith("+"):
            raise ValueError("Phone must be in E.164 format, e.g. +919876543210")
        return v


# ---------- Schedule ----------
class ScheduleMessage(BaseModel):
    time: str = Field(..., pattern="^([01]\\d|2[0-3]):[0-5]\\d$")  # HH:MM 24h
    category: str = Field(..., min_length=1, max_length=40)
    custom_text: Optional[str] = Field(None, max_length=500)


class ScheduleInput(BaseModel):
    parent_id: str
    mode: str = Field("normal", pattern="^(normal|care_plus)$")
    messages: List[ScheduleMessage]
    active: bool = True

    @field_validator("messages")
    @classmethod
    def limit_messages(cls, v, info):
        return v


# ---------- Preferences ----------
class PreferencesInput(BaseModel):
    emergency_keywords: Optional[List[str]] = None
    daily_summary: Optional[bool] = None


# ---------- Consent ----------
class ConsentInput(BaseModel):
    consent_type: str = Field(..., pattern="^(child|parent)$")
    agreed: bool
    text: str = Field(..., max_length=500)
