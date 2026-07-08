"""Static multilingual message templates (English, Telugu, Hindi).

Structured so the {name} placeholder is filled with the parent's name.
Later this layer can be replaced by an AI translation service (e.g. Sarvam AI)
without changing the schedule/data model.
"""

LANGUAGES = [
    {"code": "en", "label": "English"},
    {"code": "te", "label": "తెలుగు (Telugu)"},
    {"code": "hi", "label": "हिंदी (Hindi)"},
]

# Each category has an emotional label + text per language.
MESSAGE_TEMPLATES = {
    "morning_wish": {
        "label": "Morning Wish",
        "icon": "sunrise",
        "en": "Good morning, {name}! Wishing you a calm and happy day. Someone who loves you is thinking of you. 💛",
        "te": "శుభోదయం, {name}! మీ రోజు ప్రశాంతంగా, ఆనందంగా గడవాలని కోరుకుంటున్నాను. మిమ్మల్ని ప్రేమించే వారు మీ గురించి ఆలోచిస్తున్నారు. 💛",
        "hi": "सुप्रभात, {name}! आपका दिन शांत और खुशहाल हो। कोई आपसे प्यार करने वाला आपको याद कर रहा है। 💛",
    },
    "breakfast": {
        "label": "Breakfast Reminder",
        "icon": "coffee",
        "en": "Hope you've had a warm breakfast, {name}. Please eat well and take your time. 🍵",
        "te": "మీరు వేడి వేడి అల్పాహారం తీసుకున్నారని ఆశిస్తున్నాను, {name}. దయచేసి బాగా తినండి, తొందర పడకండి. 🍵",
        "hi": "आशा है आपने गरम नाश्ता कर लिया होगा, {name}। कृपया अच्छे से खाएं और आराम से। 🍵",
    },
    "medicine": {
        "label": "Medicine Reminder",
        "icon": "pill",
        "en": "A gentle reminder to take your medicines, {name}. Your health matters to us. 🌿",
        "te": "మీ మందులు వేసుకోవాలని ఒక చిన్న గుర్తు, {name}. మీ ఆరోగ్యం మాకు ముఖ్యం. 🌿",
        "hi": "आपकी दवाइयां लेने की एक कोमल याद, {name}। आपकी सेहत हमारे लिए महत्वपूर्ण है। 🌿",
    },
    "water": {
        "label": "Hydration Reminder",
        "icon": "droplet",
        "en": "Have you had some water, {name}? A little sip goes a long way. 💧",
        "te": "మీరు కొంచెం నీళ్ళు తాగారా, {name}? కొద్దిగా నీళ్ళు కూడా చాలా మంచిది. 💧",
        "hi": "क्या आपने थोड़ा पानी पिया, {name}? थोड़ा सा पानी भी बहुत फायदेमंद है। 💧",
    },
    "lunch": {
        "label": "Lunch Check-in",
        "icon": "utensils",
        "en": "It's lunch time, {name}. Please have a good meal and rest a little after. 🍽️",
        "te": "మధ్యాహ్న భోజన సమయం, {name}. దయచేసి బాగా భోంచేసి, కొంచెం విశ్రాంతి తీసుకోండి. 🍽️",
        "hi": "दोपहर के भोजन का समय है, {name}। कृपया अच्छा भोजन करें और थोड़ा आराम करें। 🍽️",
    },
    "afternoon_checkin": {
        "label": "Afternoon Check-in",
        "icon": "sun",
        "en": "Just checking in on you, {name}. How are you feeling this afternoon? 🌼",
        "te": "మీ గురించి తెలుసుకోవడానికి, {name}. ఈ మధ్యాహ్నం మీరు ఎలా ఉన్నారు? 🌼",
        "hi": "बस आपका हाल जानने के लिए, {name}। इस दोपहर आप कैसा महसूस कर रहे हैं? 🌼",
    },
    "dinner": {
        "label": "Dinner Reminder",
        "icon": "moon",
        "en": "Evening, {name}. Please don't skip dinner tonight. Eat something warm. 🌙",
        "te": "సాయంత్రం, {name}. దయచేసి ఈ రాత్రి భోజనం మానకండి. ఏదైనా వేడిగా తినండి. 🌙",
        "hi": "शाम हो गई, {name}। कृपया आज रात खाना न छोड़ें। कुछ गरम खाएं। 🌙",
    },
    "goodnight": {
        "label": "Goodnight Message",
        "icon": "star",
        "en": "Goodnight, {name}. Sleep peacefully. You are loved and remembered every single day. ✨",
        "te": "శుభరాత్రి, {name}. ప్రశాంతంగా నిద్రపోండి. మీరు ప్రతిరోజూ ప్రేమించబడుతున్నారు, గుర్తుంచుకోబడుతున్నారు. ✨",
        "hi": "शुभ रात्रि, {name}। चैन से सोइए। आपसे हर दिन प्यार किया जाता है और आपको याद किया जाता है। ✨",
    },
    "love_note": {
        "label": "Love Note",
        "icon": "heart",
        "en": "Distance can't reduce how much you're loved, {name}. Thinking of you always. ❤️",
        "te": "దూరం మీపై ప్రేమను తగ్గించలేదు, {name}. ఎప్పుడూ మీ గురించే ఆలోచిస్తున్నాను. ❤️",
        "hi": "दूरी आपके लिए प्यार को कम नहीं कर सकती, {name}। हमेशा आपको याद करते हैं। ❤️",
    },
}

RELATIONSHIPS = [
    "Mother", "Father", "Grandmother", "Grandfather",
    "Aunt", "Uncle", "Mother-in-law", "Father-in-law", "Other",
]

DEFAULT_EMERGENCY_KEYWORDS = [
    "help", "emergency", "pain", "fell", "hospital", "chest pain", "breathless",
    "సహాయం", "అత్యవసరం", "నొప్పి",  # Telugu: help, emergency, pain
    "मदद", "आपातकाल", "दर्द",  # Hindi: help, emergency, pain
]


def render_message(category: str, language: str, parent_name: str, custom_text: str | None = None) -> str:
    if custom_text:
        return custom_text.replace("{name}", parent_name)
    tpl = MESSAGE_TEMPLATES.get(category)
    if not tpl:
        return f"Hello {parent_name}, thinking of you today. 💛"
    text = tpl.get(language) or tpl.get("en")
    return text.replace("{name}", parent_name)
