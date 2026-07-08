import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Heart, Menu } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-ayana-bg/70 border-b border-ayana-line/60">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 group">
          <span className="w-9 h-9 rounded-full bg-ayana-primary flex items-center justify-center">
            <Heart className="w-4.5 h-4.5 text-white" strokeWidth={2} fill="currentColor" />
          </span>
          <span className="font-display text-xl font-semibold text-ayana-text tracking-tight">AYANA</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-ayana-secondary">
          <a href="/#how" className="hover:text-ayana-text transition-colors duration-200">How it works</a>
          <a href="/#support" className="hover:text-ayana-text transition-colors duration-200">Why parents feel supported</a>
          <a href="/#privacy" className="hover:text-ayana-text transition-colors duration-200">Privacy</a>
          <a href="/#faq" className="hover:text-ayana-text transition-colors duration-200">FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" data-testid="nav-admin" className="text-sm text-ayana-secondary hover:text-ayana-text">Admin</Link>
              )}
              <Link to="/dashboard" data-testid="nav-dashboard" className="text-sm font-medium text-ayana-text hover:text-ayana-primary">Dashboard</Link>
              <button data-testid="nav-logout" onClick={() => { logout(); navigate("/"); }} className="text-sm text-ayana-secondary hover:text-ayana-accent transition-colors">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="text-sm font-medium text-ayana-text hover:text-ayana-primary transition-colors">Log in</Link>
              <Link to="/signup" data-testid="nav-signup" className="text-sm font-medium px-5 py-2.5 rounded-full bg-ayana-primary text-white hover:bg-ayana-primary-hover transition-colors duration-200">Get started</Link>
            </>
          )}
        </div>

        <button className="md:hidden text-ayana-text" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle" aria-label="Menu">
          <Menu className="w-6 h-6" strokeWidth={1.5} />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-ayana-line/60 bg-ayana-bg px-5 py-4 flex flex-col gap-3 text-sm">
          <a href="/#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="/#privacy" onClick={() => setOpen(false)}>Privacy</a>
          <a href="/#faq" onClick={() => setOpen(false)}>FAQ</a>
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              <button onClick={() => { logout(); navigate("/"); setOpen(false); }} className="text-left text-ayana-accent">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="font-medium text-ayana-primary">Get started</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
