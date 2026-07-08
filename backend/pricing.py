"""Pricing plans & packs. Displayed on the pricing/payment page.
Payments stay disabled by feature flag — this is presentation + limit config only.
"""

CURRENCIES = [
    {"code": "INR", "symbol": "₹", "label": "India (INR)"},
    {"code": "USD", "symbol": "$", "label": "USD"},
    {"code": "GBP", "symbol": "£", "label": "UK (GBP)"},
    {"code": "EUR", "symbol": "€", "label": "Europe (EUR)"},
    {"code": "AED", "symbol": "AED ", "label": "UAE (AED)"},
    {"code": "SGD", "symbol": "S$", "label": "Singapore (SGD)"},
    {"code": "AUD", "symbol": "A$", "label": "Australia (AUD)"},
    {"code": "CAD", "symbol": "C$", "label": "Canada (CAD)"},
]

PLANS = [
    {
        "id": "basic",
        "name": "AYANA Basic",
        "tagline": "Everyday closeness",
        "highlight": False,
        "limits": {"checkins": 3, "reminders": 2, "parents": 2, "family_members": 1},
        "price": {
            "INR": {"month": 149, "year": 1430},
            "USD": {"month": 1.99, "year": 19},
            "GBP": {"month": 1.79, "year": 17},
            "EUR": {"month": 1.99, "year": 19},
            "AED": {"month": 6.99, "year": 69},
            "SGD": {"month": 2.99, "year": 29},
            "AUD": {"month": 2.99, "year": 29},
            "CAD": {"month": 2.99, "year": 29},
        },
        "features": [
            "Care for up to 2 parents (Amma & Nanna)",
            "3 warm daily check-ins",
            "2 medicine reminders a day",
            "English, Telugu & Hindi",
            "Voice-note replies + quick reply options",
            "How-to-reply training video",
        ],
    },
    {
        "id": "care_plus",
        "name": "AYANA Care+",
        "tagline": "For extra care & recovery",
        "highlight": True,
        "limits": {"checkins": 10, "reminders": 10, "parents": 2, "family_members": 3},
        "price": {
            "INR": {"month": 399, "year": 3830},
            "USD": {"month": 4.99, "year": 49},
            "GBP": {"month": 4.49, "year": 44},
            "EUR": {"month": 4.99, "year": 49},
            "AED": {"month": 17.99, "year": 179},
            "SGD": {"month": 6.99, "year": 69},
            "AUD": {"month": 6.99, "year": 69},
            "CAD": {"month": 6.99, "year": 69},
        },
        "features": [
            "Everything in Basic",
            "Up to 10 daily check-ins",
            "Up to 10 medicine + health reminders",
            "BP / sugar / health check reminders",
            "Invite up to 3 family members to co-care",
            "Priority delivery",
            "Pill colour & type selection (coming soon)",
        ],
    },
]

PLAN_BY_ID = {p["id"]: p for p in PLANS}


def plan_limits(plan_id: str) -> dict:
    plan = PLAN_BY_ID.get(plan_id) or PLAN_BY_ID["basic"]
    return plan["limits"]
