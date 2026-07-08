import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Loader2, ArrowRight, ArrowLeft, Plus, Trash2, Check,
  Sunrise, Coffee, Pill, Droplet, Utensils, Sun, Moon, Star, MessageCircle,
  ShieldCheck, CreditCard, Sparkles,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES } from "@/lib/constants";
import { toast } from "sonner";

const CATEGORY_ICONS = {
  morning_wish: Sunrise, breakfast: Coffee, medicine: Pill, water: Droplet,
  lunch: Utensils, afternoon_checkin: Sun, dinner: Moon, goodnight: Star, love_note: Heart,
};

const STEPS = ["Welcome", "About your parent", "Daily rhythm", "Plan", "Activate"];

export default function Onboarding() {
  const { user, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 — child
  const [child, setChild] = useState({ name: user?.name || "", phone: user?.phone || "", city: "", timezone: "Asia/Kolkata" });
  const [childConsent, setChildConsent] = useState(false);

  // Step 1 — parent
  const [parent, setParent] = useState({ name: "", relationship: "Mother", phone: "", language: "en", timezone: "Asia/Kolkata", notes: "" });
  const [parentConsent, setParentConsent] = useState(false);
  const [parentId, setParentId] = useState(null);

  // Step 2 — schedule
  const [mode, setMode] = useState("normal");
  const [messages, setMessages] = useState([
    { time: "08:00", category: "morning_wish" },
    { time: "13:00", category: "lunch" },
    { time: "21:00", category: "goodnight" },
  ]);

  const templates = config?.message_templates || {};
  const languages = config?.languages || [];
  const relationships = config?.relationships || [];
  const limit = mode === "normal" ? 5 : 10;

  useEffect(() => {
    if (user?.onboarding_complete) navigate("/dashboard");
  }, [user, navigate]);

  const templateEntries = useMemo(() => Object.entries(templates), [templates]);

  const addMessage = () => {
    if (messages.length >= limit) { toast.error(`Up to ${limit} messages in ${mode} mode.`); return; }
    setMessages([...messages, { time: "12:00", category: "love_note" }]);
  };
  const updateMessage = (i, key, val) => {
    const next = [...messages]; next[i] = { ...next[i], [key]: val }; setMessages(next);
  };
  const removeMessage = (i) => setMessages(messages.filter((_, idx) => idx !== i));

  const saveChild = async () => {
    if (!childConsent) { toast.error("Please confirm consent to continue."); return; }
    setLoading(true);
    try {
      await api.put("/profile/child", { name: child.name, phone: child.phone, city: child.city, timezone: child.timezone });
      await api.post("/consent", { consent_type: "child", agreed: true, text: "I consent to AYANA managing my care setup." });
      setStep(1);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const saveParent = async () => {
    if (!parentConsent) { toast.error("Please confirm you have your parent's consent."); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/parents", parent);
      setParentId(data.id);
      await api.post("/consent", { consent_type: "parent", agreed: true, text: `Consent confirmed for parent ${parent.name}.` });
      setStep(2);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const saveSchedule = async () => {
    if (messages.length === 0) { toast.error("Add at least one daily message."); return; }
    setLoading(true);
    try {
      await api.post("/schedules", { parent_id: parentId, mode, messages, active: true });
      setStep(3);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const doCheckout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/payment/checkout");
      if (data.skipped) toast.success("Trial access granted (test mode).");
      setStep(4);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const activate = async () => {
    setLoading(true);
    try {
      await api.post("/activation/activate");
      await refreshUser();
      navigate("/activation");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition";

  return (
    <div className="min-h-screen bg-ayana-bg">
      {/* Top progress */}
      <div className="border-b border-ayana-line bg-ayana-bg/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-ayana-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" fill="currentColor" strokeWidth={2} />
            </span>
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

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>

            {/* STEP 0 — grounding + child */}
            {step === 0 && (
              <div>
                <div className="text-center mb-8">
                  <span className="inline-flex w-14 h-14 rounded-2xl bg-ayana-primary/8 items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-ayana-primary" strokeWidth={1.5} />
                  </span>
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
                      <input value={child.phone} onChange={(e) => setChild({ ...child, phone: e.target.value })} data-testid="child-phone" placeholder="+919876543210" className={`mt-1.5 ${inputCls}`} />
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
                <div className="mt-6 flex justify-end">
                  <button onClick={saveChild} disabled={loading || !child.name || !child.phone} data-testid="step0-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1 — parent */}
            {step === 1 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Who are we caring for?</h1>
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
                    <input value={parent.phone} onChange={(e) => setParent({ ...parent, phone: e.target.value })} data-testid="parent-phone" placeholder="+919876543210" className={`mt-1.5 ${inputCls}`} />
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
                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input type="checkbox" checked={parentConsent} onChange={(e) => setParentConsent(e.target.checked)} data-testid="parent-consent" className="mt-1 w-4 h-4 accent-ayana-primary" />
                    <span className="text-sm text-ayana-secondary">I confirm my parent is aware of and consents to receiving these caring messages.</span>
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(0)} data-testid="step1-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={saveParent} disabled={loading || !parent.name || !parent.phone} data-testid="step1-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 — schedule */}
            {step === 2 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Build their daily rhythm</h1>
                  <p className="mt-3 text-ayana-secondary">Choose warm check-ins across the day. Times are in <span className="font-medium text-ayana-text">{parent.name || "your parent"}'s</span> timezone.</p>
                </div>

                <div className="flex gap-3 mb-6" data-testid="schedule-mode">
                  {[
                    { key: "normal", label: "Normal", sub: "Up to 5 messages/day" },
                    { key: "care_plus", label: "Care+ (Recovery)", sub: "Up to 10 messages/day" },
                  ].map((m) => (
                    <button key={m.key} onClick={() => setMode(m.key)} data-testid={`mode-${m.key}`}
                      className={`flex-1 text-left rounded-xl border p-4 transition-colors ${mode === m.key ? "border-ayana-accent bg-ayana-accent/5" : "border-ayana-line bg-white hover:bg-ayana-alt"}`}>
                      <span className="flex items-center gap-2 font-display font-medium text-ayana-text">{mode === m.key && <Check className="w-4 h-4 text-ayana-accent" />}{m.label}</span>
                      <span className="text-xs text-ayana-muted">{m.sub}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-3" data-testid="schedule-messages">
                  {messages.map((msg, i) => {
                    const Icon = CATEGORY_ICONS[msg.category] || MessageCircle;
                    return (
                      <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-ayana-line p-3">
                        <span className="w-10 h-10 rounded-lg bg-ayana-primary/8 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-ayana-primary" strokeWidth={1.5} /></span>
                        <input type="time" value={msg.time} onChange={(e) => updateMessage(i, "time", e.target.value)} data-testid={`msg-time-${i}`} className="px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50" />
                        <select value={msg.category} onChange={(e) => updateMessage(i, "category", e.target.value)} data-testid={`msg-category-${i}`} className="flex-1 px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50">
                          {templateEntries.map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                        </select>
                        <button onClick={() => removeMessage(i)} data-testid={`msg-remove-${i}`} className="text-ayana-muted hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                </div>

                <button onClick={addMessage} data-testid="add-message" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ayana-accent hover:text-ayana-accent-hover transition-colors">
                  <Plus className="w-4 h-4" /> Add a check-in ({messages.length}/{limit})
                </button>

                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(1)} data-testid="step2-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={saveSchedule} disabled={loading} data-testid="step2-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — payment (disabled) */}
            {step === 3 && (
              <div>
                <div className="mb-8">
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Choose your plan</h1>
                  <p className="mt-3 text-ayana-secondary">Payments are in test mode right now — you'll continue with free trial access.</p>
                </div>
                <div className="bg-white rounded-2xl border border-ayana-line p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-ayana-text">AYANA Care</h3>
                      <p className="text-sm text-ayana-secondary mt-1">Unlimited daily check-ins · 3 languages · voice replies</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl font-semibold text-ayana-primary">₹499<span className="text-base text-ayana-muted font-normal">/mo</span></p>
                      <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-ayana-accent/10 text-ayana-accent font-medium" data-testid="trial-badge">Free trial · Test mode</span>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-sm text-ayana-secondary">
                    {["Warm messages in English, Telugu & Hindi", "Timezone-accurate delivery", "Voice-note replies kept in their voice", "Delete your data anytime"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-ayana-primary" /> {f}</li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-center gap-2 rounded-xl bg-ayana-alt p-3 text-sm text-ayana-secondary">
                    <CreditCard className="w-4 h-4 text-ayana-muted" /> Payment is disabled during testing. No card required.
                  </div>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(2)} data-testid="step3-back" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-ayana-line text-ayana-text hover:bg-ayana-alt transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <button onClick={doCheckout} disabled={loading} data-testid="step3-next"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue with trial <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 — activate */}
            {step === 4 && (
              <div className="text-center">
                <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-whatsapp/15 items-center justify-center mb-5"><MessageCircle className="w-8 h-8 text-ayana-whatsapp" strokeWidth={1.5} /></span>
                <h1 className="font-display text-3xl font-semibold text-ayana-text">Ready to activate their care circle</h1>
                <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">We'll send a warm welcome to {parent.name || "your parent"} on WhatsApp and begin daily check-ins on their schedule.</p>
                <div className="mt-6 mx-auto max-w-md bg-white rounded-2xl border border-ayana-line p-6 text-left">
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary"><ShieldCheck className="w-4 h-4 text-ayana-primary" /> Consent recorded for you and {parent.name || "your parent"}.</div>
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary mt-2"><Check className="w-4 h-4 text-ayana-primary" /> {messages.length} daily check-ins scheduled in {parent.timezone}.</div>
                </div>
                <button onClick={activate} disabled={loading} data-testid="step4-activate"
                  className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors shadow-lg disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate Care Circle <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
