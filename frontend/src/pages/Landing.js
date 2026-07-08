import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Heart, Sunrise, MessageCircle, ShieldCheck, Languages, Clock,
  UserPlus, Users, CalendarHeart, Sparkles, Lock, Mic, ArrowRight, Check,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" } }),
};

const HERO_IMG = "https://images.unsplash.com/photo-1655759738595-418970010986";
const ELDER_IMG = "https://images.unsplash.com/photo-1758686254007-a1aec378eca3";
const CHILD_IMG = "https://images.unsplash.com/photo-1633113215883-a43e36bc6178";

export default function Landing() {
  return (
    <div className="min-h-screen bg-ayana-bg">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <motion.span
              initial="hidden" animate="show" custom={0} variants={fadeUp}
              className="inline-flex items-center gap-2 text-xs font-medium tracking-wide px-3.5 py-1.5 rounded-full bg-ayana-alt text-ayana-primary border border-ayana-line"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> For children living away from parents
            </motion.span>
            <motion.h1
              initial="hidden" animate="show" custom={1} variants={fadeUp}
              className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-ayana-text leading-[1.05]"
            >
              Stay close from afar.
              <span className="block text-ayana-primary">Care that reaches home daily.</span>
            </motion.h1>
            <motion.p
              initial="hidden" animate="show" custom={2} variants={fadeUp}
              className="mt-6 text-lg text-ayana-secondary max-w-xl leading-relaxed"
            >
              AYANA sends your parents warm, gentle WhatsApp check-ins every day — in English, Telugu,
              or Hindi. So even when miles apart, they feel remembered, looked after, and loved.
            </motion.p>
            <motion.div
              initial="hidden" animate="show" custom={3} variants={fadeUp}
              className="mt-9 flex flex-col sm:flex-row gap-3"
            >
              <Link
                to="/signup" data-testid="hero-cta-primary"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors duration-200 shadow-lg shadow-ayana-accent/20"
              >
                Start Their Care Circle <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
              <a
                href="#how" data-testid="hero-cta-secondary"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-ayana-line bg-white text-ayana-text font-medium hover:bg-ayana-alt transition-colors duration-200"
              >
                See how it works
              </a>
            </motion.div>
            <motion.div
              initial="hidden" animate="show" custom={4} variants={fadeUp}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ayana-muted"
            >
              <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-ayana-primary" /> Privacy-first</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-ayana-primary" /> Timezone-safe</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-ayana-primary" /> No app for parents</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-ayana-primary/10">
              <img src={HERO_IMG} alt="A warm family staying connected" className="w-full h-[380px] lg:h-[520px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ayana-primary/30 to-transparent" aria-hidden="true" />
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-5 -left-3 sm:left-6 bg-white rounded-2xl shadow-xl p-4 border border-ayana-line max-w-[260px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-ayana-whatsapp/15 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-ayana-whatsapp" strokeWidth={2} />
                </span>
                <span className="text-xs font-medium text-ayana-secondary">Delivered to Amma · 8:00 AM</span>
              </div>
              <p className="text-sm text-ayana-text leading-snug">శుభోదయం! మీ రోజు ప్రశాంతంగా గడవాలి. 💛</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-ayana-line bg-ayana-alt/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { icon: Languages, label: "3 languages", sub: "English · Telugu · Hindi" },
            { icon: Clock, label: "Parent timezone", sub: "Always arrives on time" },
            { icon: Mic, label: "Voice-note replies", sub: "Their words, untouched" },
            { icon: ShieldCheck, label: "Consent-first", sub: "You stay in control" },
          ].map((item, i) => (
            <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp}>
              <item.icon className="w-6 h-6 mx-auto text-ayana-primary mb-2" strokeWidth={1.5} />
              <p className="font-display font-medium text-ayana-text">{item.label}</p>
              <p className="text-xs text-ayana-muted mt-0.5">{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="max-w-2xl">
          <p className="text-sm font-medium text-ayana-accent tracking-wide uppercase">How it works</p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ayana-text">Set it up once. Peace of mind, every day.</h2>
          <p className="mt-4 text-ayana-secondary text-lg leading-relaxed">Four gentle steps. No app for your parents to install — messages simply arrive on WhatsApp, in their language.</p>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: UserPlus, title: "Create your account", desc: "A quick, private signup for you — the one who cares." },
            { icon: Users, title: "Add your parent", desc: "Their name, relationship, WhatsApp number, and preferred language." },
            { icon: CalendarHeart, title: "Build a daily rhythm", desc: "Pick warm check-ins — mornings, meals, medicine, goodnights." },
            { icon: MessageCircle, title: "Activate the circle", desc: "AYANA takes over, delivering care right on time, every day." },
          ].map((step, i) => (
            <motion.div
              key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp}
              className="group relative bg-white rounded-2xl border border-ayana-line p-7 hover:-translate-y-1 hover:shadow-lg transition-transform transition-shadow duration-300"
            >
              <span className="absolute top-6 right-6 font-display text-4xl font-semibold text-ayana-alt group-hover:text-ayana-accent/20 transition-colors">{i + 1}</span>
              <span className="w-12 h-12 rounded-xl bg-ayana-primary/8 flex items-center justify-center mb-5">
                <step.icon className="w-6 h-6 text-ayana-primary" strokeWidth={1.5} />
              </span>
              <h3 className="font-display text-lg font-medium text-ayana-text">{step.title}</h3>
              <p className="mt-2 text-sm text-ayana-secondary leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* WHY PARENTS FEEL SUPPORTED */}
      <section id="support" className="bg-ayana-primary text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-14 items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-5">
            <div className="rounded-[2rem] overflow-hidden shadow-2xl">
              <img src={ELDER_IMG} alt="Elderly parents reading a message together" className="w-full h-[420px] object-cover" />
            </div>
          </motion.div>
          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-ayana-accent tracking-wide uppercase">Why parents feel supported</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold">It's not a bot to them. It's you, remembering.</h2>
            <p className="mt-4 text-white/75 text-lg leading-relaxed">Every message carries your intention. Warm words in their own language, arriving like clockwork — a quiet reassurance that someone is thinking of them.</p>
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              {[
                { icon: Languages, title: "Their mother tongue", desc: "Telugu, Hindi, or English — comfort in familiar words." },
                { icon: Heart, title: "Emotionally warm", desc: "Tones of care and dignity, never clinical or cold." },
                { icon: Mic, title: "They can reply by voice", desc: "Voice notes reach you untranslated, in their own voice." },
                { icon: Clock, title: "Right on their time", desc: "Scheduled in their timezone, so mornings feel like mornings." },
              ].map((f, i) => (
                <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp} className="flex gap-4">
                  <span className="shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h4 className="font-display font-medium">{f.title}</h4>
                    <p className="text-sm text-white/70 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MULTILINGUAL */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-14 items-center">
        <div className="lg:col-span-6">
          <p className="text-sm font-medium text-ayana-accent tracking-wide uppercase">Multilingual by heart</p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ayana-text">One message, three languages of love.</h2>
          <p className="mt-4 text-ayana-secondary text-lg leading-relaxed">Choose the language your parent is most comfortable in. The same caring message, thoughtfully written for English, Telugu, and Hindi speakers.</p>
          <div className="mt-8 space-y-3">
            {[
              { lang: "English", text: "Good morning, Amma! Wishing you a calm and happy day. 💛" },
              { lang: "తెలుగు", text: "శుభోదయం, అమ్మా! మీ రోజు ప్రశాంతంగా గడవాలి. 💛" },
              { lang: "हिंदी", text: "सुप्रभात, माँ! आपका दिन शांत और खुशहाल हो। 💛" },
            ].map((m, i) => (
              <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp}
                className="flex items-center gap-4 bg-white rounded-xl border border-ayana-line p-4">
                <span className="text-xs font-medium text-ayana-accent w-16 shrink-0">{m.lang}</span>
                <p className="text-sm text-ayana-text">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-6">
          <div className="rounded-[2rem] overflow-hidden shadow-xl">
            <img src={CHILD_IMG} alt="Adult child smiling with relief" className="w-full h-[440px] object-cover" />
          </div>
        </motion.div>
      </section>

      {/* PRIVACY & SAFETY */}
      <section id="privacy" className="bg-ayana-alt/60 border-y border-ayana-line">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="max-w-2xl">
            <p className="text-sm font-medium text-ayana-accent tracking-wide uppercase">Privacy &amp; safety</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ayana-text">Built on trust, not surveillance.</h2>
            <p className="mt-4 text-ayana-secondary text-lg leading-relaxed">This is family, and we treat it that way. Your data is protected, consent is explicit, and you can delete everything at any time.</p>
          </motion.div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: "Your data stays yours", desc: "Encrypted handling, secrets kept server-side, and a one-click delete-account option." },
              { icon: ShieldCheck, title: "Explicit consent", desc: "We log consent for both you and your parent's setup — care should always be welcome." },
              { icon: Heart, title: "Not a medical service", desc: "AYANA detects urgent words and flags them, but it is a companion — never a replacement for emergency care." },
            ].map((f, i) => (
              <motion.div key={i} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp}
                className="bg-white rounded-2xl border border-ayana-line p-7">
                <f.icon className="w-6 h-6 text-ayana-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-display text-lg font-medium text-ayana-text">{f.title}</h3>
                <p className="mt-2 text-sm text-ayana-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
          <p className="text-sm font-medium text-ayana-accent tracking-wide uppercase">Questions</p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ayana-text">Everything you're wondering</h2>
        </motion.div>
        <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
          {[
            { q: "Does my parent need to install anything?", a: "No. Messages arrive on their regular WhatsApp. There's nothing new for them to learn or download." },
            { q: "Will it feel like a robot?", a: "No. Messages are warm and human, written in a caring tone, in your parent's own language. They feel like they come from you." },
            { q: "Which languages are supported?", a: "English, Telugu, and Hindi at launch. Voice-note replies from your parent are kept in their original voice, untranslated." },
            { q: "How does timezone work?", a: "We use your parent's timezone as the source of truth. An 8:00 AM good-morning always arrives at their 8:00 AM." },
            { q: "Is this a medical or emergency service?", a: "No. AYANA is a care companion. It can flag urgent keywords, but it is not a substitute for doctors or emergency services." },
            { q: "Can I stop or delete everything?", a: "Yes. You control every schedule, and you can delete your account and associated data at any time from your dashboard." },
          ].map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="bg-white border border-ayana-line rounded-xl px-5" data-testid={`faq-item-${i}`}>
              <AccordionTrigger className="text-left font-display font-medium text-ayana-text hover:no-underline">{item.q}</AccordionTrigger>
              <AccordionContent className="text-ayana-secondary leading-relaxed">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
          className="relative overflow-hidden rounded-[2.5rem] bg-ayana-primary px-8 py-16 sm:px-16 sm:py-20 text-center">
          <div className="grain-texture absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-5xl font-semibold text-white max-w-2xl mx-auto leading-tight">Set up peace of mind tonight.</h2>
            <p className="mt-5 text-white/75 text-lg max-w-xl mx-auto">In a few minutes, your parents can start their mornings knowing you're right there — in their language, on their time.</p>
            <Link to="/signup" data-testid="footer-cta"
              className="mt-9 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors duration-200 shadow-lg">
              Activate Care Circle <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
