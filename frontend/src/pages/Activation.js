import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Check, ArrowRight, Info, Smartphone } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Activation() {
  const { config } = useAuth();
  const [parents, setParents] = useState([]);
  const whatsappLive = config?.whatsapp_enabled;

  useEffect(() => { api.get("/parents").then(({ data }) => setParents(data)).catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-ayana-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-5 sm:px-8 py-12 w-full">
        <div className="text-center mb-10">
          <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-whatsapp/15 items-center justify-center mb-5"><MessageCircle className="w-8 h-8 text-ayana-whatsapp" strokeWidth={1.5} /></span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ayana-text">Your care circle is active 🎉</h1>
          <p className="mt-3 text-ayana-secondary max-w-lg mx-auto">Warm daily check-ins are now scheduled. Here's how to make sure every message lands beautifully.</p>
        </div>

        {!whatsappLive && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-ayana-accent/8 border border-ayana-accent/20 p-4" data-testid="testmode-banner">
            <Info className="w-5 h-5 text-ayana-accent shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm text-ayana-secondary"><span className="font-medium text-ayana-text">Test mode:</span> Live WhatsApp sending is currently off. Messages are simulated and logged so you can preview the full flow. Add Twilio credentials to send for real.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-ayana-line p-7">
          <h3 className="font-display text-lg font-medium text-ayana-text mb-4">Help your parent get set up</h3>
          <ol className="space-y-4">
            {[
              { icon: Smartphone, t: "They keep using normal WhatsApp", d: "No app to install — messages arrive in their usual chats." },
              { icon: Check, t: "Ask them to save the AYANA number", d: "Saving the sender helps messages arrive reliably and feel familiar." },
              { icon: MessageCircle, t: "They can reply anytime", d: "Text or voice — their replies reach you, voice notes untranslated." },
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
                  <a key={p.id} href={`https://wa.me/${(p.phone || "").replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                    data-testid={`wa-link-${p.id}`}
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
          <Link to="/dashboard" data-testid="activation-to-dashboard"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors">
            Go to dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
