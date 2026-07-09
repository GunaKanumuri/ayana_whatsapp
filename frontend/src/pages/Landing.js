import { useEffect, useRef, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart, MessageCircle, Globe, ShieldCheck, ArrowRight, Check, Mic, Clock, Languages,
  UserPlus, CalendarHeart, BellRing, Sparkles,
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

  const steps = t("how.steps");
  const stepIcons = [UserPlus, CalendarHeart, MessageCircle, BellRing];
  const faqItems = t("faq.items");
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
          <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-[#C05A46] flex items-center justify-center"><Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} /></span>
            <span className="font-serif text-2xl font-semibold tracking-tight">AYANA</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-8 text-sm text-[#6B635E]">
            <a href="#how" className="hover:text-[#2C2825] transition-colors">{t("nav.how")}</a>
            <a href="#trust" className="hover:text-[#2C2825] transition-colors">{t("nav.trust")}</a>
            <a href="#pricing" className="hover:text-[#2C2825] transition-colors">{t("nav.pricing")}</a>
            <a href="#faq" className="hover:text-[#2C2825] transition-colors">{t("nav.faq")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/70 backdrop-blur-md rounded-full p-1 border border-[#E5DFD3]" data-testid="lang-switcher">
              {LANGS.map(([code, label]) => (
                <button key={code} onClick={() => setLang(code)} data-testid={`lang-switcher-${code}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${lang === code ? "bg-[#C05A46] text-white" : "text-[#6B635E] hover:text-[#2C2825]"}`}>{label}</button>
              ))}
            </div>
            <Link to="/login" data-testid="nav-login" className="hidden sm:inline text-sm font-medium hover:text-[#C05A46] transition-colors">{t("nav.login")}</Link>
            <Link to="/signup" data-testid="nav-signup" className="text-sm font-medium px-5 py-2.5 rounded-full bg-[#C05A46] text-white hover:bg-[#A64D3B] transition-colors">{t("nav.signup")}</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-5 sm:px-8 min-h-[88vh] flex items-center py-16">
          <div className="max-w-2xl relative">
            <div className="absolute -inset-x-8 -inset-y-6 bg-gradient-to-r from-[#F9F6F0] via-[#F9F6F0]/85 to-transparent -z-[1] rounded-3xl hidden lg:block" />
            <motion.span initial="hidden" animate="show" custom={0} variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-medium px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-[#E5DFD3] text-[#1E564C]">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> {t("hero.badge")}
            </motion.span>
            <motion.h1 initial="hidden" animate="show" custom={1} variants={fadeUp} className="mt-6 font-serif text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.02] text-[#2C2825]">
              {t("hero.title")}
            </motion.h1>
            <motion.p initial="hidden" animate="show" custom={2} variants={fadeUp} className="mt-6 text-lg text-[#6B635E] leading-relaxed max-w-xl">
              {t("hero.subtitle")}
            </motion.p>
            <motion.div initial="hidden" animate="show" custom={3} variants={fadeUp} className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link to="/signup" data-testid="hero-cta" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#C05A46] text-white font-medium hover:bg-[#A64D3B] transition-colors shadow-lg shadow-[#C05A46]/20">
                {t("hero.ctaPrimary")} <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
              <a href="#how" data-testid="hero-cta-secondary" className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-[#E5DFD3] bg-white/70 backdrop-blur font-medium hover:bg-white transition-colors">{t("hero.ctaSecondary")}</a>
            </motion.div>
            <motion.div initial="hidden" animate="show" custom={4} variants={fadeUp} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#6B635E]">
              <span className="inline-flex items-center gap-1.5"><Languages className="w-4 h-4 text-[#1E564C]" /> {t("hero.t1")}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#1E564C]" /> {t("hero.t2")}</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-[#1E564C]" /> {t("hero.t3")}</span>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-[#F9F6F0]/92 backdrop-blur-sm border-t border-[#E5DFD3]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="max-w-2xl">
              <p className="text-sm font-medium text-[#C05A46] uppercase tracking-wide">{t("how.label")}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold">{t("how.title")}</h2>
              <p className="mt-4 text-[#6B635E] text-lg">{t("how.sub")}</p>
            </motion.div>
            <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => {
                const Icon = stepIcons[i];
                return (
                  <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp}
                    className="relative bg-white rounded-2xl border border-[#E5DFD3] p-7 hover:-translate-y-1 transition-transform duration-300">
                    <span className="absolute top-5 right-6 font-serif text-4xl text-[#F0E9DC]">{i + 1}</span>
                    <span className="w-12 h-12 rounded-xl bg-[#1E564C]/10 flex items-center justify-center mb-5"><Icon className="w-6 h-6 text-[#1E564C]" strokeWidth={1.5} /></span>
                    <h3 className="font-serif text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-[#6B635E] leading-relaxed">{step.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global connection */}
        <section className="bg-[#1E564C] text-white">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24 grid lg:grid-cols-12 gap-14 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-5">
              <div className="rounded-[2rem] overflow-hidden shadow-2xl"><img src={IMG.nri} alt="Adult child staying connected from abroad" className="w-full h-[420px] object-cover" /></div>
            </motion.div>
            <div className="lg:col-span-7">
              <p className="text-sm font-medium text-[#E8A08C] uppercase tracking-wide flex items-center gap-2"><Globe className="w-4 h-4" /> {t("global.label")}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold">{t("global.title")}</h2>
              <p className="mt-4 text-white/75 text-lg leading-relaxed">{t("global.sub")}</p>
              <ul className="mt-8 space-y-4">
                {globalPoints.map((p, i) => (
                  <motion.li key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">{[<Clock className="w-4 h-4" />, <Mic className="w-4 h-4" />, <ShieldCheck className="w-4 h-4" />][i]}</span>
                    <span className="text-white/85">{p}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Trust / testimonials */}
        <section id="trust" className="bg-[#F9F6F0]/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24 grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6">
              <p className="text-sm font-medium text-[#C05A46] uppercase tracking-wide">{t("trust.label")}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold">{t("trust.title")}</h2>
              <p className="mt-4 text-[#6B635E] text-lg">{t("trust.sub")}</p>
              <div className="mt-8 space-y-4">
                {[["quote1", "quote1by"], ["quote2", "quote2by"]].map(([q, by], i) => (
                  <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp} className="bg-white rounded-2xl border border-[#E5DFD3] p-6">
                    <p className="text-[#2C2825] leading-relaxed">{t(`trust.${q}`)}</p>
                    <p className="mt-2 text-sm text-[#6B635E]">{t(`trust.${by}`)}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-6">
              <div className="rounded-[2rem] overflow-hidden shadow-xl"><img src={IMG.parents} alt="Elderly parents feeling cared for" className="w-full h-[460px] object-cover" /></div>
            </motion.div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-[#F1EADC]/95 backdrop-blur-sm border-y border-[#E5DFD3]">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-24">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <p className="text-sm font-medium text-[#C05A46] uppercase tracking-wide">{t("pricing.label")}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold">{t("pricing.title")}</h2>
              <p className="mt-4 text-[#6B635E] text-lg">{t("pricing.sub")}</p>
            </div>
            <PricingCards plans={config?.plans || []} currencies={config?.currencies || []} />
            <div className="mt-8 text-center">
              <Link to="/signup" data-testid="pricing-cta" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#1E564C] text-white font-medium hover:opacity-90 transition-opacity">{t("pricing.cta")} <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[#F9F6F0]/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
            <div className="text-center mb-12">
              <p className="text-sm font-medium text-[#C05A46] uppercase tracking-wide">{t("faq.label")}</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold">{t("faq.title")}</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`i-${i}`} className="bg-white border border-[#E5DFD3] rounded-xl px-5" data-testid={`faq-item-${i}`}>
                  <AccordionTrigger className="text-left font-serif text-lg font-medium hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-[#6B635E] leading-relaxed">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA + Footer */}
        <section className="bg-[#C05A46] text-white">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24 text-center">
            <h2 className="font-serif text-4xl sm:text-6xl font-semibold max-w-3xl mx-auto leading-tight">{t("finalCta.title")}</h2>
            <p className="mt-5 text-white/80 text-lg max-w-xl mx-auto">{t("finalCta.sub")}</p>
            <Link to="/signup" data-testid="footer-cta" className="mt-9 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#C05A46] font-semibold hover:bg-[#F9F6F0] transition-colors">{t("finalCta.cta")} <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </section>

        <footer className="bg-[#2C2825] text-white/70">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid md:grid-cols-2 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} /></span>
                <span className="font-serif text-2xl font-semibold text-white">AYANA</span>
              </div>
              <p className="max-w-md text-sm leading-relaxed">{t("footer.tagline")}</p>
            </div>
            <div className="md:text-right flex flex-col md:items-end gap-3 text-sm">
              <div className="flex gap-5">
                <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                <Link to="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
              </div>
              <p className="text-xs text-white/50 max-w-sm">{t("footer.disclaimer")}</p>
              <p className="text-xs text-white/40">© {new Date().getFullYear()} AYANA. Made with care.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
