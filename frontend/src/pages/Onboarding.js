import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Loader2, ArrowRight, ArrowLeft, Check, ShieldCheck, MessageCircle,
  Sparkles, Info, Pill, Plus, Trash2, Pencil, Users, Clock, Coffee, Sunrise, Utensils, Moon,
} from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES } from "@/lib/constants";
import { PhoneInput } from "@/components/PhoneInput";
import { PhoneVerificationCard } from "@/components/PhoneVerificationCard";
import { ScheduleEditor, normalizeCategory } from "@/components/ScheduleEditor";
import { PricingCards } from "@/components/PricingCards";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { FALLBACK_PLANS, FALLBACK_CURRENCIES } from "../lib/fallbackPlans";
import { cleanHabits } from "../lib/formHelpers";

const STEPS = ["Welcome", "Your plan", "Your parents", "Activate"];

// ── Static lookup tables ──────────────────────────────────────────
const FALLBACK_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
];
const FALLBACK_RELATIONSHIPS = ["mother", "father"];
const FALLBACK_CATEGORIES = [
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

const COLOR_HEX = {
  white: "#FFFFFF", cream: "#FFFDD0", yellow: "#FDE68A", orange: "#FCA347",
  pink: "#FBBFD0", red: "#F87171", purple: "#C084FC", blue: "#7DD3FC",
  green: "#86EFAC", brown: "#A07850", beige: "#D4C5A9",
};
const SHAPE_ICON = { round: "⬤", oval: "⬭", capsule: "💊", oblong: "▬", diamond: "◆", square: "■" };

// ── Component ─────────────────────────────────────────────────────
export default function Onboarding() {
  const { user, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    const s = user?.onboarding_step ?? 0;
    return Math.min(Math.max(s, 0), 3);
  });
  const [loading, setLoading] = useState(false);

  const [child, setChild] = useState({
    name: user?.name || "",
    phone: user?.phone || "+91",
    city: user?.city || "",
    timezone: user?.timezone || "Asia/Kolkata",
  });
  const [childConsent, setChildConsent] = useState(false);

  // Tracks the exact phone number that was last successfully OTP-verified
  // (not just a boolean) so phoneVerified below is *computed*, not stored.
  // That way, editing the phone field after verifying correctly drops the
  // "Verified" badge instead of leaving a stale checkmark on a number
  // nobody actually confirmed — mirrors the emergency-detection principle
  // of never letting something unverified silently pass as fine.
  const [verifiedPhone, setVerifiedPhone] = useState(user?.phone_verified ? user.phone : null);
  const phoneVerified = !!child.phone && child.phone === verifiedPhone;

  const [planId, setPlanId] = useState("nitya");

  // ── Config with fallbacks ─────────────────────────────────────
  const languages = config?.languages?.length ? config.languages : FALLBACK_LANGUAGES;
  const relationships = config?.relationships?.length ? config.relationships : FALLBACK_RELATIONSHIPS;
  const rawCategories = config?.categories?.length ? config.categories : FALLBACK_CATEGORIES;
  // normalizeCategory adds label + icon from key so dropdowns are never blank
  const checkinCategories = useMemo(
    () => rawCategories.map(normalizeCategory).filter((c) => c.type === "checkin"),
    [rawCategories]
  );
  const shapes = config?.medicine_shapes || ["round", "oval", "capsule", "oblong", "diamond", "square"];
  const colors = config?.medicine_colors || ["white", "cream", "yellow", "orange", "pink", "red", "purple", "blue", "green", "brown", "beige"];
  const timings = config?.medicine_timings || ["morning", "afternoon", "evening", "bedtime", "before_food", "after_food", "empty_stomach", "with_food"];

  // ── Plan limits — everything is derived from the selected plan ─
  const plans = useMemo(() => config?.plans?.length ? config.plans : FALLBACK_PLANS, [config]);
  const currencies = config?.currencies?.length ? config.currencies : FALLBACK_CURRENCIES;
  const plan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  const limits = useMemo(() => plan?.limits || { checkins: 2, reminders: 2, parents: 1, templates_per_day: 4 }, [plan]);
  const parentLimit = limits.parents || 1;
  const maxCheckins = limits.checkins || 2;
  const maxReminders = limits.reminders || 2;

  const defaultMessages = () => [
    { time: "08:00", category: "morning_wish", type: "checkin" },
    { time: "13:00", category: "lunch", type: "checkin" },
    { time: "21:00", category: "goodnight", type: "checkin" },
  ].slice(0, maxCheckins);

  const blankParent = () => ({
    name: "", relationship: "mother", phone: "+91",
    language: "en", timezone: "Asia/Kolkata", notes: "",
    preferred_name: "",
    medicine_list: [],
    habits: {
      wake_time: "", tea_time: "", tea_type: "tea", walk_time: "",
      lunch_time: "", dinner_time: "", sleep_time: ""
    },
    messages: defaultMessages(),
  });

  const [parentsList, setParentsList] = useState([]);
  const [parentsLoaded, setParentsLoaded] = useState(false);
  const [parentForm, setParentForm] = useState(null);
  const [editingParentId, setEditingParentId] = useState(null);
  const [parentConsent, setParentConsent] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [scheduleIds, setScheduleIds] = useState({}); // parent_id -> schedule_id

  const blankMed = () => ({ name: "", dose: "", reminder_time: "09:00", shape: "round", color: "white", timing: "after_food", notes: "" });
  const [newMed, setNewMed] = useState(blankMed());

  // ── Effects ───────────────────────────────────────────────────
  useEffect(() => { if (user?.onboarding_complete || user?.household_owner_id) navigate("/dashboard"); }, [user?.onboarding_complete, user?.household_owner_id, navigate]);

  useEffect(() => {
    if (user && !user.onboarding_complete) {
      const serverStep = Math.min(Math.max(user.onboarding_step ?? 0, 0), 3);
      setStep(serverStep);
      setChild((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        city: user.city || prev.city,
        timezone: user.timezone || prev.timezone,
      }));
    }
  }, [user?.onboarding_complete, user?.onboarding_step, user?.name, user?.phone, user?.city, user?.timezone]);

  // Keep verifiedPhone in sync with the server's view of things — covers
  // the case where refreshUser() (called from onVerified below) resolves
  // after this component already re-rendered once, or a returning user
  // whose phone was verified in a previous session.
  useEffect(() => {
    if (user?.phone_verified && user?.phone) setVerifiedPhone(user.phone);
  }, [user?.phone_verified, user?.phone]);

  useEffect(() => {
    api.get("/payment/state").then(({ data }) => {
      const currentPlan = data?.state?.plan || "nitya";
      setPlanId(["nitya", "bandham", "raksha"].includes(currentPlan) ? currentPlan : "nitya");
    }).catch(() => {});

    api.get("/parents").then(({ data }) => {
      setParentsList(data || []);
      setParentsLoaded(true);
    }).catch(() => setParentsLoaded(true));

    api.get("/schedules").then(({ data }) => {
      const map = {};
      for (const s of (data || [])) {
        map[s.parent_id] = s.id;
      }
      setScheduleIds(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (parentsLoaded && parentsList.length === 0 && !parentForm) {
      setParentForm(blankParent());
      setEditingParentId(null);
    }
  }, [parentsLoaded, parentsList.length]);

  // ── Styles ────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-bright/50 focus:border-ayana-bright transition";
  const smInputCls = "w-full px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-bright/40 focus:border-ayana-bright transition";

  // ── Medicine actions ──────────────────────────────────────────
  const addMedicine = () => {
    if (!newMed.name.trim()) { toast.error("Enter a medicine name."); return; }
    if ((parentForm.medicine_list || []).length >= maxReminders) {
      toast.error(`Your ${plan?.name || "plan"} allows up to ${maxReminders} medicine reminders. Upgrade for more.`);
      return;
    }
    setParentForm((p) => ({ ...p, medicine_list: [...(p.medicine_list || []), { ...newMed }] }));
    setNewMed(blankMed());
  };

  const removeMedicine = (idx) => {
    setParentForm((p) => ({ ...p, medicine_list: (p.medicine_list || []).filter((_, i) => i !== idx) }));
  };

  // ── Step actions ──────────────────────────────────────────────
  const saveChild = async () => {
    if (!childConsent) { toast.error("Please confirm consent to continue."); return; }
    if (!child.name.trim()) { toast.error("Please enter your name."); return; }
    if (child.phone.length < 8) { toast.error("Please enter a valid phone number."); return; }
    // Data-layer gate, not just the disabled button — same principle as the
    // saveParentForm() consent check below, so this can't be bypassed by
    // re-enabling the button in devtools.
    if (!phoneVerified) { toast.error("Please verify your phone number before continuing."); return; }
    setLoading(true);
    try {
      await api.put("/profile/child", { name: child.name, phone: child.phone, city: child.city, timezone: child.timezone });
      await api.post("/consent", { consent_type: "child", agreed: true, text: "I consent to AYANA managing my care setup." });
      setStep(1);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const choosePlan = async (id, billing) => {
    setPlanId(id);
    setLoading(true);
    try {
      await api.post("/payment/checkout", { plan: id, billing });
      toast.success(`${plans.find(p => p.id === id)?.name} selected.`);
      setStep(2);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const openAddParent = () => {
    if (parentsList.length >= parentLimit) {
      toast.error(`Your ${plan?.name || "plan"} allows up to ${parentLimit} parent(s). Upgrade your plan to add more.`);
      return;
    }
    setEditingParentId(null);
    setParentConsent(false);
    setParentForm(blankParent());
  };

  const openEditParent = async (p) => {
    setLoading(true);
    try {
      let messages = defaultMessages();
      const schedRes = await api.get("/schedules");
      const mySched = (schedRes.data || []).find(s => s.parent_id === p.id);
      if (mySched) {
        // Only keep check-in messages (not medicine_sync entries)
        messages = (mySched.messages || []).filter(m => m.type !== "reminder" && m.source !== "medicine_sync");
        if (messages.length === 0) messages = defaultMessages();
        setScheduleIds(prev => ({ ...prev, [p.id]: mySched.id }));
      }

      setEditingParentId(p.id);
      setParentConsent(true);
      setParentForm({
        name: p.name || "",
        relationship: p.relationship || "mother",
        phone: p.phone || "+91",
        language: p.language || "en",
        timezone: p.timezone || "Asia/Kolkata",
        notes: p.notes || "",
        preferred_name: p.preferred_name || "",
        medicine_list: p.medicine_list || [],
        habits: p.habits || blankParent().habits,
        messages: messages,
      });
    } catch (e) {
      toast.error("Could not load parent details.");
    } finally {
      setLoading(false);
    }
  };

  const closeParentForm = () => {
    setParentForm(null);
    setEditingParentId(null);
    setParentConsent(false);
  };

  const saveParentForm = async () => {
    if (!parentForm.name.trim()) { toast.error("Please enter your parent's name."); return; }
    if (parentForm.phone.length < 8) { toast.error("Please enter a valid WhatsApp number."); return; }
    if (!parentConsent) { toast.error("Please confirm you have your parent's consent."); return; }
    if (parentForm.messages.length === 0) { toast.error("Add at least one daily check-in."); return; }
    if (parentForm.messages.length > maxCheckins) { toast.error(`Your plan allows up to ${maxCheckins} check-ins. Remove some or upgrade.`); return; }

    setLoading(true);
    try {
      const { messages, ...parentData } = parentForm;
      // Clean habits — strip empty time strings to null
      parentData.habits = cleanHabits(parentData.habits);

      let savedParent;
      if (editingParentId) {
        const { data } = await api.put(`/parents/${editingParentId}`, parentData);
        savedParent = data;
        setParentsList((list) => list.map((p) => (p.id === editingParentId ? data : p)));
      } else {
        const { data } = await api.post("/parents", parentData);
        savedParent = data;
        setParentsList((list) => [...list, data]);
        await api.post("/consent", { consent_type: "parent", agreed: true, text: `Consent confirmed for parent ${parentForm.name}.` });
      }

      // Save schedule — only check-in messages go here.
      // Medicine reminders are auto-synced by the backend via medicine_sync.py
      const existingSchedId = scheduleIds[savedParent.id];
      const schedPayload = { parent_id: savedParent.id, mode: planId, messages, active: true };
      let dropped = savedParent.medicine_reminders_dropped;
      if (existingSchedId) {
        const { data: schedData } = await api.put(`/schedules/${existingSchedId}`, schedPayload);
        dropped = dropped || schedData?.medicine_reminders_dropped;
      } else {
        const { data: schedData } = await api.post("/schedules", schedPayload);
        setScheduleIds(prev => ({ ...prev, [savedParent.id]: schedData.id }));
        dropped = dropped || schedData?.medicine_reminders_dropped;
      }

      toast.success(editingParentId ? "Parent updated." : "Parent added!");
      if (dropped?.length) {
        toast.warning(`Your plan couldn't fit all medicine reminder times — dropped: ${dropped.join(", ")}. Upgrade for more, or adjust times.`, { duration: 8000 });
      }
      closeParentForm();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const deleteParent = async (p) => {
    setDeletingId(p.id);
    try {
      await api.delete(`/parents/${p.id}`);
      setParentsList((list) => list.filter((x) => x.id !== p.id));
      toast.success(`Removed ${p.name}.`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setDeletingId(null); }
  };

  const activate = async () => {
    setLoading(true);
    try {
      await api.post("/activation/activate");
      await refreshUser();
      navigate("/activation");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const parentNames = parentsList.map((p) => p.name).filter(Boolean).join(", ");

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-warm-cream relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(1200px 500px at 100% -5%, rgba(217,108,74,0.06), transparent), radial-gradient(900px 500px at -10% 10%, rgba(44,76,59,0.06), transparent)" }} aria-hidden="true" />
      <div className="border-b border-ayana-line bg-warm-cream/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Logo size={32} showWord={false} />
            <span className="font-display font-semibold text-ayana-text">AYANA setup</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? "bg-ayana-bright" : "bg-ayana-line"}`} />
                <p className={`mt-1.5 text-[11px] ${i === step ? "text-ayana-bright font-semibold" : "text-ayana-muted"} hidden sm:block`}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>

            {/* ━━━ Step 0: Welcome ━━━ */}
            {step === 0 && (
              <div>
                <div className="text-center mb-8">
                  <span className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,201,60,0.15))" }}><Sparkles className="w-7 h-7 text-ayana-bright" strokeWidth={1.5} /></span>
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Let's bring you closer to home.</h1>
                  <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">Take a breath. In a few gentle steps, your parent will start receiving warm daily care — in their language, on their time.</p>
                </div>
                <div className="bg-white rounded-2xl border border-ayana-line p-7 space-y-5">
                  <h3 className="font-display text-lg font-medium text-ayana-text">A little about you</h3>
                  <div>
                    <label className="text-sm font-medium text-ayana-text">Your name</label>
                    <input value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} data-testid="child-name" className={`mt-1.5 ${inputCls}`} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Your phone</label>
                      <div className="mt-1.5"><PhoneInput value={child.phone} onChange={(v) => setChild({ ...child, phone: v })} testid="child-phone" /></div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Your city (optional)</label>
                      <input value={child.city} onChange={(e) => setChild({ ...child, city: e.target.value })} data-testid="child-city" placeholder="London" className={`mt-1.5 ${inputCls}`} />
                    </div>
                  </div>

                  {/* Phone must be OTP-verified before continuing past this
                      step — `verified` is computed against verifiedPhone so
                      editing the number after verifying correctly re-locks it. */}
                  <PhoneVerificationCard
                    label="Your phone"
                    phone={child.phone}
                    verified={phoneVerified}
                    onSend={(phone) => api.post("/auth/otp/send", { phone_number: phone })}
                    onVerify={(phone, code) => api.post("/auth/otp/verify", { phone_number: phone, code })}
                    onResend={(phone) => api.post("/auth/otp/resend", { phone_number: phone })}
                    onVerified={async (phone) => {
                      setVerifiedPhone(phone);
                      await refreshUser();
                    }}
                    testid="onboarding-phone-verify"
                  />

                  <div>
                    <label className="text-sm font-medium text-ayana-text">Your timezone</label>
                    <select value={child.timezone} onChange={(e) => setChild({ ...child, timezone: e.target.value })} data-testid="child-timezone" className={`mt-1.5 ${inputCls}`}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input type="checkbox" checked={childConsent} onChange={(e) => setChildConsent(e.target.checked)} data-testid="child-consent" className="mt-1 w-4 h-4 accent-ayana-primary" />
                    <span className="text-sm text-ayana-secondary">I consent to AYANA storing my details to manage care check-ins. I can delete my data anytime.</span>
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={saveChild} disabled={loading || !child.name || child.phone.length < 8 || !phoneVerified} data-testid="step0-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* ━━━ Step 1: Plan ━━━ */}
            {step === 1 && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Choose your care plan</h1>
                  <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">Pick the pack that fits your family — this decides how many parents, check-ins, and medicine reminders you get.</p>
                </div>
                <PricingCards plans={plans} currencies={currencies} selectedPlan={planId} onSelect={choosePlan} />
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                </div>
              </div>
            )}

            {/* ━━━ Step 2: Parents ━━━ */}
            {step === 2 && (
              <div>
                <div className="mb-6">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Who are we caring for?</h1>
                  <p className="mt-3 text-ayana-secondary">
                    Your <span className="font-medium text-ayana-text">{plan?.name || "plan"}</span> covers up to {parentLimit} parent{parentLimit === 1 ? "" : "s"}, {maxCheckins} daily check-ins, and {maxReminders} medicine reminders per parent.
                    {" "}{parentsList.length}/{parentLimit} added.
                  </p>
                </div>

                {parentsList.length > 0 && (
                  <div className="mb-5 space-y-3">
                    {parentsList.map((p) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-ayana-line p-5 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-ayana-text">{p.name} <span className="text-ayana-muted font-normal capitalize">· {p.relationship}</span></p>
                          <p className="text-sm text-ayana-secondary">{p.phone} · {(languages.find(l => l.code === p.language) || {}).label || p.language}</p>
                          {(p.medicine_list || []).length > 0 && (
                            <p className="text-xs text-ayana-muted mt-1">💊 {p.medicine_list.length} medicine{p.medicine_list.length !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditParent(p)} className="p-2.5 rounded-full text-ayana-secondary hover:bg-ayana-alt hover:text-ayana-text transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteParent(p)} disabled={deletingId === p.id} className="p-2.5 rounded-full text-ayana-secondary hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50">
                            {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!parentForm && parentsList.length < parentLimit && (
                  <button onClick={openAddParent} className="mb-5 inline-flex items-center gap-2 px-5 py-3 rounded-full border border-dashed border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors">
                    <Plus className="w-4 h-4" /> Add {parentsList.length === 0 ? "a parent" : "another parent"}
                  </button>
                )}

                {parentForm && (
                  <div className="bg-white rounded-2xl border border-ayana-line overflow-hidden shadow-sm" data-testid="parent-form">
                    <div className="bg-ayana-alt/50 border-b border-ayana-line px-7 py-4 flex items-center justify-between">
                      <h3 className="font-display font-medium text-ayana-text">{editingParentId ? "Edit parent" : "Add a parent"}</h3>
                      <button onClick={closeParentForm} className="text-sm text-ayana-muted hover:text-ayana-text">Cancel</button>
                    </div>

                    <div className="p-7 space-y-10">

                      {/* ── Section 1: Parent details ── */}
                      <section className="space-y-5">
                        <div className="flex items-center gap-2 pb-2 border-b border-ayana-line/50">
                          <Users className="w-4.5 h-4.5 text-ayana-primary" />
                          <h4 className="font-display font-medium text-ayana-text">1. Parent details</h4>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-ayana-text">Their name</label>
                            <input value={parentForm.name} onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })} className={`mt-1.5 ${inputCls}`} placeholder="Amma" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-ayana-text">Relationship</label>
                            <select value={parentForm.relationship} onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })} className={`mt-1.5 ${inputCls}`}>
                              {relationships.map((r) => {
                                const val = typeof r === "string" ? r : r.value;
                                const label = typeof r === "string" ? (val.charAt(0).toUpperCase() + val.slice(1)) : r.label;
                                return <option key={val} value={val}>{label}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-ayana-text">WhatsApp number</label>
                            <div className="mt-1.5"><PhoneInput value={parentForm.phone} onChange={(v) => setParentForm({ ...parentForm, phone: v })} /></div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-ayana-text">Preferred language</label>
                            <select value={parentForm.language} onChange={(e) => setParentForm({ ...parentForm, language: e.target.value })} className={`mt-1.5 ${inputCls}`}>
                              {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-ayana-text">Their timezone</label>
                          <select value={parentForm.timezone} onChange={(e) => setParentForm({ ...parentForm, timezone: e.target.value })} className={`mt-1.5 ${inputCls}`}>
                            {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                          </select>
                        </div>
                      </section>

                      {/* ── Section 2: Daily check-ins ── */}
                      <section className="space-y-5">
                        <div className="flex items-center justify-between pb-2 border-b border-ayana-line/50">
                          <div className="flex items-center gap-2">
                            <Sunrise className="w-4.5 h-4.5 text-ayana-bright" />
                            <h4 className="font-display font-medium text-ayana-text">2. Daily check-ins</h4>
                          </div>
                          <span className="text-xs text-ayana-muted">{parentForm.messages.length}/{maxCheckins} used · {plan?.name}</span>
                        </div>
                        <ScheduleEditor
                          messages={parentForm.messages}
                          setMessages={(msgs) => setParentForm({ ...parentForm, messages: msgs })}
                          categories={checkinCategories}
                          maxCheckins={maxCheckins}
                        />
                      </section>

                      {/* ── Section 3: Daily routine & activities ── */}
                      <section className="space-y-5">
                        <div className="flex items-center gap-2 pb-2 border-b border-ayana-line/50">
                          <Clock className="w-4.5 h-4.5 text-ayana-mint" />
                          <h4 className="font-display font-medium text-ayana-text">3. Daily routine & activities</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {[
                            { id: "wake_time", label: "Wake up", icon: Sunrise },
                            { id: "tea_time", label: "Tea / Coffee", icon: Coffee },
                            { id: "walk_time", label: "Walk", icon: Heart },
                            { id: "lunch_time", label: "Lunch", icon: Utensils },
                            { id: "dinner_time", label: "Dinner", icon: Utensils },
                            { id: "sleep_time", label: "Sleep", icon: Moon },
                          ].map((h) => (
                            <div key={h.id}>
                              <label className="text-xs font-medium text-ayana-secondary flex items-center gap-1 mb-1.5">
                                <h.icon className="w-3 h-3" /> {h.label}
                              </label>
                              <input type="time" value={parentForm.habits[h.id] || ""} onChange={(e) => setParentForm({ ...parentForm, habits: { ...parentForm.habits, [h.id]: e.target.value } })} className={smInputCls} />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-xs font-medium text-ayana-secondary">Prefers:</span>
                          {["tea", "coffee"].map((t) => (
                            <button key={t} type="button" onClick={() => setParentForm({ ...parentForm, habits: { ...parentForm.habits, tea_type: t } })}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                parentForm.habits.tea_type === t
                                  ? "bg-ayana-primary text-white border-ayana-primary"
                                  : "bg-white text-ayana-secondary border-ayana-line hover:bg-ayana-alt"
                              }`}>
                              {t === "tea" ? "☕ Tea" : "☕ Coffee"}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-ayana-muted italic px-1">Routine times personalize message content (e.g. "Hope you had your tea at {'{'}tea_time{'}'}"). They do not auto-schedule check-ins.</p>

                        <div className="pt-2">
                          <label className="text-sm font-medium text-ayana-text">Health / routine notes</label>
                          <textarea
                            value={parentForm.notes}
                            onChange={(e) => setParentForm({ ...parentForm, notes: e.target.value.slice(0, 300) })}
                            placeholder="e.g. Uses a walking stick, hard of hearing in left ear."
                            rows={3}
                            className={`mt-1.5 ${inputCls} resize-none text-sm`}
                          />
                          <p className="text-xs text-ayana-muted mt-1 text-right">{(parentForm.notes || "").length}/300</p>
                        </div>
                      </section>

                      {/* ── Section 4: Medicines (optional) ── */}
                      <section className="space-y-5">
                        <div className="flex items-center justify-between pb-2 border-b border-ayana-line/50">
                          <div className="flex items-center gap-2">
                            <Pill className="w-4.5 h-4.5 text-ayana-primary" />
                            <h4 className="font-display font-medium text-ayana-text">4. Medicine reminders</h4>
                            <span className="text-[10px] uppercase font-bold tracking-wide text-ayana-muted bg-ayana-alt px-2 py-0.5 rounded-full">Optional</span>
                          </div>
                          <span className="text-xs text-ayana-muted">{(parentForm.medicine_list || []).length}/{maxReminders} · {plan?.name}</span>
                        </div>
                        <p className="text-xs text-ayana-secondary">Add medicines your parent takes daily. AYANA will send a WhatsApp reminder at the time you set for each medicine.</p>

                        {(parentForm.medicine_list || []).length > 0 && (
                          <div className="space-y-2">
                            {parentForm.medicine_list.map((m, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-xl border border-ayana-line px-4 py-3 bg-warm-cream/20">
                                <div className="flex items-center gap-3">
                                  <span className="text-xl" style={{ color: COLOR_HEX[m.color] || COLOR_HEX.white }}>{SHAPE_ICON[m.shape] || "💊"}</span>
                                  <div>
                                    <p className="text-sm font-medium text-ayana-text">{m.name} {m.dose && `· ${m.dose}`}</p>
                                    <p className="text-xs text-ayana-secondary">{m.reminder_time || "—"} · {(m.timing || "").replace("_", " ")}</p>
                                  </div>
                                </div>
                                <button onClick={() => removeMedicine(idx)} className="text-ayana-muted hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            ))}
                          </div>
                        )}

                        {(parentForm.medicine_list || []).length < maxReminders && (
                          <div className="bg-warm-cream/30 rounded-xl p-4 border border-ayana-line/50 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="Medicine name" className={smInputCls} />
                              <input value={newMed.dose} onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })} placeholder="Dose (e.g. 1 tab)" className={smInputCls} />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="text-[10px] uppercase font-bold text-ayana-muted ml-1">Remind at</label>
                                <input type="time" value={newMed.reminder_time} onChange={(e) => setNewMed({ ...newMed, reminder_time: e.target.value })} className={smInputCls} />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-ayana-muted ml-1">Shape</label>
                                <select value={newMed.shape} onChange={(e) => setNewMed({ ...newMed, shape: e.target.value })} className={smInputCls}>
                                  {shapes.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-ayana-muted ml-1">Color</label>
                                <select value={newMed.color} onChange={(e) => setNewMed({ ...newMed, color: e.target.value })} className={smInputCls}>
                                  {colors.map((c) => (
                                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-ayana-muted ml-1">Timing</label>
                                <select value={newMed.timing} onChange={(e) => setNewMed({ ...newMed, timing: e.target.value })} className={smInputCls}>
                                  {timings.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>)}
                                </select>
                              </div>
                            </div>
                            <button onClick={addMedicine} className="inline-flex items-center gap-1.5 text-sm text-ayana-primary font-medium hover:text-ayana-primary-hover transition-colors">
                              <Plus className="w-4 h-4" /> Add medicine
                            </button>
                          </div>
                        )}

                        {(parentForm.medicine_list || []).length >= maxReminders && (
                          <p className="text-xs text-ayana-muted text-center py-2">
                            Maximum {maxReminders} medicine reminders for {plan?.name}. <button type="button" onClick={() => setStep(1)} className="text-ayana-accent underline">Upgrade plan</button> for more.
                          </p>
                        )}
                      </section>

                      {/* ── Consent + Save ── */}
                      <div className="pt-4 border-t border-ayana-line">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={parentConsent} onChange={(e) => setParentConsent(e.target.checked)} className="mt-1 w-4 h-4 accent-ayana-primary" />
                          <span className="text-sm text-ayana-secondary">I confirm my parent is aware of and consents to receiving these caring messages on WhatsApp.</span>
                        </label>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button onClick={saveParentForm} disabled={loading || !parentForm.name || parentForm.phone.length < 8}
                          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ayana-primary text-white font-semibold hover:bg-ayana-primary-hover transition-colors shadow-md disabled:opacity-50">
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{editingParentId ? "Save changes" : "Confirm parent"} <Check className="w-4 h-4" /></>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={() => setStep(3)} disabled={loading || parentsList.length === 0 || parentForm}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-ayana-primary text-white font-semibold hover:bg-ayana-primary-hover transition-colors shadow-md disabled:opacity-50">
                    Continue to activation <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ━━━ Step 3: Activate ━━━ */}
            {step === 3 && (
              <div className="text-center">
                <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-whatsapp/15 items-center justify-center mb-5"><MessageCircle className="w-8 h-8 text-ayana-whatsapp" strokeWidth={1.5} /></span>
                <h1 className="font-display text-3xl font-semibold text-ayana-text">Ready to activate their care circle</h1>
                <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">We'll send a warm welcome + a short how-to-reply guide to {parentNames || "your parent"} on WhatsApp, then begin daily check-ins.</p>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Edit parents</button>
                  <button onClick={activate} disabled={loading}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold transition-shadow shadow-lg hover:shadow-xl disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #FF6B35, #FF8555)" }}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate Care Circle <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}