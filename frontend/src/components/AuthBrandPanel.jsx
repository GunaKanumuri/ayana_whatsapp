import { Link } from "react-router-dom";
import { Check } from "lucide-react";

/**
 * AuthBrandPanel — the left dark branding panel used on Login and Signup pages.
 * Eliminates duplicated code between those two pages.
 */
export function AuthBrandPanel({ headline, subtext, bullets = [], footer }) {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #061A14 0%, #0A2E1E 60%, #061210 100%)" }}
    >
      {/* Grain and glow decorations */}
      <div className="grain-texture absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-ayana-accent/8 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-ayana-gold/8 blur-3xl" />

      {/* Logo */}
      <Link to="/" className="relative flex items-center gap-3">
        <img src="/ayana_logo.jpg" alt="AYANA" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
        <span className="font-display text-xl font-bold text-white">AYANA</span>
      </Link>

      {/* Main content */}
      <div className="relative max-w-md">
        <h2 className="font-display text-4xl font-bold leading-tight text-white">{headline}</h2>
        {subtext && <p className="mt-5 text-white/60 text-lg">{subtext}</p>}
        {bullets.length > 0 && (
          <ul className="mt-8 space-y-3 text-white/60">
            {bullets.map((txt) => (
              <li key={txt} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ayana-accent/20 flex items-center justify-center text-xs text-ayana-accent">
                  <Check className="w-3.5 h-3.5" />
                </span>
                {txt}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {footer && <p className="relative text-sm text-white/35">{footer}</p>}
    </div>
  );
}
