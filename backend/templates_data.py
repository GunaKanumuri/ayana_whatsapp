"""Conversational, warm multilingual message templates (EN / TE / HI).

Tone: casual, loving — like a son/daughter chatting with their parent.
NOT robotic or formal. Multiple variants per category rotate day-to-day.
Later this layer can be replaced by Sarvam AI without changing the data model.
"""

LANGUAGES = [
    {"code": "en", "label": "English"},
    {"code": "te", "label": "తెలుగు (Telugu)"},
    {"code": "hi", "label": "हिंदी (Hindi)"},
]

# type: "checkin" (feeling-based) or "reminder" (task-based, e.g. medicine)
MESSAGE_TEMPLATES = {
    "morning_wish": {
        "label": "Morning Hello", "icon": "sunrise", "type": "checkin",
        "variants": {
            "en": ["Good morning Amma ☀️ Did you sleep well? Have a lovely day today!",
                   "Morning Amma! 🌸 Just woke up and thought of you. Hope you slept nicely."],
            "te": ["గుడ్ మార్నింగ్ అమ్మా ☀️ నిద్ర బాగా పట్టిందా? ఈరోజు హాయిగా గడపాలి!",
                   "అమ్మా, లేచావా? 🌸 పొద్దున్నే నీ గుర్తొచ్చింది. కులాసానా?"],
            "hi": ["गुड मॉर्निंग अम्मा ☀️ नींद अच्छी आई? आज का दिन अच्छा बीते!",
                   "अम्मा उठ गईं? 🌸 सुबह-सुबह आपकी याद आई। कैसी हैं आप?"],
        },
    },
    "breakfast": {
        "label": "Breakfast Chat", "icon": "coffee", "type": "checkin",
        "variants": {
            "en": ["Amma, had your breakfast? 🍵 Don't skip it, okay?",
                   "Tiffin done Amma? Eat properly, don't rush 😊"],
            "te": ["అమ్మా, టిఫిన్ చేసావా? 🍵 మానకు, సరేనా?",
                   "బ్రేక్‌ఫాస్ట్ అయ్యిందా అమ్మా? తొందర పడకుండా తిను 😊"],
            "hi": ["अम्मा, नाश्ता किया? 🍵 छोड़ना मत, ठीक है?",
                   "नाश्ता हो गया अम्मा? आराम से खाना, जल्दबाज़ी मत करना 😊"],
        },
    },
    "how_feeling": {
        "label": "How are you", "icon": "heart", "type": "checkin",
        "variants": {
            "en": ["Amma, how are you feeling now? 💛 Just checking on you.",
                   "Ela unnav Amma? Thinking of you 💛"],
            "te": ["అమ్మా, ఇప్పుడు ఎలా ఉన్నావ్? 💛 నీ గురించే ఆలోచిస్తున్నా.",
                   "ఏం చేస్తున్నావ్ అమ్మా? కులాసానా? 💛"],
            "hi": ["अम्मा, अभी कैसा लग रहा है? 💛 बस आपका हाल पूछ रहा हूँ।",
                   "क्या कर रही हैं अम्मा? सब ठीक? 💛"],
        },
    },
    "lunch": {
        "label": "Lunch Check-in", "icon": "utensils", "type": "checkin",
        "variants": {
            "en": ["Amma, lunch time! 🍽️ Eat well and rest a bit after.",
                   "Bhojanam ayindha Amma? Don't skip lunch 🍽️"],
            "te": ["అమ్మా, భోజనం టైం! 🍽️ బాగా తిని కాసేపు రెస్ట్ తీసుకో.",
                   "భోజనం అయ్యిందా అమ్మా? మానకు 🍽️"],
            "hi": ["अम्मा, खाने का समय! 🍽️ अच्छे से खाना और थोड़ा आराम करना।",
                   "खाना खाया अम्मा? छोड़ना मत 🍽️"],
        },
    },
    "afternoon_checkin": {
        "label": "Afternoon Hello", "icon": "sun", "type": "checkin",
        "variants": {
            "en": ["Amma, what are you up to? 🌼 Take rest in the afternoon.",
                   "Em chestunav Amma? Resting a little? 🌼"],
            "te": ["అమ్మా, ఏం చేస్తున్నావ్? 🌼 మధ్యాహ్నం కాసేపు పడుకో.",
                   "మధ్యాహ్నం రెస్ట్ తీసుకున్నావా అమ్మా? 🌼"],
            "hi": ["अम्मा, क्या कर रही हैं? 🌼 दोपहर में थोड़ा आराम कर लेना।",
                   "दोपहर में आराम किया अम्मा? 🌼"],
        },
    },
    "dinner": {
        "label": "Evening / Dinner", "icon": "moon", "type": "checkin",
        "variants": {
            "en": ["Amma, is Nanna home? 🌙 Have dinner together, don't skip it.",
                   "Evening ayindi Amma, dinner cheyyandi. Take care 🌙"],
            "te": ["అమ్మా, నాన్న ఇంటికి వచ్చారా? 🌙 కలిసి భోజనం చేయండి, మానకండి.",
                   "సాయంత్రం అయ్యింది అమ్మా, డిన్నర్ చేయి. జాగ్రత్త 🌙"],
            "hi": ["अम्मा, पापा घर आ गए? 🌙 साथ में खाना खा लेना, छोड़ना मत।",
                   "शाम हो गई अम्मा, खाना खा लेना। ख्याल रखना 🌙"],
        },
    },
    "goodnight": {
        "label": "Goodnight", "icon": "star", "type": "checkin",
        "variants": {
            "en": ["Goodnight Amma 🌟 Eroju ela jarigindhi? Sleep well, love you.",
                   "Sleep tight Amma ✨ Miss you. Talk tomorrow!"],
            "te": ["శుభరాత్రి అమ్మా 🌟 ఈరోజు ఎలా జరిగింది? హాయిగా నిద్రపో, లవ్ యూ.",
                   "బజ్జోవే అమ్మా ✨ నిన్ను మిస్ అవుతున్నా. రేపు మాట్లాడదాం!"],
            "hi": ["शुभ रात्रि अम्मा 🌟 आज का दिन कैसा रहा? चैन से सोना, लव यू।",
                   "सो जाओ अम्मा ✨ याद आती है। कल बात करते हैं!"],
        },
    },
    "love_note": {
        "label": "Love Note", "icon": "heart", "type": "checkin",
        "variants": {
            "en": ["Just wanted to say I love you Amma ❤️ Distance means nothing.",
                   "Miss you a lot Amma ❤️ You're always on my mind."],
            "te": ["ఏం లేదు అమ్మా, నిన్ను చాలా ప్రేమిస్తున్నా అని చెప్పాలనిపించింది ❤️",
                   "చాలా మిస్ అవుతున్నా అమ్మా ❤️ ఎప్పుడూ నీ గురించే."],
            "hi": ["बस इतना कहना था अम्मा, बहुत प्यार करता हूँ ❤️ दूरी कोई मायने नहीं रखती।",
                   "बहुत याद आती है अम्मा ❤️ हमेशा आपका ख्याल रहता है।"],
        },
    },
    "medicine": {
        "label": "Medicine Reminder", "icon": "pill", "type": "reminder",
        "variants": {
            "en": ["Amma, medicine time 💊 Please take them, don't forget okay?",
                   "Mandulu vesukunnava Amma? 💊 Take care of your health."],
            "te": ["అమ్మా, మందుల టైం 💊 వేసుకో, మర్చిపోకు సరేనా?",
                   "మందులు వేసుకున్నావా అమ్మా? 💊 ఆరోగ్యం జాగ్రత్త."],
            "hi": ["अम्मा, दवाई का समय 💊 ले लेना, भूलना मत ठीक है?",
                   "दवाई ली अम्मा? 💊 सेहत का ख्याल रखना।"],
        },
    },
    "water": {
        "label": "Water Reminder", "icon": "droplet", "type": "reminder",
        "variants": {
            "en": ["Amma, drink some water 💧 Chinna sip ina okay?"],
            "te": ["అమ్మా, కొంచెం నీళ్ళు తాగు 💧 చిన్న సిప్ అయినా సరే."],
            "hi": ["अम्मा, थोड़ा पानी पी लो 💧 थोड़ा सा ही सही।"],
        },
    },
    "health_check": {
        "label": "Health Check", "icon": "activity", "type": "reminder",
        "variants": {
            "en": ["Amma, how's your health today? 🩺 Any pain or discomfort? Tell me."],
            "te": ["అమ్మా, ఈరోజు ఆరోగ్యం ఎలా ఉంది? 🩺 ఏమైనా నొప్పి ఉందా? చెప్పు."],
            "hi": ["अम्मा, आज तबीयत कैसी है? 🩺 कोई दर्द या तकलीफ़? बताना।"],
        },
    },
    "bp_check": {
        "label": "BP Reminder", "icon": "heart-pulse", "type": "reminder",
        "variants": {
            "en": ["Amma, time to check your BP 🩸 Please note it down for the doctor."],
            "te": ["అమ్మా, బీపీ చెక్ చేసుకునే టైం 🩸 డాక్టర్ కోసం రాసిపెట్టు."],
            "hi": ["अम्मा, बीपी चेक करने का समय 🩸 डॉक्टर के लिए लिख लेना।"],
        },
    },
    "sugar_check": {
        "label": "Sugar Reminder", "icon": "candy", "type": "reminder",
        "variants": {
            "en": ["Amma, please check your sugar levels 🩸 before eating, okay?"],
            "te": ["అమ్మా, తినే ముందు షుగర్ చెక్ చేసుకో 🩸 సరేనా?"],
            "hi": ["अम्मा, खाने से पहले शुगर चेक कर लेना 🩸 ठीक है?"],
        },
    },
}

# A small, friendly reply prompt appended to every message.
REPLY_FOOTER = {
    "checkin": {
        "en": "\n\n👉 Reply: 1) Good  2) Okay  3) Not well — or hold 🎤 to send me a voice note.",
        "te": "\n\n👉 రిప్లై: 1) బాగున్నా  2) ఫర్వాలేదు  3) ఒంట్లో బాలేదు — లేదా 🎤 నొక్కి వాయిస్ పంపు.",
        "hi": "\n\n👉 जवाब दें: 1) ठीक हूँ  2) ठीक-ठाक  3) तबीयत ठीक नहीं — या 🎤 दबाकर वॉइस भेजें।",
    },
    "reminder": {
        "en": "\n\n👉 Reply: 1) Done  2) Not yet — or hold 🎤 to send me a voice note.",
        "te": "\n\n👉 రిప్లై: 1) అయ్యింది  2) ఇంకా లేదు — లేదా 🎤 నొక్కి వాయిస్ పంపు.",
        "hi": "\n\n👉 जवाब दें: 1) हो गया  2) अभी नहीं — या 🎤 दबाकर वॉइस भेजें।",
    },
}

RELATIONSHIPS = [
    "Mother", "Father", "Grandmother", "Grandfather",
    "Aunt", "Uncle", "Mother-in-law", "Father-in-law", "Other",
]

DEFAULT_EMERGENCY_KEYWORDS = [
    "help", "emergency", "pain", "fell", "fall", "hospital", "chest pain", "breathless",
    "not well", "sick", "so sick",
    "సహాయం", "అత్యవసరం", "నొప్పి", "పడిపోయాను", "ఒంట్లో బాలేదు",  # Telugu
    "मदद", "आपातकाल", "दर्द", "गिर गया", "तबीयत ठीक नहीं",  # Hindi
]


def category_type(category: str) -> str:
    tpl = MESSAGE_TEMPLATES.get(category)
    return tpl["type"] if tpl else "checkin"


def render_message(category: str, language: str, parent_name: str,
                   custom_text: str | None = None, day_index: int = 0,
                   with_footer: bool = True) -> str:
    tpl = MESSAGE_TEMPLATES.get(category)
    if custom_text:
        body = custom_text.replace("{name}", parent_name)
        mtype = tpl["type"] if tpl else "checkin"
    elif tpl:
        variants = tpl["variants"].get(language) or tpl["variants"]["en"]
        body = variants[day_index % len(variants)].replace("{name}", parent_name)
        mtype = tpl["type"]
    else:
        body = f"Hi {parent_name}, thinking of you today 💛"
        mtype = "checkin"
    if with_footer:
        footer = REPLY_FOOTER.get(mtype, REPLY_FOOTER["checkin"])
        body += footer.get(language) or footer["en"]
    return body


def public_categories():
    return [
        {"key": k, "label": v["label"], "icon": v["icon"], "type": v["type"]}
        for k, v in MESSAGE_TEMPLATES.items()
    ]
