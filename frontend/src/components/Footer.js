import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-ayana-primary text-white/80 mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} />
            </span>
            <span className="font-display text-xl font-semibold text-white">AYANA</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            A warm care companion that helps you stay close to your parents from afar — with gentle,
            multilingual daily check-ins. AYANA supports your care; it never replaces it.
          </p>
        </div>
        <div>
          <h4 className="font-display text-white font-medium mb-4">Product</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/#how" className="hover:text-white transition-colors">How it works</a></li>
            <li><a href="/#support" className="hover:text-white transition-colors">Why it helps</a></li>
            <li><Link to="/signup" className="hover:text-white transition-colors">Get started</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-white font-medium mb-4">Trust &amp; Safety</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Use</Link></li>
            <li><Link to="/disclaimer" className="hover:text-white transition-colors">Care Disclaimer</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} AYANA. Made with care.</p>
          <p>AYANA is not an emergency or medical service. In a crisis, contact local emergency services.</p>
        </div>
      </div>
    </footer>
  );
}
