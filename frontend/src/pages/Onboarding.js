import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Loader2, ArrowRight, ArrowLeft, Check, ShieldCheck, MessageCircle, Sparkles, Info,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES } from "@/lib/constants";
import { PhoneInput } from "@/components/PhoneInput";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { PricingCards } from "@/components/PricingCards";
import { toast } from "sonner";

const STEPS = ["Welcome", "Your parent", "Your plan", "Daily rhythm", "Activate"];

export default function Onboarding() {
  const { user, config, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [child, setChild] = useState({ name: user?.name || "", phone: user?.phone || "+91", city: "", timezone: "Asia/Kolkata" });
  const [childConsent, setChildConsent] = useState(false);

  const [parent, setParent] = useState({ name: "", relationship: "Mother", phone: "+91", language: "en", timezone: "Asia/Kolkata", notes: "" });
  const [parentConsent, setParentConsent] = useState(false);
  const [parentId, setParentId] = useState(null);

  const [planId, setPlanId] = useState("basic");

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
  const limits = useMemo(() => (plans.find((p) => p.id === planId)?.limits) || { checkins: 3, reminders: 2 }, [plans, planId]);

  useEffect(() => { if (user?.onboarding_complete || user?.household_owner_id) navigate("/dashboard"); }, [user, navigate]);

  const inputCls = "w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition";

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
      const { data } = await api.post("/parents", parent);
      setParentId(data.id);
      await api.post("/consent", { consent_type: "parent", agreed: true, text: `Consent confirmed for parent ${parent.name}.` });
      setStep(2);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const choosePlan = async (id, billing) => {
    setPlanId(id);
    setLoading(true);
    try {
      await api.post("/payment/checkout", { plan: id, billing });
      toast.success(`${id === "care_plus" ? "Care+" : "Basic"} selected · trial (test mode).`);
      setStep(3);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setLoading(false); }
  };

  const saveSchedule = async () => {
    if (messages.length === 0) { toast.error("Add at least one daily check-in."); return; }
    setLoading(true);
    try {
      await api.post("/schedules", { parent_id: parentId, mode: planId === "care_plus" ? "care_plus" : "normal", messages, active: true });
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
                  {/* Optional notes — consistent with Dashboard parent dialog */}
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
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Choose your care plan</h1>
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
                  <h1 className="font-display text-3xl font-semibold text-ayana-text">Build their daily rhythm</h1>
                  <p className="mt-3 text-ayana-secondary">Warm check-ins and gentle reminders for <span className="font-medium text-ayana-text">{parent.name || "your parent"}</span>. Times are in their timezone.</p>
                </div>
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-ayana-alt border border-ayana-line p-3 text-sm text-ayana-secondary">
                  <Info className="w-4 h-4 text-ayana-primary shrink-0 mt-0.5" />
                  <span>Your <b>{planId === "care_plus" ? "Care+" : "Basic"}</b> plan: up to {limits.checkins} check-ins &amp; {limits.reminders} reminders/day. {planId !== "care_plus" && "Need more? Upgrade to Care+."}</span>
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
                <h1 className="font-display text-3xl font-semibold text-ayana-text">Ready to activate their care circle</h1>
                <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">We'll send a warm welcome + a short how-to-reply guide to {parent.name || "your parent"} on WhatsApp, then begin daily check-ins.</p>
                <div className="mt-6 mx-auto max-w-md bg-white rounded-2xl border border-ayana-line p-6 text-left">
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary"><ShieldCheck className="w-4 h-4 text-ayana-primary" /> Consent recorded for you and {parent.name || "your parent"}.</div>
                  <div className="flex items-center gap-2 text-sm text-ayana-secondary mt-2"><Check className="w-4 h-4 text-ayana-primary" /> {messages.length} daily messages scheduled in {parent.timezone}.</div>
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