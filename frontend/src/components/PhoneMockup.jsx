/**
 * PhoneMockup.jsx — Animated WhatsApp check-in demo.
 *
 * Shows exactly how AYANA works, right on the landing page:
 *   1) A warm check-in message arrives on the parent's WhatsApp
 *   2) They tap ONE option (no typing)
 *   3) The tapped reply appears
 *   4) The child is instantly notified
 *   5) A gentle mic hint invites a voice note
 *
 * The sequence loops (a lightweight "explainer video" stand-in until a
 * real recorded video is available). Localised for en / te / hi.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO = {
  en: {
    name: "AYANA \u{1F49B}",
    online: "online",
    incoming: "Good morning, Amma! \u{1F305}\nDid you sleep well? Tap below \u{1F447}",
    options: ["\u{1F60A} Good", "\u{1F610} Okay", "\u{1F61F} Not well"],
    chosen: "\u{1F60A} Good",
    notify: "Delivered to Guna \u2713\u2713",
    mic: "\u{1F3A4} Hold to talk anytime",
  },
  te: {
    name: "AYANA \u{1F49B}",
    online: "\u0C06\u0C28\u0C4D\u200C\u0C32\u0C48\u0C28\u0C4D",
    incoming: "\u0C36\u0C41\u0C2D\u0C4B\u0C26\u0C2F\u0C02 \u0C05\u0C2E\u0C4D\u0C2E! \u{1F305}\n\u0C28\u0C3F\u0C26\u0C4D\u0C30 \u0C2C\u0C3E\u0C17\u0C3E \u0C2A\u0C1F\u0C4D\u0C1F\u0C3F\u0C02\u0C26\u0C3E? \u{1F447}",
    options: ["\u{1F60A} \u0C2C\u0C3E\u0C17\u0C41\u0C02\u0C26\u0C3F", "\u{1F610} \u0C2B\u0C30\u0C4D\u0C35\u0C3E\u0C32\u0C47\u0C26\u0C41", "\u{1F61F} \u0C2C\u0C3E\u0C32\u0C47\u0C26\u0C41"],
    chosen: "\u{1F60A} \u0C2C\u0C3E\u0C17\u0C41\u0C02\u0C26\u0C3F",
    notify: "\u0C17\u0C41\u0C23\u0C15\u0C3F \u0C1A\u0C47\u0C30\u0C3F\u0C02\u0C26\u0C3F \u2713\u2713",
    mic: "\u{1F3A4} \u0C2E\u0C3E\u0C1F\u0C4D\u0C32\u0C3E\u0C21\u0C3E\u0C32\u0C02\u0C1F\u0C47 \u0C28\u0C4A\u0C15\u0C4D\u0C15\u0C3F \u0C09\u0C02\u0C1A\u0C02\u0C21\u0C3F",
  },
  hi: {
    name: "AYANA \u{1F49B}",
    online: "\u0911\u0928\u0932\u093E\u0907\u0928",
    incoming: "\u0938\u0941\u092A\u094D\u0930\u092D\u093E\u0924, \u092E\u093E\u0901! \u{1F305}\n\u0928\u0940\u0902\u0926 \u0905\u091A\u094D\u091B\u0940 \u0906\u0908? \u{1F447}",
    options: ["\u{1F60A} \u0920\u0940\u0915 \u0939\u0942\u0901", "\u{1F610} \u0920\u0940\u0915-\u0920\u093E\u0915", "\u{1F61F} \u0920\u0940\u0915 \u0928\u0939\u0940\u0902"],
    chosen: "\u{1F60A} \u0920\u0940\u0915 \u0939\u0942\u0901",
    notify: "\u0917\u0941\u0923\u093E \u0915\u094B \u092E\u093F\u0932 \u0917\u092F\u093E \u2713\u2713",
    mic: "\u{1F3A4} \u0915\u092D\u0940 \u092D\u0940 \u0926\u092C\u093E\u0915\u0930 \u092C\u094B\u0932\u0947\u0902",
  },
};

export function PhoneMockup({ lang = "en", className = "" }) {
  const d = DEMO[lang] || DEMO.en;
  // step: 0 typing, 1 incoming, 2 options, 3 chosen, 4 notify
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timings = [900, 1500, 1600, 1400, 2600];
    const id = setTimeout(() => setStep((s) => (s + 1) % 5), timings[step]);
    return () => clearTimeout(id);
  }, [step]);

  return (
    <div className={`relative ${className}`}>
      {/* phone body */}
      <div className="relative w-[270px] rounded-[2.6rem] bg-[#2b2119] p-2.5 shadow-2xl ring-1 ring-black/10">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-[#2b2119] z-20" />
        <div className="overflow-hidden rounded-[2.1rem] bg-[#ECE5DD]">
          {/* WhatsApp header */}
          <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ background: "#0A5940" }}>
            <span className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-base">{"\u{1F49B}"}</span>
            <div className="leading-tight">
              <p className="text-white text-[13px] font-semibold">{d.name}</p>
              <p className="text-white/70 text-[10px]">{d.online}</p>
            </div>
          </div>

          {/* chat area */}
          <div
            className="px-3 py-4 min-h-[360px] flex flex-col gap-2.5"
            style={{ backgroundImage: "radial-gradient(rgba(10,89,64,0.05) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          >
            {/* incoming check-in bubble */}
            <AnimatePresence>
              {step >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="self-start max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm"
                >
                  <p className="text-[12.5px] text-[#1f2a24] whitespace-pre-line leading-snug">{d.incoming}</p>
                  <span className="block text-[9px] text-gray-400 text-right mt-1">8:00 AM</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* quick-reply option chips */}
            <AnimatePresence>
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="self-start flex flex-col gap-1.5 w-[80%]"
                >
                  {d.options.map((o, i) => (
                    <div
                      key={o}
                      className={`text-[12px] text-center rounded-xl border py-1.5 bg-white ${i === 0 ? "border-[#0A5940] text-[#0A5940] font-semibold" : "border-gray-200 text-gray-500"}`}
                    >
                      {o}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* chosen reply (outgoing) */}
            <AnimatePresence>
              {step >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="self-end max-w-[70%] rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm"
                  style={{ background: "#DCF8C6" }}
                >
                  <p className="text-[13px] text-[#1f2a24] font-medium">{d.chosen}</p>
                  <span className="block text-[9px] text-green-700/60 text-right mt-0.5">8:01 AM</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* child notified toast */}
            <AnimatePresence>
              {step >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-center mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#0A5940]/10 px-3 py-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-[10.5px] font-medium text-[#0A5940]">{d.notify}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* input bar with mic hint */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F3EDE4] border-t border-black/5">
            <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[11px] text-gray-400">{d.mic}</div>
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "#0A5940" }}>{"\u{1F3A4}"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneMockup;
