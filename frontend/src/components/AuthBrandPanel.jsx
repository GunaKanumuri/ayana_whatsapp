import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PhoneMockup } from "@/components/PhoneMockup";

/**
 * AuthBrandPanel — the left brand panel used on Login and Signup pages.
 * Single shared component so both pages stay in sync automatically.
 *
 * showPhone: renders the reusable PhoneMockup (same component as the
 * Landing hero) instead of the bullet list — used on Signup, where seeing
 * the actual product in action helps more than another bullet list.
 */
export function AuthBrandPanel({ headline, subtext, bullets = [], footer, showPhone = false }) {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0A5940 0%, #0D7050 55%, #0A5940 100%)" }}
    >
      {/* Grain and bright glow decorations */}
      <div className="grain-texture absolute inset-0 opacity-15" aria-hidden="true" />
      <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(255,201,60,0.2)" }} />
      <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-3xl" style={{ background: "rgba(255,107,53,0.22)" }} />

      {/* Logo */}
      <Link to="/" className="relative flex items-center gap-3">
        <img src="/ayana_logo.jpg" alt="AYANA" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
        <span className="font-display text-xl font-bold text-white">AYANA</span>
      </Link>

      {/* Main content */}
      <div className="relative max-w-md">
        <h2 className="font-display text-4xl font-bold leading-tight text-white">{headline}</h2>
        {subtext && <p className="mt-5 text-white/70 text-lg">{subtext}</p>}

        {showPhone ? (
          <div className="mt-8 scale-[0.82] origin-left">
            <PhoneMockup />
          </div>
        ) : (
          bullets.length > 0 && (
            <ul className="mt-8 space-y-3 text-white/75">
              {bullets.map((txt, i) => (
                <li key={txt} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={{
                      background: [`rgba(255,201,60,0.22)`, `rgba(47,230,167,0.22)`, `rgba(255,92,122,0.22)`][i % 3],
                      color: [`#FFC93C`, `#2FE6A7`, `#FF5C7A`][i % 3],
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  {txt}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {/* Footer */}
      {footer && <p className="relative text-sm text-white/45">{footer}</p>}
    </div>
  );
}
