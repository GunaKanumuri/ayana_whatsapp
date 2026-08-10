import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Loader2, CheckCircle2, XCircle, ArrowRight, Users } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/**
 * InviteClaim — /invite/:token
 *
 * Handles three states:
 *   1. Loading  — verifying the token with the API
 *   2. Logged in  — show "Accept" button, one click to join
 *   3. Not logged in — show invite preview + "Create account / Log in" CTA
 *
 * Expired / invalid tokens show a friendly error state with no dead ends.
 */
export default function InviteClaim() {
  const { token }   = useParams();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [state,    setState]   = useState("loading");   // loading | preview | accepting | accepted | error
  const [invite,   setInvite]  = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expired,  setExpired]  = useState(false);

  // ── Step 1: Fetch invite preview ─────────────────────────────────────────
  useEffect(() => {
    if (!token) { setState("error"); setErrorMsg("No invite token in URL."); return; }

    api.get(`/circle/invite/${token}`)
      .then(({ data }) => {
        setInvite(data);
        setState("preview");
      })
      .catch((err) => {
        const status = err.response?.status;
        const detail = err.response?.data?.detail || "Something went wrong.";
        if (status === 410) setExpired(true);
        setErrorMsg(detail);
        setState("error");
      });
  }, [token]);

  // ── Step 2: Auto-accept if user is already logged in after page load ──────
  useEffect(() => {
    if (state === "preview" && user && invite) {
      // If the logged-in email matches the invite email, auto-accept
      if (user.email === invite.email) {
        handleAccept();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user, invite]);

  const handleAccept = async () => {
    setState("accepting");
    try {
      await api.post(`/circle/invite/${token}/accept`);
      setState("accepted");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not accept invite.");
      setState("preview");
    }
  };

  // ── Shared header ─────────────────────────────────────────────────────────
  const Header = () => (
    <div className="border-b border-ayana-line bg-ayana-bg/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="w-8 h-8 rounded-full bg-ayana-primary flex items-center justify-center group-hover:scale-105 transition-transform">
            <Heart className="w-4 h-4 text-white" fill="currentColor" strokeWidth={2} />
          </span>
          <span className="font-display font-semibold text-ayana-text">AYANA</span>
        </Link>
      </div>
    </div>
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-ayana-bg">
        <Header />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-ayana-primary" />
        </div>
      </div>
    );
  }

  // ── Error / expired state ─────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="min-h-screen bg-ayana-bg">
        <Header />
        <div className="max-w-lg mx-auto px-5 sm:px-8 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex w-16 h-16 rounded-2xl bg-red-100 items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ayana-text mb-3">
              {expired ? "This invite has expired" : "Invalid invite link"}
            </h1>
            <p className="text-ayana-secondary mb-8">{errorMsg}</p>
            {expired && (
              <p className="text-sm text-ayana-muted bg-ayana-alt border border-ayana-line rounded-xl p-4 mb-8">
                Ask the person who invited you to send a new invite from their
                AYANA dashboard → <strong>Care circle</strong> tab.
              </p>
            )}
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ayana-primary text-white font-medium hover:bg-ayana-primary-hover transition-colors"
            >
              Go to AYANA home
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Accepted state ────────────────────────────────────────────────────────
  if (state === "accepted") {
    return (
      <div className="min-h-screen bg-ayana-bg">
        <Header />
        <div className="max-w-lg mx-auto px-5 sm:px-8 py-20 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="inline-flex w-16 h-16 rounded-2xl bg-ayana-primary/10 items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-ayana-primary" strokeWidth={1.5} />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ayana-text mb-3">
              Welcome to the care circle! 💛
            </h1>
            <p className="text-ayana-secondary mb-8">
              You're now part of{" "}
              <strong>{invite?.inviter_name || "their"}</strong>'s care circle
              {invite?.parent_display_name ? (
                <> for <strong className="text-ayana-primary">{invite.parent_display_name}</strong></>
              ) : ""}
              . You'll be able to see daily updates and replies from the dashboard.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors shadow-lg"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Preview state (main) ──────────────────────────────────────────────────
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-ayana-bg relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1000px 400px at 100% -5%, rgba(217,108,74,0.06), transparent), radial-gradient(800px 400px at -10% 10%, rgba(44,76,59,0.06), transparent)",
        }}
        aria-hidden="true"
      />
      <Header />

      <div className="relative max-w-lg mx-auto px-5 sm:px-8 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Invite card */}
          <div className="bg-white rounded-2xl border border-ayana-line shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="bg-ayana-primary px-8 py-6 text-center">
              <span className="inline-flex w-12 h-12 rounded-full bg-white/15 items-center justify-center mb-3">
                <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
              </span>
              <h1 className="font-display text-xl font-semibold text-white">
                You're invited to co-care 💛
              </h1>
            </div>

            {/* Card body */}
            <div className="px-8 py-7 space-y-5">
              <p className="text-ayana-secondary text-base leading-relaxed">
                <span className="font-semibold text-ayana-text">{invite?.inviter_name || "Someone"}</span>{" "}
                has invited you to join their{" "}
                <span className="font-semibold text-ayana-text">AYANA care circle</span>
                {invite?.parent_display_name ? (
                  <>
                    {" "}for{" "}
                    <span className="font-semibold text-ayana-primary">
                      {invite.parent_display_name}
                    </span>
                  </>
                ) : ""}.
              </p>

              <div className="rounded-xl bg-ayana-alt border border-ayana-line p-4 space-y-2 text-sm text-ayana-secondary">
                <p>✅ View daily wellbeing updates in real time</p>
                <p>🔔 Get alerted if something seems off — together</p>
                <p>💸 No extra cost — managed under their account</p>
              </div>

              {invite?.expires_at && (
                <p className="text-xs text-ayana-muted text-center">
                  This invite expires on{" "}
                  {new Date(invite.expires_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}

              {/* CTA block */}
              {isLoggedIn ? (
                // User is logged in — check if email matches
                user.email === invite?.email ? (
                  <button
                    onClick={handleAccept}
                    disabled={state === "accepting"}
                    className="w-full flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors shadow-md disabled:opacity-60"
                  >
                    {state === "accepting"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><CheckCircle2 className="w-4 h-4" /> Accept &amp; join care circle</>
                    }
                  </button>
                ) : (
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 text-sm text-orange-700 text-center">
                    <p className="font-medium mb-1">Wrong account</p>
                    <p>This invite was sent to <strong>{invite?.email}</strong>, but you're logged in as <strong>{user?.email}</strong>.</p>
                    <p className="mt-2">Please log out and sign in with the invited email address.</p>
                  </div>
                )
              ) : (
                // Not logged in
                <div className="space-y-3">
                  <Link
                    to={`/signup?email=${encodeURIComponent(invite?.email || "")}&invite_token=${encodeURIComponent(token)}`}
                    className="w-full flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-ayana-accent text-white font-medium hover:bg-ayana-accent-hover transition-colors shadow-md"
                  >
                    Create account &amp; accept <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/login?email=${encodeURIComponent(invite?.email || "")}&redirect=/invite/${encodeURIComponent(token)}`}
                    className="w-full flex items-center justify-center gap-2 px-7 py-3 rounded-full border border-ayana-line text-ayana-text font-medium hover:bg-ayana-alt transition-colors"
                  >
                    Already have an account? Log in
                  </Link>
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-xs text-center text-ayana-muted">
            If you weren't expecting this invite, you can safely ignore this page.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
