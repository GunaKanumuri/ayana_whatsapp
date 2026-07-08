import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Check, ArrowRight, Info, Smartphone, Mic, PlayCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Activation() {
  const { config } = useAuth();
  const [parents, setParents] = useState([]);
  const whatsappLive = config?.whatsapp_enabled;
  const videoUrl = config?.training_video_url;

  useEffect(() => { api.get("/parents").then(({ data }) => setParents(data)).catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-ayana-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-5 sm:px-8 py-12 w-full">
        <div className="text-center mb-10">
          <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-whatsapp/15 items-center justify-center mb-5"><MessageCircle className="w-8 h-8 text-ayana-whatsapp" strokeWidth={1.5} /></span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ayana-text">Your care circle is active 🎉</h1>
          <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">Warm daily check-ins are now scheduled. Here's how to help your parent reply with ease.</p>
        </div>

        {!whatsappLive && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-ayana-accent/8 border border-ayana-accent/20 p-4" data-testid="testmode-banner">
            <Info className="w-5 h-5 text-ayana-accent shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm text-ayana-secondary"><span className="font-medium text-ayana-text">Test mode:</span> Live WhatsApp sending is currently off. Messages are simulated and logged so you can preview the full flow.</p>
          </div>
        )}

        {/* How to reply / training */}
        <div className="bg-white rounded-2xl border border-ayana-line p-7 mb-6">
          <h3 className="font-display text-lg font-medium text-ayana-text mb-4">How your parent replies (super simple)</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-ayana-alt p-4">
              <p className="text-sm font-medium text-ayana-text mb-2">1) Tap a number option</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-white border border-ayana-line">1) Good</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-ayana-line">2) Okay</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-ayana-line">3) Not well</span>
              </div>
              <p className="text-xs text-ayana-muted mt-2">Every message includes options in their language.</p>
            </div>
            <div className="rounded-xl bg-ayana-alt p-4">
              <p className="text-sm font-medium text-ayana-text mb-2 flex items-center gap-1.5"><Mic className="w-4 h-4 text-ayana-accent" /> 2) Or hold the mic</p>
              <p className="text-xs text-ayana-muted">Press &amp; hold the 🎤 button in WhatsApp to record a voice note. It reaches you in their own voice — untranslated.</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl overflow-hidden border border-ayana-line">
            {videoUrl ? (
              <div className="aspect-video">
                <iframe title="How to reply" src={videoUrl} className="w-full h-full" allowFullScreen data-testid="training-video" />
              </div>
            ) : (
              <a href="#" onClick={(e) => e.preventDefault()} data-testid="training-video-placeholder"
                className="flex items-center gap-3 p-4 bg-ayana-primary text-white">
                <PlayCircle className="w-9 h-9 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="font-medium">Training video: How to reply &amp; send a voice note</p>
                  <p className="text-xs text-white/70">Coming soon — we'll auto-send this to your parent on WhatsApp when set.</p>
                </div>
              </a>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ayana-line p-7">
          <h3 className="font-display text-lg font-medium text-ayana-text mb-4">Help your parent get set up</h3>
          <ol className="space-y-4">
            {[
              { icon: Smartphone, t: "They keep using normal WhatsApp", d: "No app to install — messages arrive in their usual chats." },
              { icon: Check, t: "Ask them to save the AYANA number", d: "Saving the sender helps messages arrive reliably." },
              { icon: MessageCircle, t: "They can reply anytime", d: "Text an option or send a voice note — it all reaches you." },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-10 h-10 rounded-xl bg-ayana-primary/8 flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-ayana-primary" strokeWidth={1.5} /></span>
                <div><p className="font-medium text-ayana-text">{s.t}</p><p className="text-sm text-ayana-secondary">{s.d}</p></div>
              </li>
            ))}
          </ol>

          {parents.length > 0 && (
            <div className="mt-6 pt-6 border-t border-ayana-line">
              <p className="text-sm font-medium text-ayana-text mb-3">Send a hello now</p>
              <div className="space-y-2">
                {parents.map((p) => (
                  <a key={p.id} href={`https://wa.me/${(p.phone || "").replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" data-testid={`wa-link-${p.id}`}
                    className="flex items-center justify-between rounded-xl border border-ayana-line px-4 py-3 hover:bg-ayana-alt transition-colors">
                    <span className="text-sm text-ayana-text">{p.name} <span className="text-ayana-muted">· {p.phone}</span></span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ayana-whatsapp"><MessageCircle className="w-4 h-4" /> Open WhatsApp</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link to="/dashboard" data-testid="activation-to-dashboard" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors">Go to dashboard <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
