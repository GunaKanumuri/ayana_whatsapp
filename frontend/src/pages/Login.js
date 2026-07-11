import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { AuthBrandPanel } from "@/components/AuthBrandPanel";

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}`);
      if (data.user.role === "admin") navigate("/admin");
      else navigate(data.user.onboarding_complete ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ayana-bg">
      <AuthBrandPanel
        headline="Welcome back to their care circle."
        subtext="Your parents are one login away from another warm day. 💛"
        footer="Care that reaches home, every single day."
      />

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <span className="w-9 h-9 rounded-full bg-ayana-primary flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 text-white" fill="currentColor" strokeWidth={2} />
            </span>
            <span className="font-display text-xl font-semibold text-ayana-text">AYANA</span>
          </Link>
          <h1 className="font-display text-3xl font-semibold text-ayana-text">Log in</h1>
          <p className="mt-2 text-ayana-secondary">Continue caring from afar.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="text-sm font-medium text-ayana-text">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email" placeholder="you@example.com"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-ayana-line bg-white text-ayana-text focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ayana-text">Password</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password" placeholder="••••••••"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-ayana-line bg-white text-ayana-text focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition"
              />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
            <button
              type="submit" disabled={loading} data-testid="login-submit"
              className="w-full btn-saffron flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Log in
            </button>
          </form>

          <p className="mt-6 text-sm text-ayana-secondary text-center">
            New here?{" "}
            <Link to="/signup" className="text-ayana-accent font-medium hover:underline" data-testid="login-to-signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
