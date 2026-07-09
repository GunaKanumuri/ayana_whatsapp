import { useEffect, useRef, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart, MessageCircle, Globe, ShieldCheck, ArrowRight, Check, Mic, Clock, Languages,
  UserPlus, CalendarHeart, BellRing, Sparkles, PlayCircle,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingCards } from "@/components/PricingCards";
import { Scene3D } from "@/components/Scene3D";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const fade = { hidden: { opacity: 0, y: 28 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.65, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] } }) };

/* ── Kept images ── */
const IMG = {
  parents: "/img_parents.jpg",
  nri:     "/img_nri.jpg",
  heroBg:  "/ayana_hero_bg.jpg",
  logo:    "/ayana_logo.jpg",
};

/* ── Dark palette constants (landing-only) ── */
const D = {
  base:   "#061A14",   // midnight emerald — hero, global, footer
  d1:     "#0A1E15",   // how-it-works
  d2:     "#081511",   // trust
  d3:     "#0C2018",   // training
  d4:     "#070F0B",   // pricing — deepest
  d5:     "#091910",   // faq
};

const LANGS = [["en", "EN"], ["te", "తె"], ["hi", "हिं"]];
const trackEvent = (name, props) => { if (window.gtag) window.gtag("event", name, props); };

/* ── Reusable dark glass card ── */
const GlassCard = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm ${className}`}>{children}</div>
);

export default function Landing() {
  const { config } = useAuth();
  const { t, lang, setLang } = useLang();
  const progress = useRef(0);

  useEffect(() => {
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.current = max > 0 ? window.scrollY / max : 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const steps        = t("how.steps");
  const stepIcons    = [UserPlus, CalendarHeart, MessageCircle, BellRing];
  const faqItems     = t("faq.items");
  const globalPoints = t("global.points");

  return (
    <div data-lang={lang} className="relative min-h-screen overflow-x-hidden"
      style={{ background: D.base, color: "#F0EBE1" }}>

      {/* 3D orb — desktop, silent on WebGL fail */}
      <div className="fixed top-0 right-0 h-screen w-[52%] z-0 pointer-events-none hidden lg:block" aria-hidden="true">
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}><Scene3D progress={progress} /></Suspense>
        </ErrorBoundary>
        <div className="absolute inset-y-0 left-0 w-2/5"
          style={{ background: `linear-gradient(to right, ${D.base}, transparent)` }} />
      </div>

      {/* ═══════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-white/8"
        style={{ background: "rgba(6,26,20,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">

          <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5">
            <img src={IMG.logo} alt="AYANA" className="w-9 h-9 rounded-full object-cover ring-2 ring-ayana-accent/40" />
            <span className="font-display text-xl font-bold tracking-tight text-white">AYANA</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-sm text-white/55">
            {[["#how", t("nav.how")], ["#trust", t("nav.trust")], ["#pricing", t("nav.pricing")], ["#faq", t("nav.faq")]].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors">{label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-full p-1 border border-white/10 bg-white/5" data-testid="lang-switcher">
              {LANGS.map(([code, label]) => (
                <button key={code} onClick={() => setLang(code)} data-testid={`lang-switcher-${code}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${lang === code ? "bg-ayana-accent text-white" : "text-white/50 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            <Link to="/login" data-testid="nav-login" className="hidden sm:inline text-sm font-medium text-white/60 hover:text-white transition-colors">{t("nav.login")}</Link>
            <Link to="/signup" data-testid="nav-signup" className="btn-saffron text-sm font-semibold px-5 py-2 rounded-full">{t("nav.signup")}</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* ═══════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════ */}
        <section className="relative min-h-[92vh] flex items-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${D.base} 0%, #0A2E1E 50%, #061210 100%)` }}>
          <div className="absolute inset-0 z-0">
            <img src={IMG.heroBg} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-25 mix-blend-luminosity" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top-right, rgba(232,89,12,0.12), transparent)" }} />
            <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(212,150,10,0.06)" }} />
            <div className="grain-texture absolute inset-0 opacity-20" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-24 w-full">
            <div className="max-w-2xl">
              <motion.div initial="hidden" animate="show" custom={0} variants={fade}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ayana-gold/40 bg-ayana-gold/10 backdrop-blur-sm mb-8">
                <Sparkles className="w-3.5 h-3.5 text-ayana-gold" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-ayana-gold tracking-wide uppercase">{t("hero.badge")}</span>
              </motion.div>

              <motion.h1 initial="hidden" animate="show" custom={1} variants={fade}
                className="font-display text-5xl sm:text-6xl lg:text-[5.25rem] font-bold leading-[1.04] text-white">
                {t("hero.title")}
              </motion.h1>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.9, duration: 0.7, ease: [0.22,1,0.36,1] }}
                className="mt-1 h-1 w-28 rounded-full bg-gradient-to-r from-ayana-accent to-ayana-gold origin-left" />

              <motion.p initial="hidden" animate="show" custom={2} variants={fade} className="mt-7 text-lg text-white/65 leading-relaxed max-w-lg">
                {t("hero.subtitle")}
              </motion.p>

              <motion.div initial="hidden" animate="show" custom={3} variants={fade} className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link to="/signup" data-testid="hero-cta" onClick={() => trackEvent("cta_click", { id: "hero" })}
                  className="btn-saffron inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-base">
                  {t("hero.ctaPrimary")} <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
                <a href="#how" data-testid="hero-cta-secondary"
                  className="btn-outline-emerald inline-flex items-center justify-center px-8 py-4 rounded-full font-semibold text-base">
                  {t("hero.ctaSecondary")}
                </a>
              </motion.div>

              <motion.div initial="hidden" animate="show" custom={4} variants={fade} className="mt-10 flex flex-wrap gap-3">
                {[{ icon: Languages, text: t("hero.t1") }, { icon: Clock, text: t("hero.t2") }, { icon: Check, text: t("hero.t3") }].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/7 border border-white/10 text-sm text-white/65">
                    <Icon className="w-4 h-4 text-ayana-accent shrink-0" />{text}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25 z-10">
            <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/25 animate-fade-in" />
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

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((step, i) => {
                const Icon = stepIcons[i];
                return (
                  <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fade}
                    className="card-hover relative rounded-2xl border border-white/8 p-7 transition-all duration-300 hover:border-ayana-accent/25"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="absolute top-5 right-6 font-display text-5xl font-bold select-none" style={{ color: "rgba(255,255,255,0.06)" }}>{i + 1}</span>
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: "rgba(232,89,12,0.15)" }}>
                      <Icon className="w-6 h-6 text-ayana-accent" strokeWidth={1.5} />
                    </span>
                    <h3 className="font-display text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                    <div className="absolute bottom-0 left-7 right-7 h-px rounded-full" style={{ background: "linear-gradient(to right, rgba(232,89,12,0.35), transparent)" }} />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            GLOBAL CONNECTION — NRI image (base dark)
            ═══════════════════════════════════════════ */}
        <section style={{ background: D.base }} className="relative overflow-hidden">
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" style={{ background: "rgba(10,89,64,0.18)" }} />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" style={{ background: "rgba(232,89,12,0.08)" }} />
            <div className="grain-texture absolute inset-0 opacity-15" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-28 grid lg:grid-cols-12 gap-16 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade} className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 rounded-[2.5rem] blur-xl" style={{ background: "linear-gradient(to bottom-right, rgba(232,89,12,0.2), rgba(10,89,64,0.2))" }} />
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img src={IMG.nri} alt="Adult child staying connected from abroad" className="w-full h-[460px] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-5 -right-5 rounded-2xl px-5 py-3.5 flex items-center gap-3 animate-float shadow-xl border border-white/10"
                  style={{ background: "rgba(6,26,20,0.9)", backdropFilter: "blur(16px)" }}>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(37,211,102,0.2)" }}>
                    <MessageCircle className="w-4 h-4 text-ayana-whatsapp" fill="currentColor" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Message delivered</p>
                    <p className="text-xs text-white/45">Amma replied: "Feeling good 😊"</p>
                  </div>
                </div>
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

        {/* ═══════════════════════════════════════════
            TRUST — parents image (slightly different dark)
            ═══════════════════════════════════════════ */}
        <section id="trust" style={{ background: D.d2 }}>
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-28 grid lg:grid-cols-12 gap-16 items-center">
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
                  <img src={IMG.parents} alt="Elderly parents feeling cared for" className="w-full h-[480px] object-cover" />
                </div>
                {/* Floating badge */}
                <div className="absolute -top-5 -left-5 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-xl border border-white/10 animate-float"
                  style={{ background: "rgba(6,26,20,0.92)", backdropFilter: "blur(16px)" }}>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(10,89,64,0.3)" }}>
                    <ShieldCheck className="w-4 h-4 text-ayana-primary" style={{ color: "#4ADE80" }} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Private &amp; secure</p>
                    <p className="text-xs text-white/40">No data sold, ever</p>
                  </div>
                </div>
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

            <div className="grid lg:grid-cols-3 gap-5 mb-14">
              {t("training.steps").map((step, i) => {
                const Icon = [MessageCircle, Mic, Check][i];
                return (
                  <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fade}
                    className="card-hover relative rounded-2xl border border-white/8 p-7 hover:border-ayana-accent/25 transition-all"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="absolute top-5 right-6 font-display text-5xl font-bold select-none" style={{ color: "rgba(255,255,255,0.06)" }}>{i + 1}</span>
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: "rgba(232,89,12,0.15)" }}>
                      <Icon className="w-6 h-6 text-ayana-accent" strokeWidth={1.5} />
                    </span>
                    <h3 className="font-display text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Video / placeholder */}
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}
              className="max-w-3xl mx-auto rounded-[2rem] p-3 shadow-2xl border border-white/8"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              {config?.training_video_url ? (
                <video key={config.training_video_url} src={config.training_video_url} controls playsInline
                  className="w-full rounded-[1.5rem] bg-black aspect-video"
                  onPlay={() => trackEvent("training_video_play", { lang })} />
              ) : (
                <div className="rounded-[1.5rem] aspect-video flex flex-col items-center justify-center text-center px-8 gap-4"
                  style={{ background: "linear-gradient(135deg, #040F0A 0%, #071A12 100%)" }}>
                  <div className="w-16 h-16 rounded-full border border-white/15 flex items-center justify-center">
                    <PlayCircle className="w-8 h-8 text-white/30" strokeWidth={1.25} />
                  </div>
                  <p className="text-white/45 text-sm max-w-md leading-relaxed">{t("training.fallbackNote")}</p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            PRICING — deepest dark
            ═══════════════════════════════════════════ */}
        <section id="pricing" style={{ background: D.d4 }}>
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-28">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block text-xs font-bold text-ayana-accent uppercase tracking-widest mb-4">{t("pricing.label")}</span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">{t("pricing.title")}</h2>
              <p className="mt-4 text-white/55 text-lg">{t("pricing.sub")}</p>
            </div>
            <PricingCards plans={config?.plans || []} currencies={config?.currencies || []} dark />
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}
              className="mt-8 max-w-2xl mx-auto rounded-2xl border border-white/8 p-5 flex items-start gap-4"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(10,89,64,0.25)" }}>
                <ShieldCheck className="w-4 h-4" style={{ color: "#4ADE80" }} />
              </span>
              <p className="text-sm text-white/55 leading-relaxed">{t("pricing.value")}</p>
            </motion.div>
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
                  className="rounded-xl px-5 border border-white/8 transition-all hover:border-white/15"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  data-testid={`faq-item-${i}`}>
                  <AccordionTrigger className="text-left font-display text-lg font-semibold text-white hover:no-underline py-5 hover:text-white/80">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/50 leading-relaxed pb-5">
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
                className="btn-tactile mt-10 inline-flex items-center gap-2 px-9 py-4 rounded-full bg-white font-bold shadow-2xl hover:bg-[#FFF5F0] transition-colors"
                style={{ color: "#E8590C" }}>
                {t("finalCta.cta")} <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════ */}
        <footer style={{ background: "#040F0A", color: "rgba(255,255,255,0.5)" }}>
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <img src={IMG.logo} alt="AYANA" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10" />
                <span className="font-display text-2xl font-bold text-white">AYANA</span>
              </div>
              <p className="max-w-md text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{t("footer.tagline")}</p>
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs text-ayana-whatsapp border border-ayana-whatsapp/25 px-3 py-1.5 rounded-full" style={{ background: "rgba(37,211,102,0.1)" }}>
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp powered
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-ayana-gold border border-ayana-gold/25 px-3 py-1.5 rounded-full" style={{ background: "rgba(212,150,10,0.1)" }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure &amp; private
                </span>
              </div>
            </div>
            <div className="md:text-right flex flex-col md:items-end gap-4 text-sm">
              <div className="flex gap-5">
                <Link to="/privacy"    className="hover:text-white transition-colors">Privacy</Link>
                <Link to="/terms"      className="hover:text-white transition-colors">Terms</Link>
                <Link to="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
              </div>
              <p className="text-xs max-w-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{t("footer.disclaimer")}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>© {new Date().getFullYear()} AYANA. Made with 💛</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}