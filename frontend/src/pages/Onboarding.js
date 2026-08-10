import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Loader2, ArrowRight, ArrowLeft, Check, ShieldCheck, MessageCircle,
  Sparkles, Info, Pill, Plus, Trash2, Clock, BookOpen, Coffee,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES } from "@/lib/constants";
import { PhoneInput } from "@/components/PhoneInput";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { PricingCards } from "@/components/PricingCards";
import { Hl } from "@/components/HighlightText";
import { toast } from "sonner";

const STEPS = ["Welcome", "Your parent", "Your plan", "Daily rhythm", "Activate"];

export default function Onboarding() {
  const { user, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  // Resume from server-side step; default 0 until user loads
  const [step, setStep] = useState(() => {
    const s = user?.onboarding_step ?? 0;
    // Clamp to valid range 0-4
    return Math.min(Math.max(s, 0), 4);
  });
  const [loading, setLoading] = useState(false);

  const [child, setChild] = useState({
    name: user?.name || "",
    phone: user?.phone || "+91",
    city: user?.city || "",
    timezone: user?.timezone || "Asia/Kolkata",
  });
  const [childConsent, setChildConsent] = useState(false);

  const [parent, setParent] = useState({
    name: "", relationship: "Mother", phone: "+91",
    language: "en", timezone: "Asia/Kolkata", notes: "",
    preferred_name: "",  // casual name used in WhatsApp templates (e.g. "Amma", "Mom")
    city: "", other_parent_name: "", nicknames: [], birthday: "",
    habits: { wake_time: "", tea_time: "", tea_type: "tea", walk_time: "", lunch_time: "", dinner_time: "", sleep_time: "" },
    stories: [],
    medicine_list: [],
  });
  const [nickInput, setNickInput] = useState("");
  const [storyInput, setStoryInput] = useState("");
  const addNickname = () => {
    const v = nickInput.trim();
    if (!v) return;
    setParent(p => {
      const current = p.nicknames || [];
      if (current.length >= 3) return p;
      return { ...p, nicknames: [...current, v] };
    });
    setNickInput("");
  };
  const addStory = () => {
    const v = storyInput.trim();
    if (!v) return;
    setParent(p => {
      const current = p.stories || [];
      if (current.length >= 5) return p;
      return { ...p, stories: [...current, v] };
    });
    setStoryInput("");
  };
  const removeStory = (i) => setParent(p => ({ ...p, stories: (p.stories || []).filter((_, idx) => idx !== i) }));
  const setHabit = (key, val) => setParent(p => ({ ...p, habits: { ...(p.habits || {}), [key]: val } }));

  // Blank medicine item template
  const blankMed = () => ({ name: "", dose: "", shape: "round", color: "white", timing: "after_food", notes: "" });
  const [newMed, setNewMed] = useState(blankMed());
  const [parentConsent, setParentConsent] = useState(false);
  const [parentId, setParentId] = useState(null);

  const [planId, setPlanId] = useState("nitya");

  const [messages, setMessages] = useState([
    { time: "08:00", category: "morning_wish", type: "checkin" },
    { time: "13:00", category: "lunch", type: "checkin" },
    { time: "21:00", category: "goodnight", type: "checkin" },
    { time: "09:00", category: "medicine", type: "reminder" },
  ]);

  const languages = config?.languages || [];
  const relationships = config?.relationships || [];
  const categories = config?.categories || [];
  const plans = config?.plans || [];
  const currencies = config?.currencies || [];
  const limits = useMemo(() => (plans.find((p) => p.id === planId)?.limits) || { checkins: 2, reminders: 2, nicknames_max: 2, variants_per_slot: 3 }, [plans, planId]);
  const planName = (id) => plans.find((p) => p.id === id)?.name?.replace("AYANA ", "") || id;

  // Redirect if already fully onboarded
  useEffect(() => { if (user?.onboarding_complete || user?.household_owner_id) navigate("/dashboard"); }, [user, navigate]);

  // Sync step from server when user loads (handles page refresh mid-flow)
  useEffect(() => {
    if (user && !user.onboarding_complete) {
      const serverStep = Math.min(Math.max(user.onboarding_step ?? 0, 0), 4);
      setStep(serverStep);
      // Pre-fill child fields from user record
      setChild((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        city: user.city || prev.city,
        timezone: user.timezone || prev.timezone,
      }));
    }
  }, [user]);

  // On mount, fetch existing parents so parentId is restored after a refresh
  useEffect(() => {
    if (!parentId) {
      api.get("/parents").then(({ data }) => {
        if (data && data.length > 0) {
          const first = data[0];
          setParentId(first.id);
          setParent({
            name: first.name || "",
            relationship: first.relationship || "Mother",
            phone: first.phone || "+91",
            language: first.language || "en",
            timezone: first.timezone || "Asia/Kolkata",
            notes: first.notes || "",
            preferred_name: first.preferred_name || "",
            city: first.city || "",
            other_parent_name: first.other_parent_name || "",
            birthday: first.birthday || "",
            nicknames: first.nicknames || [],
            habits: { wake_time: "", tea_time: "", tea_type: "tea", walk_time: "", lunch_time: "", dinner_time: "", sleep_time: "", ...(first.habits || {}) },
            stories: first.stories || [],
            medicine_list: first.medicine_list || [],
          });
        }
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inputCls = "w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition";
  const smInputCls = "w-full px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/40 focus:border-ayana-accent transition";

  // Medicine helpers
  const SHAPES  = ["round", "oval", "capsule", "oblong", "diamond", "square"];
  const COLORS  = ["white", "cream", "yellow", "orange", "pink", "red", "purple", "blue", "green", "brown", "beige"];
  const TIMINGS = ["morning", "afternoon", "evening", "bedtime", "before_food", "after_food", "empty_stomach", "with_food"];

  const COLOR_HEX = {
    white: "#FFFFFF", cream: "#FFFDD0", yellow: "#FDE68A", orange: "#FCA347",
    pink: "#FBBFD0", red: "#F87171", purple: "#C084FC", blue: "#7DD3FC",
    green: "#86EFAC", brown: "#A07850", beige: "#D4C5A9",
  };

  const SHAPE_ICON = { round: "⬤", oval: "⬭", capsule: "💊", oblong: "▬", diamond: "◆", square: "■" };

  const addMedicine = () => {
    if (!newMed.name.trim()) { return; }
    setParent(p => ({ ...p, medicine_list: [...(p.medicine_list || []), { ...newMed }] }));
    setNewMed(blankMed());
  };

  const removeMedicine = (idx) => {
    setParent(p => ({ ...p, medicine_list: (p.medicine_list || []).filter((_, i) => i !== idx) }));
  };

  const saveChild = async () => {
    if (!childConsent) { toast.error("Please confirm consent to continue."); return; }
    setLoading(true);
    try {
      await api.put("/profile/child", { name: child.name, phone: child.phone, city: child.city, timezone: child.timezone });
      await api.post("/consent", { consent_type: "child", agreed: true, text: "I consent to AYANA managing my care setup." });
      setStep(1);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const saveParent = async () => {
    if (!parentConsent) { toast.error("Please confirm you have your parent's consent."); return; }
    setLoading(true);
    try {
      let id = parentId;
      if (id) {
        // User hit Back and re-submitted — update the existing record, don't create a duplicate
        await api.put(`/parents/${id}`, parent);
      } else {
        const { data } = await api.post("/parents", parent);
        id = data.id;
        setParentId(id);
      }
      await api.post("/consent", { consent_type: "parent", agreed: true, text: `Consent confirmed for parent ${parent.name}.` });
      setStep(2);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const choosePlan = async (id, billing) => {
    setPlanId(id);
    setLoading(true);
    try {
      await api.post("/payment/checkout", { plan: id, billing });
      toast.success(`${planName(id)} selected · trial (test mode).`);
      setStep(3);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const saveSchedule = async () => {
    if (messages.length === 0) { toast.error("Add at least one daily check-in."); return; }
    setLoading(true);
    try {
      await api.post("/schedules", { parent_id: parentId, mode: planId, messages, active: true });
      setStep(4);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const activate = async () => {
    setLoading(true);
    try {
      await api.post("/activation/activate");
      await refreshUser();
      navigate("/activation");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-ayana-bg relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(1200px 500px at 100% -5%, rgba(217,108,74,0.06), transparent), radial-gradient(900px 500px at -10% 10%, rgba(44,76,59,0.06), transparent)" }} aria-hidden="true" />
      <div className="border-b border-ayana-line bg-ayana-bg/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-ayana-primary flex items-center justify-center"><Heart className="w-4 h-4 text-white" fill="currentColor" strokeWidth={2} /></span>
            <span className="font-display font-semibold text-ayana-text">AYANA setup</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? "bg-ayana-accent" : "bg-ayana-line"}`} />
                <p className={`mt-1.5 text-[11px] ${i === step ? "text-ayana-text font-medium" : "text-ayana-muted"} hidden sm:block`}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>

            {step === 0 && (
              <div>
                <div className="text-center mb-8">
                  <span className="inline-flex w-14 h-14 rounded-2xl bg-ayana-primary/8 items-center justify-center mb-4"><Sparkles className="w-7 h-7 text-ayana-primary" strokeWidth={1.5} /></span>
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Let's bring you <Hl color="gold">closer to home</Hl>.</h1>
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
                  <button
                    onClick={() => navigate("/dashboard")}
                    data-testid="step0-back"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={saveChild} disabled={loading || !child.name || child.phone.length < 8} data-testid="step0-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Who are we <Hl color="accent">caring for</Hl>?</h1>
                  <p className="mt-3 text-ayana-secondary">Tell us about the parent who'll receive these daily messages.</p>
                </div>
                <div className="bg-white rounded-2xl border border-ayana-line p-7 space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Their name</label>
                      <input value={parent.name} onChange={(e) => setParent({ ...parent, name: e.target.value })} data-testid="parent-name" placeholder="Amma" className={`mt-1.5 ${inputCls}`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Relationship</label>
                      <select value={parent.relationship} onChange={(e) => setParent({ ...parent, relationship: e.target.value })} data-testid="parent-relationship" className={`mt-1.5 ${inputCls}`}>
                        {relationships.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-ayana-text">Their WhatsApp number</label>
                    <div className="mt-1.5"><PhoneInput value={parent.phone} onChange={(v) => setParent({ ...parent, phone: v })} testid="parent-phone" /></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Preferred language</label>
                      <select value={parent.language} onChange={(e) => setParent({ ...parent, language: e.target.value })} data-testid="parent-language" className={`mt-1.5 ${inputCls}`}>
                        {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Their timezone <span className="text-ayana-accent">(source of truth)</span></label>
                      <select value={parent.timezone} onChange={(e) => setParent({ ...parent, timezone: e.target.value })} data-testid="parent-timezone" className={`mt-1.5 ${inputCls}`}>
                        {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Optional notes */}
                  <div>
                    <label className="text-sm font-medium text-ayana-text">
                      Health / routine notes <span className="text-ayana-muted font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={parent.notes || ""}
                      onChange={(e) => setParent({ ...parent, notes: e.target.value.slice(0, 300) })}
                      data-testid="parent-notes"
                      placeholder="e.g. Diabetic, takes BP medicine at 9am, walks every morning"
                      rows={2}
                      className={`mt-1.5 ${inputCls} resize-none`}
                    />
                    <p className="mt-1 text-xs text-ayana-muted text-right">{(parent.notes || "").length}/300</p>
                  </div>

                  {/* preferred_name — used in WhatsApp template variables */}
                  <div className="rounded-xl border border-ayana-line/70 bg-ayana-alt/40 p-4">
                    <label className="text-sm font-medium text-ayana-text flex items-center gap-1.5">
                      What do you call them? <span className="text-ayana-muted font-normal">(used in WhatsApp messages)</span>
                    </label>
                    <input
                      value={parent.preferred_name || ""}
                      onChange={(e) => setParent({ ...parent, preferred_name: e.target.value.slice(0, 40) })}
                      data-testid="parent-preferred-name"
                      placeholder="e.g. Amma, Mom, Nanna, Thatha"
                      className={`mt-2 ${inputCls}`}
                    />
                    <p className="mt-1.5 text-xs text-ayana-muted">This casual name will appear in every daily message: &ldquo;Good morning <strong>{parent.preferred_name || parent.name || "Amma"}</strong> ☀️&rdquo;</p>
                  </div>

                  {/* Nicknames — rotate day to day in messages */}
                  <div className="rounded-xl border border-ayana-line/70 bg-ayana-alt/40 p-4">
                    <label className="text-sm font-medium text-ayana-text flex items-center gap-1.5">
                      Nicknames <span className="text-ayana-muted font-normal">(optional — rotate day to day, up to 3)</span>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(parent.nicknames || []).map((n, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-white border border-ayana-line text-ayana-secondary">
                          {n}
                          <button type="button" onClick={() => setParent(p => ({ ...p, nicknames: (p.nicknames || []).filter((_, idx) => idx !== i) }))} className="text-ayana-muted hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                    {(parent.nicknames || []).length < 3 && (
                      <div className="mt-2 flex gap-2">
                        <input value={nickInput} onChange={(e) => setNickInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNickname(); } }}
                          data-testid="parent-nickname-input" placeholder="e.g. Maa, Buji" className={inputCls} />
                        <button type="button" onClick={addNickname} data-testid="parent-nickname-add" className="px-4 py-2.5 rounded-lg border border-ayana-line text-sm font-medium text-ayana-primary hover:bg-white shrink-0">Add</button>
                      </div>
                    )}
                  </div>

                  {/* City + other parent — personalize seasonal greetings and "did Amma have lunch too?" lines */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-ayana-text">Their city <span className="text-ayana-muted font-normal">(for seasonal greetings)</span></label>
                      <input value={parent.city || ""} onChange={(e) => setParent({ ...parent, city: e.target.value })} data-testid="parent-city" placeholder="Hyderabad" className={`mt-1.5 ${inputCls}`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-ayana-text">{parent.relationship === "father" ? "Mother's" : "Father's"} name <span className="text-ayana-muted font-normal">(optional)</span></label>
                      <input value={parent.other_parent_name || ""} onChange={(e) => setParent({ ...parent, other_parent_name: e.target.value })} data-testid="parent-other-parent" placeholder="e.g. Lakshmi" className={`mt-1.5 ${inputCls}`} />
                    </div>
                  </div>

                  {/* Birthday — powers automatic birthday & festival wishes in their language */}
                  <div>
                    <label className="text-sm font-medium text-ayana-text flex items-center gap-1.5">
                      🎂 Their birthday <span className="text-ayana-muted font-normal">(optional — Ayana sends a warm wish)</span>
                    </label>
                    <input
                      type="date"
                      data-testid="parent-birthday"
                      value={parent.birthday ? `2000-${parent.birthday}` : ""}
                      onChange={(e) => setParent({ ...parent, birthday: e.target.value ? e.target.value.slice(5) : "" })}
                      className={`mt-1.5 ${inputCls}`}
                    />
                    <p className="mt-1.5 text-xs text-ayana-muted">We only use the day &amp; month, in {parent.language === "te" ? "Telugu" : parent.language === "hi" ? "Hindi" : "English"}.</p>
                  </div>

                  {/* Daily habits — feed tea/walk check-ins and timing personalization */}
                  <div className="rounded-xl border border-ayana-line/70 bg-ayana-alt/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-ayana-primary" />
                      <span className="text-sm font-medium text-ayana-text">Daily habits</span>
                      <span className="text-xs text-ayana-muted font-normal ml-1">(optional — personalizes tea/walk check-ins)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        ["wake_time", "Wakes up"], ["tea_time", "Tea/coffee time"], ["walk_time", "Walk time"],
                        ["lunch_time", "Lunch"], ["dinner_time", "Dinner"], ["sleep_time", "Sleeps"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="text-xs text-ayana-muted">{label}</label>
                          <input type="time" value={parent.habits?.[key] || ""} onChange={(e) => setHabit(key, e.target.value)}
                            data-testid={`parent-habit-${key}`} className={`mt-1 ${smInputCls}`} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Coffee className="w-3.5 h-3.5 text-ayana-muted" />
                      <span className="text-xs text-ayana-muted">Drinks</span>
                      {["tea", "coffee"].map((t) => (
                        <button key={t} type="button" onClick={() => setHabit("tea_type", t)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${(parent.habits?.tea_type || "tea") === t ? "bg-ayana-primary text-white border-ayana-primary" : "bg-white border-ayana-line text-ayana-secondary"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stories — rotating memory prompts used in mood/love-note messages */}
                  <div className="rounded-xl border border-ayana-line/70 bg-ayana-alt/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-ayana-primary" />
                      <span className="text-sm font-medium text-ayana-text">Memory prompts</span>
                      <span className="text-xs text-ayana-muted font-normal ml-1">(optional, up to 5 — e.g. "mango pickle story")</span>
                    </div>
                    {(parent.stories || []).length > 0 && (
                      <div className="space-y-2 mb-2">
                        {(parent.stories || []).map((s, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-ayana-line px-3 py-2">
                            <span className="flex-1 text-sm text-ayana-text">{s}</span>
                            <button type="button" onClick={() => removeStory(i)} className="text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {(parent.stories || []).length < 5 && (
                      <div className="flex gap-2">
                        <input value={storyInput} onChange={(e) => setStoryInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStory(); } }}
                          data-testid="parent-story-input" placeholder="e.g. Remember the mango pickle you made every summer?" className={smInputCls} />
                        <button type="button" onClick={addStory} data-testid="parent-story-add" className="px-4 py-2 rounded-lg border border-ayana-line text-sm font-medium text-ayana-primary hover:bg-white shrink-0">Add</button>
                      </div>
                    )}
                  </div>

                  {/* Medicine list */}
                  <div className="rounded-xl border border-ayana-line/70 bg-ayana-alt/40 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-ayana-primary" />
                      <span className="text-sm font-medium text-ayana-text">Medicine list</span>
                      <span className="text-xs text-ayana-muted font-normal ml-1">(optional — used in reminder messages)</span>
                    </div>

                    {/* Existing medicines */}
                    {(parent.medicine_list || []).length > 0 && (
                      <div className="space-y-2">
                        {(parent.medicine_list || []).map((m, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-ayana-line px-3 py-2">
                            {/* Color swatch */}
                            <span className="w-4 h-4 rounded-full border border-ayana-line flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: COLOR_HEX[m.color] || "#fff" }} />
                            {/* Shape icon */}
                            <span className="text-xs text-ayana-secondary w-4">{SHAPE_ICON[m.shape] || "●"}</span>
                            <span className="flex-1 text-sm text-ayana-text font-medium">{m.name}</span>
                            {m.dose && <span className="text-xs text-ayana-muted">{m.dose}</span>}
                            {m.timing && <span className="text-xs text-ayana-muted bg-ayana-alt px-1.5 py-0.5 rounded-md">{m.timing.replace("_", " ")}</span>}
                            <button type="button" onClick={() => removeMedicine(idx)}
                              className="text-ayana-muted hover:text-red-500 transition-colors ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add medicine form */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-ayana-muted">Medicine name *</label>
                          <input value={newMed.name} onChange={e => setNewMed(m => ({ ...m, name: e.target.value }))}
                            placeholder="e.g. Metformin" className={`mt-1 ${smInputCls}`} />
                        </div>
                        <div>
                          <label className="text-xs text-ayana-muted">Dose</label>
                          <input value={newMed.dose} onChange={e => setNewMed(m => ({ ...m, dose: e.target.value }))}
                            placeholder="e.g. 500mg" className={`mt-1 ${smInputCls}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-ayana-muted">Shape</label>
                          <select value={newMed.shape} onChange={e => setNewMed(m => ({ ...m, shape: e.target.value }))}
                            className={`mt-1 ${smInputCls}`}>
                            {SHAPES.map(s => <option key={s} value={s}>{SHAPE_ICON[s]} {s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-ayana-muted">Color</label>
                          <select value={newMed.color} onChange={e => setNewMed(m => ({ ...m, color: e.target.value }))}
                            className={`mt-1 ${smInputCls}`}>
                            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-ayana-muted">When</label>
                          <select value={newMed.timing} onChange={e => setNewMed(m => ({ ...m, timing: e.target.value }))}
                            className={`mt-1 ${smInputCls}`}>
                            {TIMINGS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Live preview of medicine pill */}
                      {newMed.name && (
                        <div className="flex items-center gap-2 text-xs text-ayana-secondary bg-white rounded-lg border border-dashed border-ayana-line/80 px-3 py-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-ayana-line shadow-sm flex-shrink-0"
                            style={{ backgroundColor: COLOR_HEX[newMed.color] || "#fff" }} />
                          <span>{SHAPE_ICON[newMed.shape]}</span>
                          <span className="font-medium text-ayana-text">{newMed.name}</span>
                          {newMed.dose && <span className="text-ayana-muted">({newMed.dose})</span>}
                          <span className="text-ayana-muted">· {newMed.timing.replace(/_/g, " ")}</span>
                        </div>
                      )}
                      <button type="button" onClick={addMedicine} disabled={!newMed.name.trim()}
                        className="inline-flex items-center gap-1.5 text-sm text-ayana-accent hover:text-ayana-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                        <Plus className="w-4 h-4" /> Add medicine
                      </button>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input type="checkbox" checked={parentConsent} onChange={(e) => setParentConsent(e.target.checked)} data-testid="parent-consent" className="mt-1 w-4 h-4 accent-ayana-primary" />
                    <span className="text-sm text-ayana-secondary">I confirm my parent is aware of and consents to receiving these caring messages.</span>
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(0)} data-testid="step1-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={saveParent} disabled={loading || !parent.name || parent.phone.length < 8} data-testid="step1-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Choose your <Hl color="accent">care plan</Hl></h1>
                  <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">Pick the pack that fits your family. Payments are off in testing — you'll continue on a free trial.</p>
                </div>
                <PricingCards plans={plans} currencies={currencies} selectedPlan={planId} onSelect={choosePlan} />
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(1)} data-testid="step2-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <span />
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="mb-6">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Build their <Hl color="gold">daily rhythm</Hl></h1>
                  <p className="mt-3 text-ayana-secondary">Warm check-ins and gentle reminders for <span className="font-medium text-ayana-text">{parent.name || "your parent"}</span>. Times are in their timezone.</p>
                </div>
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-ayana-alt border border-ayana-line p-3 text-sm text-ayana-secondary">
                  <Info className="w-4 h-4 text-ayana-primary shrink-0 mt-0.5" />
                  <span>Your <b>{planName(planId)}</b> plan: up to {limits.checkins} check-ins &amp; {limits.reminders} reminders/day. {planId !== "raksha" && "Need more? Upgrade for a bigger plan."}</span>
                </div>
                <ScheduleEditor messages={messages} setMessages={setMessages} categories={categories} limits={limits} />
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(2)} data-testid="step3-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={saveSchedule} disabled={loading} data-testid="step3-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center">
                <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-whatsapp/15 items-center justify-center mb-5"><MessageCircle className="w-8 h-8 text-ayana-whatsapp" strokeWidth={1.5} /></span>
                <h1 className="font-display text-3xl font-semibold text-ayana-text">Ready to <Hl color="accent">activate</Hl> their care circle</h1>
                <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">We'll send a warm welcome + a short how-to-reply guide to {parent.name || "your parent"} on WhatsApp, then begin daily check-ins.</p>
                <div className="mt-6 mx-auto max-w-md bg-white rounded-2xl border border-ayana-line p-6 text-left">
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary"><ShieldCheck className="w-4 h-4 text-ayana-primary" /> Consent recorded for you and {parent.name || "your parent"}.</div>
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary mt-2"><Check className="w-4 h-4 text-ayana-primary" /> {messages.length} daily messages scheduled in {parent.timezone}.</div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setStep(3)}
                    data-testid="step4-back"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Edit schedule
                  </button>
                  <button onClick={activate} disabled={loading} data-testid="step4-activate"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors shadow-lg disabled:opacity-50">
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