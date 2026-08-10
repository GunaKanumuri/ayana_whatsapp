import { Link } from "react-router-dom";
import {
  MessageCircle, Globe, ShieldCheck, ArrowRight, Check, Mic, Clock, Languages,
  PlayCircle, Heart, ArrowUpRight,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingCards } from "@/components/PricingCards";
import { Scene3D } from "@/components/Scene3D";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: "easeOut" } }) };

// Local images served from /public — no external URL dependency, no rate limits.
const IMG = {
  parents: "/img_parents.jpg",
  nri:     "/img_nri.jpg",
};

const LANGS = [["en", "EN"], ["te", "తె"], ["hi", "हिं"]];
const trackEvent = (name, props) => { if (window.gtag) window.gtag("event", name, props); };

function LangSwitch({ lang, setLang }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full p-1 border border-ayana-gold/40 bg-white/70" data-testid="lang-switcher">
      {LANGS.map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)} data-testid={`lang-switcher-${code}`}
          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${lang === code ? "bg-ayana-gold text-white shadow-sm" : "text-ayana-secondary hover:text-ayana-text"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// small elegant eyebrow: gold rule + instrument-serif italic label
function Eyebrow({ children, center = false }) {
  return (
    <div className={`flex items-center gap-3 mb-5 ${center ? "justify-center" : ""}`}>
      <span className="h-px w-8 bg-ayana-gold/60" />
      <span className="font-instrument italic text-ayana-gold text-lg sm:text-xl">{children}</span>
    </div>
  );
}

export default function Landing() {
  const { config } = useAuth();
  const { t, lang, setLang } = useLang();

  const steps        = t("how.steps");
  const faqItems     = t("faq.items");
  const globalPoints = t("global.points");

  return (
    <div data-lang={lang} className="relative min-h-screen bg-[#F9F6F0] text-[#2C2825] overflow-x-hidden">
      {/* Fixed 3D canvas — confined to the right half, hidden on small screens */}
      <div className="fixed top-0 right-0 h-screen w-[58%] z-0 pointer-events-none hidden lg:block" aria-hidden="true">
        {/* ErrorBoundary silently hides the 3D scene on devices without WebGL */}
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}><Scene3D progress={progress} /></Suspense>
        </ErrorBoundary>
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#F9F6F0] to-transparent" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#F9F6F0]/70 border-b border-[#E5DFD3]/70">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" data-testid="nav-logo"><Logo size={38} /></Link>
          <nav className="hidden lg:flex items-center gap-9 text-[13px] uppercase tracking-[0.14em] text-ayana-secondary">
            {[["#how", t("nav.how")], ["#trust", t("nav.trust")], ["#pricing", t("nav.pricing")], ["#faq", t("nav.faq")]].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-ayana-gold transition-colors">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LangSwitch lang={lang} setLang={setLang} />
            <Link to="/login" data-testid="nav-login" className="hidden sm:inline text-sm font-semibold text-ayana-secondary hover:text-ayana-text transition-colors">{t("nav.login")}</Link>
            <Link to="/signup" data-testid="nav-signup" className="btn-saffron text-sm font-semibold px-5 py-2 rounded-full">{t("nav.signup")}</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* ══ HERO ══ */}
        <section className="relative bg-warm-peach overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-10 w-[560px] h-[560px] rounded-full blur-3xl" style={{ background: "rgba(212,150,10,0.20)" }} />
            <div className="absolute bottom-0 -left-24 w-[440px] h-[440px] rounded-full blur-3xl" style={{ background: "rgba(232,89,12,0.07)" }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-14 pb-24 lg:pt-20 lg:pb-32 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
            <div>
              <Eyebrow>{t("hero.badge")}</Eyebrow>

              <h1 className="font-display font-black leading-[0.98] text-ayana-text text-[2.65rem] sm:text-6xl lg:text-[4.6rem]">
                <HighlightText text={t("hero.title")} ranges={[[0, 0.32]]} colors={["text-gradient-gold"]} />
              </h1>
              <div className="mt-5 h-px w-28 bg-gradient-to-r from-ayana-gold via-ayana-accent to-transparent" />

              <p className="font-serif text-2xl sm:text-[1.7rem] leading-snug text-ayana-secondary mt-6 max-w-xl">
                {t("hero.subtitle")}
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-4">
                <Link to="/signup" data-testid="hero-cta" onClick={() => trackEvent("cta_click", { id: "hero" })}
                  className="btn-saffron btn-tactile inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-base">
                  {t("hero.ctaPrimary")} <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
                <a href="#how" data-testid="hero-cta-secondary"
                  className="btn-outline-warm inline-flex items-center justify-center px-8 py-4 rounded-full font-semibold text-base">
                  {t("hero.ctaSecondary")}
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
                {[{ icon: Languages, text: t("hero.t1") }, { icon: Clock, text: t("hero.t2") }, { icon: Check, text: t("hero.t3") }].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-2 text-sm text-ayana-secondary">
                    <Icon className="w-4 h-4 text-ayana-gold shrink-0" /> {text}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: mobile animation ── */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7, ease: [0.22,1,0.36,1] }}
              className="lg:col-span-5">
              <PhoneMockup avatarSrc={IMG.parents} />
            </motion.div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 z-10">
            <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/40 animate-fade-in" />
            <span className="text-[10px] uppercase tracking-widest">scroll</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            HOW IT WORKS — slightly lighter dark
            ═══════════════════════════════════════════ */}
        <section id="how" style={{ background: D.d1 }}>
          {/* gentle top fade from hero */}
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-28">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade} className="max-w-2xl mb-16">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-4">{t("how.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("how.title")}</h2>
              <p className="mt-4 text-white/55 text-lg leading-relaxed">{t("how.sub")}</p>
            </motion.div>

            <div className="order-1 lg:order-2">
              <Eyebrow>{t("how.label")}</Eyebrow>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.05] text-ayana-text">
                <HighlightText text={t("how.title")} ranges={[[0.5, 1.0]]} colors={["text-gradient-gold"]} />
              </h2>
              <p className="font-serif text-xl sm:text-2xl text-ayana-secondary mt-4 leading-snug">{t("how.sub")}</p>

              <ol className="mt-9 divide-y divide-ayana-line/70 border-t border-ayana-line/70">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-5 py-5 group">
                    <span className="font-display text-3xl font-bold text-gradient-gold w-10 shrink-0 leading-none">{`0${i + 1}`}</span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-ayana-text">{step.title}</h3>
                      <p className="text-[15px] text-ayana-secondary leading-relaxed mt-1">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ══ DEMO / how to reply ══ */}
        <section id="training" className="bg-warm-gold">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-14 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <div className="relative">
                <PhoneMockup lang={lang} />
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-xs font-semibold text-ayana-secondary bg-white px-3 py-1.5 rounded-full border border-ayana-line shadow-sm whitespace-nowrap">
                  <PlayCircle className="w-3.5 h-3.5 text-ayana-accent" /> {t("training.watchCta")}
                </span>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>{t("training.label")}</Eyebrow>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.05] text-ayana-text">
                <HighlightText text={t("training.title")} ranges={[[0.5, 1.0]]} colors={["text-gradient-gold"]} />
              </h2>
              <p className="font-serif text-xl sm:text-2xl text-ayana-secondary mt-4 leading-snug">{t("training.sub")}</p>

              <div className="mt-8 space-y-3">
                {t("training.steps").map((step, i) => {
                  const Icon = [MessageCircle, Mic, Check][i];
                  return (
                    <div key={i} className="flex items-start gap-4 rounded-2xl border border-ayana-line bg-white/80 p-4 sm:p-5 shadow-sm">
                      <span className="icon-well-gold w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" strokeWidth={1.75} />
                      </span>
                      <div>
                        <h3 className="font-display text-base font-bold text-ayana-text">{step.title}</h3>
                        <p className="text-sm text-ayana-secondary leading-relaxed mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 text-xs text-ayana-muted leading-relaxed">{t("training.fallbackNote")}</p>
            </div>
          </div>
        </section>

        {/* ══ GLOBAL — big statement ══ */}
        <section className="bg-warm-cream relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-7">
              <Eyebrow><span className="inline-flex items-center gap-2"><Globe className="w-4 h-4" /> {t("global.label")}</span></Eyebrow>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[3.2rem] leading-[1.03] text-ayana-text">
                <HighlightText text={t("global.title")} ranges={[[0, 0.28]]} colors={["text-gradient-gold"]} />
              </h2>
              <p className="font-serif text-xl sm:text-2xl text-ayana-secondary mt-5 leading-snug max-w-2xl">{t("global.sub")}</p>
              <ul className="mt-9 space-y-4 max-w-xl">
                {globalPoints.map((p, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="icon-well-gold w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      {[<Clock key="c" className="w-4 h-4" />, <Mic key="m" className="w-4 h-4" />, <ShieldCheck key="s" className="w-4 h-4" />][i]}
                    </span>
                    <span className="text-ayana-text/80 leading-relaxed pt-1">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 rounded-[2.5rem] blur-xl" style={{ background: "linear-gradient(to bottom-right, rgba(232,89,12,0.2), rgba(10,89,64,0.2))" }} />
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img src={IMG.nri} alt="Adult child staying connected from abroad" loading="lazy" className="w-full h-[460px] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <FloatingChip
                  icon={MessageCircle}
                  iconColor="text-ayana-whatsapp"
                  iconBg="rgba(37,211,102,0.2)"
                  title="Message delivered"
                  subtitle='Amma replied: "Feeling good 😊"'
                  position="-bottom-5 -right-5"
                />
              </div>
            </motion.div>

            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-ayana-accent uppercase tracking-widest mb-5">
                <Globe className="w-4 h-4" /> {t("global.label")}
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white leading-tight">{t("global.title")}</h2>
              <p className="mt-5 text-white/55 text-lg leading-relaxed">{t("global.sub")}</p>
              <ul className="mt-10 space-y-5">
                {globalPoints.map((p, i) => (
                  <motion.li key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fade}
                    className="flex items-start gap-4">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-ayana-accent border border-white/10"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      {[<Clock className="w-4 h-4" />, <Mic className="w-4 h-4" />, <ShieldCheck className="w-4 h-4" />][i]}
                    </span>
                    <span className="text-white/70 leading-relaxed">{p}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ══ TRUST ══ */}
        <section id="trust" className="bg-warm-peach">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-5">{t("trust.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("trust.title")}</h2>
              <p className="mt-4 text-white/55 text-lg leading-relaxed">{t("trust.sub")}</p>
              <div className="mt-10 space-y-4">
                {["note1", "note2", "note3"].map((key, i) => (
                  <motion.div key={key} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fade}
                    className="flex items-start gap-4 rounded-2xl border border-white/8 p-5 transition-all hover:border-ayana-gold/25"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(212,150,10,0.18)" }}>
                      <Heart className="w-4 h-4 text-ayana-gold" strokeWidth={1.75} />
                    </span>
                    <p className="text-white/70 leading-relaxed text-[15px]">{t(`trust.${key}`)}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Parents image — KEEP */}
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade} className="lg:col-span-6">
              <div className="relative">
                <div className="absolute -inset-3 rounded-[2.5rem] blur-xl" style={{ background: "linear-gradient(to bottom-right, rgba(212,150,10,0.22), rgba(10,89,64,0.12))" }} />
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img src={IMG.parents} alt="Elderly parents feeling cared for" loading="lazy" className="w-full h-[480px] object-cover" />
                </div>
                <FloatingChip
                  icon={ShieldCheck}
                  iconColor="text-ayana-mint"
                  iconBg="rgba(47,230,167,0.2)"
                  title="Private & secure"
                  subtitle="No data sold, ever"
                  position="-top-5 -left-5"
                  delay={0.3}
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            TRAINING — how parents reply
            ═══════════════════════════════════════════ */}
        <section id="training" style={{ background: D.d3 }}>
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-28">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-4">{t("training.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("training.title")}</h2>
              <p className="mt-4 text-white/55 text-lg">{t("training.sub")}</p>
            </div>
            <div className="lg:col-span-6">
              <Eyebrow>{t("trust.label")}</Eyebrow>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[3rem] leading-[1.05] text-ayana-text">
                <HighlightText text={t("trust.title")} ranges={[[0.45, 0.75]]} colors={["text-gradient-gold"]} />
              </h2>
              <p className="font-serif text-xl sm:text-2xl text-ayana-secondary mt-4 leading-snug">{t("trust.sub")}</p>
              <div className="mt-8 space-y-4">
                {["note1", "note2", "note3"].map((key) => (
                  <div key={key} className="flex items-start gap-4 rounded-2xl border border-ayana-line bg-white p-5 shadow-sm">
                    <span className="icon-well-gold w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Heart className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <p className="text-ayana-text/80 leading-relaxed text-[15px]">{t(`trust.${key}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ PRICING ══ */}
        <section id="pricing" className="bg-warm-cream">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-4">{t("pricing.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("pricing.title")}</h2>
              <p className="mt-4 text-white/55 text-lg">{t("pricing.sub")}</p>
            </div>
            <PricingCards plans={config?.plans || []} currencies={config?.currencies || []} />
            <div className="mt-8 max-w-2xl mx-auto rounded-2xl border border-ayana-line bg-white p-5 flex items-start gap-4 shadow-sm">
              <span className="icon-well-gold w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <p className="text-sm text-ayana-secondary leading-relaxed">{t("pricing.value")}</p>
            </div>
            <div className="mt-8 text-center">
              <Link to="/signup" data-testid="pricing-cta" onClick={() => trackEvent("cta_click", { id: "pricing" })}
                className="btn-saffron btn-tactile inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold">
                {t("pricing.cta")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FAQ
            ═══════════════════════════════════════════ */}
        <section id="faq" style={{ background: D.d5 }}>
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-28">
            <div className="text-center mb-14">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-4">{t("faq.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("faq.title")}</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`i-${i}`}
                  className="rounded-xl px-5 border border-ayana-line bg-white shadow-sm transition-all hover:border-ayana-gold/50"
                  data-testid={`faq-item-${i}`}>
                  <AccordionTrigger className="text-left font-display text-lg font-semibold text-ayana-text hover:no-underline py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-ayana-secondary leading-relaxed pb-5 text-[15px]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FINAL CTA — the ONE bright moment
            ═══════════════════════════════════════════ */}
        <section style={{ background: "linear-gradient(135deg, #E8590C 0%, #C94008 50%, #A83205 100%)" }}>
          <div className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" style={{ background: "rgba(0,0,0,0.12)" }} />
            <div className="grain-texture absolute inset-0 opacity-20" />
            <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-28 text-center">
              <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}
                className="font-display text-4xl sm:text-6xl font-bold text-white leading-tight">
                {t("finalCta.title")}
              </motion.h2>
              <motion.p initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }} variants={fade}
                className="mt-5 text-white/70 text-lg max-w-xl mx-auto">
                {t("finalCta.sub")}
              </motion.p>
              <Link to="/signup" data-testid="footer-cta" onClick={() => trackEvent("cta_click", { id: "footer" })}
                className="btn-tactile mt-10 inline-flex items-center gap-2 px-9 py-4 rounded-full bg-white font-bold shadow-2xl hover:bg-[#FFF8EE] transition-colors text-ayana-accent">
                {t("finalCta.cta")} <ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="bg-warm-cream border-t border-ayana-line">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <Logo size={44} className="mb-5" />
              <p className="font-serif text-lg leading-snug text-ayana-secondary max-w-md">{t("footer.tagline")}</p>
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ color: "#128C4B", borderColor: "rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)" }}>
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp powered
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-ayana-gold border border-ayana-gold/30 px-3 py-1.5 rounded-full" style={{ background: "rgba(212,150,10,0.08)" }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure &amp; private
                </span>
              </div>
            </div>
            <div className="md:text-right flex flex-col md:items-end gap-4 text-sm text-ayana-secondary">
              <div className="flex gap-5">
                <Link to="/privacy"    className="hover:text-ayana-gold transition-colors">Privacy</Link>
                <Link to="/terms"      className="hover:text-ayana-gold transition-colors">Terms</Link>
                <Link to="/disclaimer" className="hover:text-ayana-gold transition-colors">Disclaimer</Link>
              </div>
              <p className="text-xs max-w-xs text-ayana-muted">{t("footer.disclaimer")}</p>
              <p className="text-xs text-ayana-muted">© {new Date().getFullYear()} AYANA. Made with 💛</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
