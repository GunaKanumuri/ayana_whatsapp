import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PhoneInput } from "@/components/PhoneInput";
import { toast } from "sonner";

export default function Signup() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pre-fill email when arriving via a Care Circle invite link (?invite=email)
  const inviteEmail = searchParams.get("invite") || "";
  const [form, setForm] = useState({ name: "", email: inviteEmail, phone: "+91", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      loginWithToken(data.token, data.user);
      if (data.user.household_owner_id) {
        toast.success("You've joined the family care circle 💛");
        navigate("/dashboard");
      } else {
        toast.success("Account created. Let's set up their care circle.");
        navigate("/onboarding");
      }
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ayana-bg">
      <div className="hidden lg:flex flex-col justify-between bg-ayana-primary p-12 text-white relative overflow-hidden">
        <div className="grain-texture absolute inset-0 opacity-15" aria-hidden="true" />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} />
          </span>
          <span className="font-display text-xl font-semibold">AYANA</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">A few minutes now. Warmth for them, every day after.</h2>
          <ul className="mt-8 space-y-3 text-white/75">
            {["Set up in minutes", "No app for your parents", "Their language, their time"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">✓</span>{t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">AYANA supports your care — it never replaces it.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <span className="w-9 h-9 rounded-full bg-ayana-primary flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} />
            </span>
            <span className="font-display text-xl font-semibold text-ayana-text">AYANA</span>
          </Link>
          <h1 className="font-display text-3xl font-semibold text-ayana-text">Create your account</h1>
          <p className="mt-2 text-ayana-secondary">Begin their care circle today.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="signup-form">
            <div>
              <label className="text-sm font-medium text-ayana-text">Your name</label>
              <input required value={form.name} onChange={upd("name")} data-testid="signup-name" placeholder="Your full name"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition" />
            </div>
            <div>
              <label className="text-sm font-medium text-ayana-text">Email</label>
              <input type="email" required value={form.email} onChange={upd("email")} data-testid="signup-email" placeholder="you@example.com"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition" />
            </div>
            <div>
              <label className="text-sm font-medium text-ayana-text">Phone</label>
              <div className="mt-1.5"><PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="signup-phone" /></div>
            </div>
            <div>
              <label className="text-sm font-medium text-ayana-text">Password</label>
              <input type="password" required value={form.password} onChange={upd("password")} data-testid="signup-password" placeholder="At least 6 characters"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-ayana-line bg-white focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition" />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="signup-error">{error}</p>}
            <button type="submit" disabled={loading} data-testid="signup-submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create account
            </button>
            <p className="text-xs text-ayana-muted text-center">By continuing you agree to our{" "}
              <Link to="/terms" className="underline">Terms</Link> &{" "}
              <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
          </form>

          <p className="mt-6 text-sm text-ayana-secondary text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-ayana-accent font-medium hover:underline" data-testid="signup-to-login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
