// Single source of fallback config data, used whenever GET /config hasn't
// loaded yet (or returns partial data). Both Onboarding and the Dashboard's
// ParentCareForm import from here — previously each screen kept its own
// copy, which is how the Dashboard's "Edit parent" dialog ended up with
// blank relationship/language dropdowns and a stuck "Loading schedule
// categories…" while Onboarding (which had its own local fallbacks) worked
// fine right next to it.

export const FALLBACK_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
];

export const FALLBACK_RELATIONSHIPS = ["mother", "father"];

export const FALLBACK_CATEGORIES = [
  { key: "morning_wish", type: "checkin" },
  { key: "breakfast", type: "checkin" },
  { key: "lunch", type: "checkin" },
  { key: "dinner", type: "checkin" },
  { key: "afternoon_checkin", type: "checkin" },
  { key: "tea_check", type: "checkin" },
  { key: "walk_check", type: "checkin" },
  { key: "how_feeling", type: "checkin" },
  { key: "goodnight", type: "checkin" },
  { key: "love_note", type: "checkin" },
];

export const FALLBACK_MEDICINE_SHAPES = ["round", "oval", "capsule", "oblong", "diamond", "square"];

export const FALLBACK_MEDICINE_COLORS = [
  "white", "cream", "yellow", "orange", "pink", "red", "purple", "blue", "green", "brown", "beige",
];

export const FALLBACK_MEDICINE_TIMINGS = [
  "morning", "afternoon", "evening", "bedtime", "before_food", "after_food", "empty_stomach", "with_food",
];