import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, CalendarHeart, MessageCircle, CheckCircle2, Plus, Pencil, Trash2,
  Loader2, ShieldCheck, Clock, Power, AlertTriangle, Crown, Send, UserPlus, Mail,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES, LANG_LABELS } from "@/lib/constants";
import { PhoneInput } from "@/components/PhoneInput";
import { ScheduleEditor, CATEGORY_ICONS } from "@/components/ScheduleEditor";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";

const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition";
// Source feeling labels dynamically from /api/config, fall back to English
const buildFeelingMap = (feelingMap) => ({
  emoji: Object.fromEntries(Object.entries(feelingMap || {}).map(([k, v]) => [k, v.emoji])),
  label: Object.fromEntries(Object.entries(feelingMap || {}).map(([k, v]) => [k, v.label?.en || k])),
});

// All dashboard queries share the "dashboard" key prefix so a single
// invalidateQueries call (see `reload` below) refreshes everything —
// matching the old load-everything-after-any-mutation behavior, but
// now with caching between tab switches / navigations instead of a
// full refetch every time.
export default function Dashboard() {
  const { user, config, logout } = useAuth();
  const { emoji: FEELING_EMOJI, label: FEELING_LABEL } = buildFeelingMap(config?.feeling_map);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activitySkip, setActivitySkip] = useState(0);

  const parentsQuery = useQuery({
    queryKey: ["dashboard", "parents"],
    queryFn: () => api.get("/parents").then((r) => r.data),
  });
  const schedulesQuery = useQuery({
    queryKey: ["dashboard", "schedules"],
    queryFn: () => api.get("/schedules").then((r) => r.data),
  });
  const logsQuery = useQuery({
    queryKey: ["dashboard", "logs"],
    queryFn: () => api.get("/messages/logs").then((r) => r.data.items ?? r.data),
  });
  const activationQuery = useQuery({
    queryKey: ["dashboard", "activation"],
    queryFn: () => api.get("/activation").then((r) => r.data),
  });
  const paymentQuery = useQuery({
    queryKey: ["dashboard", "payment"],
    queryFn: () => api.get("/payment/state").then((r) => r.data),
  });
  const circleQuery = useQuery({
    queryKey: ["dashboard", "circle"],
    queryFn: () => api.get("/circle").then((r) => r.data),
  });
  const repliesQuery = useQuery({
    queryKey: ["dashboard", "replies"],
    queryFn: () => api.get("/replies").then((r) => r.data),
  });

  const parents = parentsQuery.data ?? [];
  const schedules = schedulesQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const activation = activationQuery.data ?? {};
  const payment = paymentQuery.data ?? { plan: "basic" };
  const circle = circleQuery.data ?? { role: "owner", members: [], invites: [] };
  const replies = repliesQuery.data ?? [];

  const loading = [parentsQuery, schedulesQuery, logsQuery, activationQuery, paymentQuery, circleQuery, repliesQuery]
    .some((q) => q.isLoading);

  const anyError = [parentsQuery, schedulesQuery, logsQuery, activationQuery, paymentQuery, circleQuery, repliesQuery]
    .some((q) => q.isError);
  useEffect(() => {
    if (anyError) toast.error("Could not load your data.");
  }, [anyError]);

  // Passed down as onSaved / onDone / reload — same call signature every
  // mutation already expects, just backed by the query cache now.
  const load = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const categories = config?.categories || [];
  const relationships = config?.relationships || [];
  const languages = config?.languages || [];
  const plans = config?.plans || [];
  const catByKey = useMemo(() => Object.fromEntries(categories.map((c) => [c.key, c])), [categories]);
  const planId = payment?.state?.plan || payment?.plan || "basic";
  const plan = plans.find((p) => p.id === planId) || plans[0];
  const limits = plan?.limits || { checkins: 2, reminders: 2, nicknames_max: 2, variants_per_slot: 3 };

  const parentName = (id) => parents.find((p) => p.id === id)?.name || "Parent";

  const stats = [
    { icon: Users, label: "Parents", value: parents.length },
    { icon: CalendarHeart, label: "Active schedules", value: schedules.filter((s) => s.active).length },
    { icon: MessageCircle, label: "Messages sent", value: logs.length },
    { icon: CheckCircle2, label: "Care circle", value: activation.whatsapp_activated ? "Active" : "Off" },
  ];

  if (loading) return <div className="min-h-screen bg-ayana-bg"><Navbar /><div className="flex items-center justify-center py-40"><Loader2 className="w-8 h-8 animate-spin text-ayana-primary" /></div></div>;

  return (
    <div className="min-h-screen bg-ayana-bg relative">
      <div className="absolute inset-0 pointer-events-none h-80" style={{ background: "radial-gradient(1000px 320px at 100% 0%, rgba(217,108,74,0.07), transparent), radial-gradient(800px 300px at 0% 0%, rgba(44,76,59,0.06), transparent)" }} aria-hidden="true" />
      <Navbar />
      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ayana-text">Hello, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="mt-1 text-ayana-secondary flex items-center gap-2">Here's how your care circle is doing.
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full ${planId === "care_plus" ? "bg-ayana-accent/10 text-ayana-accent" : "bg-ayana-primary/10 text-ayana-primary"}`} data-testid="plan-badge">
                {planId === "care_plus" && <Crown className="w-3 h-3" />}{plan?.name || "AYANA Basic"} · Trial
              </span>
            </p>
          </div>
          {!activation.whatsapp_activated && !user?.household_owner_id && (
            <button
              onClick={() => navigate(user?.onboarding_step >= 5 ? "/activation" : "/onboarding")}
              data-testid="finish-setup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ayana-accent text-white text-sm font-medium hover:bg-ayana-accent-hover transition-colors"
            >
              {user?.onboarding_step >= 5 ? "Activate WhatsApp" : "Finish setup"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" data-testid="dashboard-stats">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-ayana-line p-5">
              <s.icon className="w-5 h-5 text-ayana-primary mb-3" strokeWidth={1.5} />
              <p className="font-display text-2xl font-semibold text-ayana-text">{s.value}</p>
              <p className="text-sm text-ayana-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="parents">
          <TabsList className="bg-ayana-alt">
            <TabsTrigger value="parents" data-testid="tab-parents">Parents</TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">Schedules</TabsTrigger>
            <TabsTrigger value="replies" data-testid="tab-replies">Replies{replies.length > 0 && <span className="ml-1.5 text-xs px-1.5 rounded-full bg-ayana-accent text-white">{replies.length}</span>}{replies.some((r) => r.ml_flagged && !(r.emergency_keywords?.length > 0)) && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500" title="Something worth checking in on" />}</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="circle" data-testid="tab-circle">Care circle</TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="parents" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-medium text-ayana-text">Your parents</h2>
              <ParentDialog relationships={relationships} languages={languages} nicknamesMax={limits.nicknames_max} onSaved={load}
                trigger={<button data-testid="add-parent" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover transition-colors"><Plus className="w-4 h-4" /> Add parent</button>} />
            </div>
            {parents.length === 0 ? <EmptyState text="No parents added yet." /> : (
              <div className="grid sm:grid-cols-2 gap-4" data-testid="parents-list">
                {parents.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{p.name}</p>
                        <p className="text-sm text-ayana-muted">{p.relationship} · {LANG_LABELS[p.language]}</p>
                      </div>
                      <div className="flex gap-1">
                        <SendTestDialog parent={p} categories={categories}
                          trigger={<button data-testid={`send-test-${p.id}`} title="Send a check-in now" className="p-2 text-ayana-muted hover:text-ayana-whatsapp transition-colors"><Send className="w-4 h-4" /></button>} />
                        <ParentDialog parent={p} relationships={relationships} languages={languages} nicknamesMax={limits.nicknames_max} onSaved={load}
                          trigger={<button data-testid={`edit-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDialog onConfirm={async () => { await api.delete(`/parents/${p.id}`); toast.success("Parent removed."); load(); }}
                          trigger={<button data-testid={`delete-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-ayana-secondary">
                      <p className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5" /> {p.phone}</p>
                      <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {p.timezone}</p>
                      {p.preferred_name && (
                        <p className="text-xs text-ayana-muted italic">Called &ldquo;{p.preferred_name}&rdquo; in messages{p.city ? ` · ${p.city}` : ""}</p>
                      )}
                      {(p.nicknames || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.nicknames.map((n, i) => (
                            <span key={i} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-ayana-gold/10 text-ayana-gold border border-ayana-gold/20">{n}</span>
                          ))}
                        </div>
                      )}
                      {(p.medicine_list || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(p.medicine_list || []).map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ayana-alt border border-ayana-line text-ayana-secondary">
                              💊 {m.name}{m.dose ? ` ${m.dose}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedules" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-medium text-ayana-text">Daily schedules</h2>
              {parents.length > 0 && (
                <ScheduleDialog parents={parents} categories={categories} limits={limits} planId={planId} onSaved={load}
                  trigger={<button data-testid="add-schedule" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover transition-colors"><Plus className="w-4 h-4" /> New schedule</button>} />
              )}
            </div>
            {schedules.length === 0 ? <EmptyState text="No schedules yet. Add a parent, then create a daily rhythm." /> : (
              <div className="space-y-4" data-testid="schedules-list">
                {schedules.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{parentName(s.parent_id)}</p>
                        <span className={`inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-0.5 rounded-full capitalize ${s.mode === "raksha" ? "bg-ayana-accent/10 text-ayana-accent" : s.mode === "bandham" ? "bg-ayana-gold/15 text-ayana-gold" : "bg-ayana-primary/10 text-ayana-primary"}`}>
                          {plans.find((p) => p.id === s.mode)?.name?.replace("AYANA ", "") || s.mode} · {s.messages.length} messages
                          {s.recovery_mode && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/60">🩹 recovery</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Power className="w-4 h-4 text-ayana-muted" />
                          <Switch checked={s.active} data-testid={`toggle-schedule-${s.id}`}
                            onCheckedChange={async (v) => { await api.put(`/schedules/${s.id}`, { parent_id: s.parent_id, mode: s.mode, messages: s.messages, active: v, reengagement_hours: s.reengagement_hours ?? 4, recovery_mode: s.recovery_mode ?? false, recovery_until: s.recovery_until ?? null }); load(); }} />
                        </div>
                        <ScheduleDialog parents={parents} categories={categories} limits={limits} planId={planId} schedule={s} onSaved={load}
                          trigger={<button data-testid={`edit-schedule-${s.id}`} className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDialog onConfirm={async () => { await api.delete(`/schedules/${s.id}`); toast.success("Schedule deleted."); load(); }}
                          trigger={<button data-testid={`delete-schedule-${s.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.messages.map((m, i) => {
                        const Icon = CATEGORY_ICONS[catByKey[m.category]?.icon] || MessageCircle;
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-ayana-alt rounded-lg px-2.5 py-1.5 text-ayana-secondary">
                            <Icon className="w-3.5 h-3.5 text-ayana-primary" /> {m.time} · {catByKey[m.category]?.label || m.category}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <h2 className="font-display text-xl font-medium text-ayana-text mb-4">Recent deliveries</h2>
            {logs.length === 0 ? <div data-testid="activity-empty"><EmptyState text="No messages delivered yet. Check-ins appear here once they're sent." /></div> : (
              <>
                <div className="bg-white rounded-xl border border-ayana-line divide-y divide-ayana-line" data-testid="activity-list">
                  {logs.slice(activitySkip, activitySkip + 20).map((l) => (
                    <div key={l.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-ayana-text whitespace-pre-line">{l.body}</p>
                        <p className="text-xs text-ayana-muted mt-1">{catByKey[l.category]?.label || l.category} · {new Date(l.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${l.status === "sent" ? "bg-ayana-whatsapp/15 text-ayana-whatsapp" : l.status === "simulated" ? "bg-ayana-primary/10 text-ayana-primary" : "bg-red-100 text-red-600"}`}>{l.status}</span>
                    </div>
                  ))}
                </div>
                <PaginationBar skip={activitySkip} limit={20} total={logs.length} onSkip={setActivitySkip} />
              </>
            )}
          </TabsContent>

          <TabsContent value="replies" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-medium text-ayana-text">Replies from your parents</h2>
              {parents.length > 0 && (
                <SimulateReplyDialog parents={parents} onDone={load}
                  trigger={<button data-testid="simulate-reply" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ayana-line text-ayana-text text-sm font-medium hover:bg-ayana-alt transition-colors"><MessageCircle className="w-4 h-4" /> Simulate a reply</button>} />
              )}
            </div>
            {replies.length === 0 ? <div data-testid="replies-empty"><EmptyState text="No replies yet. When your parent taps an option or sends a voice note, it appears here — and you get a WhatsApp ping." /></div> : (
              <div className="space-y-3" data-testid="replies-list">
                {replies.map((r) => {
                  // intent is the new structured field (e.g. "feeling:good", "done:medicine")
                  // fall back to legacy r.feeling for old records
                  const intent     = r.intent || (r.feeling ? `feeling:${r.feeling}` : null);
                  const [intentType, intentVal] = (intent || ":").split(":");
                  const isEmergency = r.emergency_keywords?.length > 0;
                  const isVoice    = r.is_voice;
                  const isButton   = !!r.button_payload;
                  // ml_flagged: Sarvam distress-classifier layer (voice transcripts only) —
                  // catches "I'm fine" said while actually struggling. Softer signal than a
                  // keyword-matched emergency, shown as a gentle "worth checking in" nudge.
                  const isMlFlagged = !!r.ml_flagged && !isEmergency;

                  // Pick emoji based on intent value
                  const feelingEmoji = { good: "😊", okay: "🙂", not_well: "😟" };
                  const doneEmoji    = { medicine: "💊", breakfast: "🍵", lunch: "🍽️", dinner: "🌙", water: "💧", bp: "🩸", sugar: "🩸" };
                  const mainEmoji =
                    isEmergency ? "🚨" :
                    isMlFlagged ? "💛" :
                    isVoice     ? "🎤" :
                    intentType === "feeling" ? (feelingEmoji[intentVal] || FEELING_EMOJI[intentVal] || "💬") :
                    intentType === "done"    ? (doneEmoji[intentVal] || "✅") :
                    intentType === "pending" ? "⏳" :
                    intentType === "skip"    ? "⏭️" :
                    intentType === "reengagement" ? (intentVal === "help" ? "🙏" : "😊") :
                    FEELING_EMOJI[r.feeling] || "💬";

                  // Human-readable intent label
                  const intentLabel =
                    intentType === "feeling" ? `Feeling ${intentVal?.replace("_", " ")}` :
                    intentType === "done"    ? `Done — ${intentVal?.replace("_", " ")}` :
                    intentType === "pending" ? `Not yet — ${intentVal?.replace("_", " ")}` :
                    intentType === "skip"    ? `Skipped — ${intentVal?.replace("_", " ")}` :
                    intentType === "emergency" ? "Emergency flagged" :
                    intentType === "reengagement" ? (intentVal === "help" ? "Needs help" : "Replied OK") :
                    intent || "replied";

                  const displayBody = r.transcription || r.body;

                  return (
                    <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${isEmergency ? "border-red-300 bg-red-50/40" : isMlFlagged ? "border-amber-300 bg-amber-50/40" : "border-ayana-line"}`}>
                      <span className="w-10 h-10 rounded-full bg-ayana-alt flex items-center justify-center text-lg shrink-0">
                        {mainEmoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-ayana-text font-medium">{r.parent_name}</p>
                          {/* Intent badge */}
                          {intent && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isEmergency ? "bg-red-100 text-red-700" :
                              intentType === "feeling" && intentVal === "good" ? "bg-green-100 text-green-700" :
                              intentType === "feeling" && intentVal === "not_well" ? "bg-orange-100 text-orange-700" :
                              intentType === "done" ? "bg-ayana-whatsapp/15 text-ayana-whatsapp" :
                              intentType === "skip" ? "bg-ayana-muted/20 text-ayana-muted" :
                              "bg-ayana-primary/10 text-ayana-primary"
                            }`}>
                              {intentLabel}
                            </span>
                          )}
                          {/* Source badge */}
                          {isVoice && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🎤 voice</span>}
                          {isButton && !isVoice && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">tapped</span>}
                          {isMlFlagged && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium" title="Sarvam AI noticed something in the tone of their voice note, even though the words sounded fine.">💛 Worth checking in</span>}
                        </div>
                        {/* Body or transcription */}
                        {displayBody && displayBody !== intent && (
                          <p className="text-sm text-ayana-secondary mt-1 truncate">&#8220;{displayBody}&#8221;</p>
                        )}
                        {/* Transcription note */}
                        {r.transcription && (
                          <p className="text-xs text-purple-500 mt-0.5">🎤 Transcribed by Sarvam AI</p>
                        )}
                        <p className="text-xs text-ayana-muted mt-1">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            {parents.length === 0 ? <EmptyState text="Add a parent to start seeing monthly reports." /> : (
              <ReportsTab parents={parents} plan={plan} />
            )}
          </TabsContent>

          <TabsContent value="circle" className="mt-6">
            <CircleTab circle={circle} planId={planId} reload={load} />
          </TabsContent>

          <TabsContent value="account" className="mt-6 max-w-xl">
            <div className="bg-white rounded-xl border border-ayana-line p-6">
              <h2 className="font-display text-lg font-medium text-ayana-text mb-4">Account</h2>
              <div className="space-y-2 text-sm text-ayana-secondary">
                <p><span className="text-ayana-muted">Name:</span> {user?.name}</p>
                <p><span className="text-ayana-muted">Email:</span> {user?.email}</p>
                <p><span className="text-ayana-muted">Phone:</span> {user?.phone}</p>
                <p><span className="text-ayana-muted">Plan:</span> {plan?.name} · <span className="capitalize">{payment?.state?.status || "trial"}</span></p>
                <p className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-ayana-primary" /> Consent on file · Privacy-first</p>
              </div>
            </div>
            <div className="mt-6 bg-white rounded-xl border border-red-200 p-6">
              <h3 className="font-display text-lg font-medium text-ayana-text flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Delete account</h3>
              <p className="mt-2 text-sm text-ayana-secondary">This permanently removes your account, parents, schedules, and stops all messages.</p>
              <ConfirmDialog title="Delete your account?" description="This cannot be undone. All your data and your parents' schedules will be removed." confirmLabel="Delete everything"
                onConfirm={async () => { await api.delete("/account"); toast.success("Account deleted."); logout(); navigate("/"); }}
                trigger={<button data-testid="delete-account" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Delete my account</button>} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}



function ParentDialog({ parent, relationships, languages, nicknamesMax = 3, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(parent || {
    name: "", relationship: relationships[0] || "Mother", phone: "+91", language: "en", timezone: "Asia/Kolkata", notes: "",
    city: "", other_parent_name: "", nicknames: [],
    habits: { wake_time: "", tea_time: "", tea_type: "tea", walk_time: "", lunch_time: "", dinner_time: "", sleep_time: "" },
    stories: [],
  });
  const [nickInput, setNickInput] = useState("");
  const [storyInput, setStoryInput] = useState("");

  const addNickname = () => {
    const v = nickInput.trim();
    if (!v) return;
    const current = form.nicknames || [];
    if (current.length >= nicknamesMax) { toast.error(`Your plan allows up to ${nicknamesMax} nicknames.`); return; }
    setForm({ ...form, nicknames: [...current, v] });
    setNickInput("");
  };
  const removeNickname = (i) => setForm({ ...form, nicknames: (form.nicknames || []).filter((_, idx) => idx !== i) });
  const addStory = () => {
    const v = storyInput.trim();
    if (!v) return;
    const current = form.stories || [];
    if (current.length >= 5) { toast.error("Up to 5 memory prompts."); return; }
    setForm({ ...form, stories: [...current, v] });
    setStoryInput("");
  };
  const removeStory = (i) => setForm({ ...form, stories: (form.stories || []).filter((_, idx) => idx !== i) });
  const setHabit = (key, val) => setForm({ ...form, habits: { ...(form.habits || {}), [key]: val } });

  const save = async () => {
    setBusy(true);
    try {
      if (parent) await api.put(`/parents/${parent.id}`, form);
      else await api.post("/parents", form);
      toast.success("Saved."); setOpen(false); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg">
        <DialogHeader><DialogTitle className="font-display">{parent ? "Edit parent" : "Add parent"}</DialogTitle><DialogDescription className="sr-only">Enter your parent's details and preferred language.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pd-name" placeholder="Name" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} data-testid="pd-relationship" className={inputCls}>{relationships.map((r) => <option key={r}>{r}</option>)}</select>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} data-testid="pd-language" className={inputCls}>{languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
          </div>
          <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="pd-phone" />
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} data-testid="pd-timezone" className={inputCls}>{TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.preferred_name || ""} onChange={(e) => setForm({ ...form, preferred_name: e.target.value })} data-testid="pd-preferred-name" placeholder="Called (e.g. Amma, Nanna)" className={inputCls} />
            <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="pd-city" placeholder="City (for seasonal greetings)" className={inputCls} />
          </div>
          <input value={form.other_parent_name || ""} onChange={(e) => setForm({ ...form, other_parent_name: e.target.value })} data-testid="pd-other-parent"
            placeholder={`Other parent's name (for "Did ${form.relationship === "father" ? "Amma" : "Nanna"} have lunch?" — optional)`} className={inputCls} />
          <div>
            <label className="text-sm font-medium text-ayana-text">Nicknames <span className="text-xs text-ayana-muted font-normal">({(form.nicknames || []).length}/{nicknamesMax}) — rotate day to day, e.g. "Maa", "Buji"</span></label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(form.nicknames || []).map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-ayana-alt border border-ayana-line text-ayana-secondary">
                  {n}
                  <button type="button" onClick={() => removeNickname(i)} className="text-ayana-muted hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            {(form.nicknames || []).length < nicknamesMax && (
              <div className="mt-2 flex gap-2">
                <input value={nickInput} onChange={(e) => setNickInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNickname(); } }}
                  data-testid="pd-nickname-input" placeholder="e.g. Maa" className={inputCls} />
                <button type="button" onClick={addNickname} data-testid="pd-nickname-add" className="px-4 py-2.5 rounded-lg border border-ayana-line text-sm font-medium text-ayana-primary hover:bg-ayana-alt shrink-0">Add</button>
              </div>
            )}
          </div>

          {/* Daily habits — feed tea/walk check-ins and timing personalization */}
          <div className="rounded-xl border border-ayana-line bg-ayana-alt/40 p-3.5">
            <p className="text-sm font-medium text-ayana-text mb-2">Daily habits <span className="text-xs text-ayana-muted font-normal">(optional)</span></p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["wake_time", "Wakes up"], ["tea_time", "Tea/coffee"], ["walk_time", "Walk"],
                ["lunch_time", "Lunch"], ["dinner_time", "Dinner"], ["sleep_time", "Sleeps"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-ayana-muted">{label}</label>
                  <input type="time" value={form.habits?.[key] || ""} onChange={(e) => setHabit(key, e.target.value)}
                    data-testid={`pd-habit-${key}`} className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50" />
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xs text-ayana-muted">Drinks</span>
              {["tea", "coffee"].map((t) => (
                <button key={t} type="button" onClick={() => setHabit("tea_type", t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${(form.habits?.tea_type || "tea") === t ? "bg-ayana-primary text-white border-ayana-primary" : "bg-white border-ayana-line text-ayana-secondary"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Stories — rotating memory prompts used in mood/love-note messages */}
          <div>
            <label className="text-sm font-medium text-ayana-text">Memory prompts <span className="text-xs text-ayana-muted font-normal">({(form.stories || []).length}/5, optional)</span></label>
            {(form.stories || []).length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {(form.stories || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-ayana-line px-3 py-1.5">
                    <span className="flex-1 text-sm text-ayana-text">{s}</span>
                    <button type="button" onClick={() => removeStory(i)} className="text-ayana-muted hover:text-red-500 transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            {(form.stories || []).length < 5 && (
              <div className="mt-1.5 flex gap-2">
                <input value={storyInput} onChange={(e) => setStoryInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStory(); } }}
                  data-testid="pd-story-input" placeholder="e.g. mango pickle story" className={inputCls} />
                <button type="button" onClick={addStory} data-testid="pd-story-add" className="px-4 py-2.5 rounded-lg border border-ayana-line text-sm font-medium text-ayana-primary hover:bg-ayana-alt shrink-0">Add</button>
              </div>
            )}
          </div>

          <div>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 300) })}
              data-testid="pd-notes"
              placeholder="Any notes about their health or routine (optional)"
              rows={3}
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1 text-xs text-ayana-muted text-right">{(form.notes || "").length}/300</p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={save} disabled={busy || !form.name || form.phone.length < 8} data-testid="pd-save" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimulateReplyDialog({ parents, onDone, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parentId, setParentId] = useState(parents[0]?.id || "");
  const [text, setText] = useState("3");
  const run = async () => {
    setBusy(true);
    try {
      await api.post("/replies/simulate", { parent_id: parentId, text });
      toast.success("Simulated reply — check the list & your WhatsApp ping.");
      setOpen(false); onDone();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg">
        <DialogHeader><DialogTitle className="font-display">Simulate a parent reply</DialogTitle><DialogDescription className="sr-only">Preview how a reply looks and notifies you.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-ayana-secondary">See how replies appear and how you get notified (great for demos).</p>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="sim-parent" className={inputCls}>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <div className="flex flex-wrap gap-2" data-testid="sim-options">
            {[["1", "😊 Good"], ["2", "🙂 Okay"], ["3", "😟 Not well"], ["help pain", "🚨 Emergency"]].map(([v, label]) => (
              <button key={v} onClick={() => setText(v)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${text === v ? "bg-ayana-primary text-white border-ayana-primary" : "bg-white border-ayana-line text-ayana-secondary hover:bg-ayana-alt"}`}>{label}</button>
            ))}
          </div>
          <input value={text} onChange={(e) => setText(e.target.value)} data-testid="sim-text" placeholder="or type a reply" className={inputCls} />
        </div>
        <DialogFooter>
          <button onClick={run} disabled={busy || !parentId} data-testid="sim-send" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Simulate</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendTestDialog({ parent, categories, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("how_feeling");
  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/messages/send-test", { parent_id: parent.id, category });
      if (data.status === "sent") toast.success(`Sent to ${parent.name} on WhatsApp ✓`);
      else if (data.status === "simulated") toast.success("Simulated (test mode) — enable WhatsApp to send for real.");
      else toast.error(`Could not send: ${data.detail || "failed"}`);
      setOpen(false);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg">
        <DialogHeader><DialogTitle className="font-display">Send a check-in to {parent.name} now</DialogTitle><DialogDescription className="sr-only">Pick a message and send it immediately on WhatsApp.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-ayana-secondary">Pick a message — it'll be sent live in {parent.name}'s language.</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="send-test-category" className={inputCls}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <DialogFooter>
          <button onClick={send} disabled={busy} data-testid="send-test-confirm" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-whatsapp text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send now</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CircleTab({ circle, planId, reload }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState("");

  if (circle?.role === "member") {
    return (
      <div className="max-w-xl bg-white rounded-xl border border-ayana-line p-6">
        <h2 className="font-display text-lg font-medium text-ayana-text mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-ayana-primary" /> Shared care circle</h2>
        <p className="text-sm text-ayana-secondary">You're co-caring in <b>{circle.owner?.name}</b>'s circle ({circle.owner?.email}). You can view and edit the shared parents and schedules.</p>
      </div>
    );
  }

  const isRaksha = planId === "raksha";
  const invite = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/circle/invite", { email });
      setLastLink(data.invite_link || "");
      toast.success(`Invite created for ${data.email}`);
      setEmail(""); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-ayana-line p-6">
        <h2 className="font-display text-lg font-medium text-ayana-text flex items-center gap-2"><Users className="w-4 h-4 text-ayana-primary" /> Family co-care {isRaksha && <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-accent/10 text-ayana-accent inline-flex items-center gap-1"><Crown className="w-3 h-3" /> Raksha</span>}</h2>
        <p className="mt-1 text-sm text-ayana-secondary">Invite siblings to help care for the same parents. They'll share your parents, schedules and replies (but can't change billing).</p>

        {!isRaksha ? (
          <div className="mt-4 rounded-xl bg-ayana-alt p-4 flex items-start gap-3">
            <Crown className="w-5 h-5 text-ayana-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ayana-text">Family co-care is a Raksha feature</p>
              <p className="text-sm text-ayana-secondary">Upgrade to Raksha to invite up to 2 family members and share monthly reports.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col sm:flex-row gap-2" data-testid="invite-form">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-ayana-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" placeholder="sibling@email.com" type="email"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50" />
              </div>
              <button onClick={invite} disabled={busy || !email} data-testid="invite-send" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite</button>
            </div>
            {lastLink && <p className="mt-2 text-xs text-ayana-muted break-all">Invite link (email sending coming soon): <span className="text-ayana-primary">{lastLink}</span></p>}
            <p className="mt-2 text-xs text-ayana-muted">{(circle.members?.length || 0) + (circle.invites?.length || 0)} / {circle.max_members} members used</p>
          </>
        )}
      </div>

      {(circle.members?.length > 0 || circle.invites?.length > 0) && (
        <div className="bg-white rounded-xl border border-ayana-line divide-y divide-ayana-line" data-testid="members-list">
          {circle.members?.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between">
              <div><p className="text-sm font-medium text-ayana-text">{m.name}</p><p className="text-xs text-ayana-muted">{m.email} · member</p></div>
              <button onClick={async () => { await api.delete(`/circle/member/${m.id}`); toast.success("Removed."); reload(); }} data-testid={`remove-member-${m.id}`} className="text-ayana-muted hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {circle.invites?.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-ayana-text">{i.email}</p><p className="text-xs text-ayana-accent">pending invite</p></div>
              <button onClick={async () => { await api.delete(`/circle/invite/${i.id}`); toast.success("Invite cancelled."); reload(); }} data-testid={`cancel-invite-${i.id}`} className="text-ayana-muted hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function monthOptions() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    out.push({ period, label });
  }
  return out;
}

const FEELING_FROM_SCORE = (s) => (s == null ? "—" : s >= 0.85 ? "😊 Good" : s >= 0.35 ? "😐 Okay" : "😟 Not well");

function ReportsTab({ parents, plan }) {
  const months = useMemo(() => monthOptions(), []);
  const [parentId, setParentId] = useState(parents[0]?.id || "");
  const [period, setPeriod] = useState(months[0]?.period || "");
  const [busy, setBusy] = useState(false);
  const hasMoodGraph = (plan?.limits?.variants_per_slot || 3) >= 7;

  const reportQuery = useQuery({
    queryKey: ["dashboard", "report", parentId, period],
    queryFn: () => api.get(`/reports/monthly`, { params: { parent_id: parentId, period } }).then((r) => r.data),
    enabled: !!parentId && !!period,
    retry: false,
  });

  const generate = async () => {
    setBusy(true);
    try {
      await api.post(`/reports/monthly/generate`, null, { params: { parent_id: parentId, period } });
      toast.success("Report generated.");
      reportQuery.refetch();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  const report = reportQuery.data;
  const notFound = reportQuery.isError && reportQuery.error?.response?.status === 404;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="font-display text-xl font-medium text-ayana-text flex items-center gap-2"><BarChart3 className="w-5 h-5 text-ayana-primary" /> Monthly reports</h2>
        <div className="flex gap-2">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="report-parent" className="px-3 py-2 rounded-full border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50">
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} data-testid="report-period" className="px-3 py-2 rounded-full border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50">
            {months.map((m) => <option key={m.period} value={m.period}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ayana-primary" /></div>
      ) : notFound || !report ? (
        <div className="bg-white rounded-xl border border-dashed border-ayana-line p-10 text-center">
          <p className="text-ayana-secondary">No report generated for this month yet.</p>
          <button onClick={generate} disabled={busy} data-testid="report-generate"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50 mx-auto">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate report
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Total touches", report.total_touches],
              ["Delivered", report.delivered],
              ["Skipped", report.skipped],
              ["Voice replies", report.voice_replies],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-xl border border-ayana-line p-4 text-center">
                <p className="font-display text-2xl font-semibold text-ayana-primary">{value ?? 0}</p>
                <p className="text-xs text-ayana-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {report.shared_with_care_circle && (
            <p className="text-xs text-ayana-accent flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> This report is shared with your Care Circle.</p>
          )}

          {hasMoodGraph ? (
            <div className="bg-white rounded-xl border border-ayana-line p-5">
              <h3 className="font-display font-medium text-ayana-text flex items-center gap-2"><TrendingUp className="w-4 h-4 text-ayana-primary" /> Mood over the month</h3>
              {(report.mood_graph || []).length === 0 ? (
                <p className="mt-3 text-sm text-ayana-muted">Not enough check-ins yet this month for a mood graph.</p>
              ) : (
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.mood_graph}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD4" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} />
                      <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => (v === 1 ? "😊" : v === 0.5 ? "😐" : "😟")} width={30} />
                      <Tooltip formatter={(v) => FEELING_FROM_SCORE(v)} labelFormatter={(d) => d} />
                      <Line type="monotone" dataKey="score" stroke="#E8590C" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {report.trend_note && <p className="mt-3 text-sm text-ayana-secondary bg-ayana-alt rounded-lg px-3 py-2">{report.trend_note}</p>}
            </div>
          ) : (
            <div className="bg-ayana-alt rounded-xl border border-ayana-line p-4 text-sm text-ayana-secondary">
              Mood graphs are available on Bandham and Raksha plans — upgrade to see mood trends over time.
            </div>
          )}

          <button onClick={generate} disabled={busy} data-testid="report-regenerate"
            className="inline-flex items-center gap-2 text-sm font-medium text-ayana-primary hover:text-ayana-primary-hover disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduleDialog({ parents, categories, limits, planId, schedule, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parentId, setParentId] = useState(schedule?.parent_id || parents[0]?.id || "");
  const [messages, setMessages] = useState(schedule?.messages || [{ time: "08:00", category: "morning_wish", type: "checkin" }]);
  const [reengagementHours, setReengagementHours] = useState(schedule?.reengagement_hours ?? 4);
  const [recoveryMode, setRecoveryMode] = useState(schedule?.recovery_mode ?? false);
  const [recoveryUntil, setRecoveryUntil] = useState(schedule?.recovery_until || "");

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        parent_id: parentId, mode: planId, messages, active: schedule?.active ?? true,
        reengagement_hours: reengagementHours,
        recovery_mode: limits.recovery_mode ? recoveryMode : false,
        recovery_until: limits.recovery_mode && recoveryMode ? (recoveryUntil || null) : null,
      };
      if (schedule) await api.put(`/schedules/${schedule.id}`, payload);
      else await api.post("/schedules", payload);
      toast.success("Schedule saved."); setOpen(false); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{schedule ? "Edit schedule" : "New schedule"}</DialogTitle><DialogDescription className="sr-only">Set daily check-in and reminder times for your parent.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ayana-text">Parent</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="sd-parent" className={`mt-1.5 ${inputCls}`}>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <ScheduleEditor
            messages={messages} setMessages={setMessages} categories={categories} limits={limits}
            reengagementHours={reengagementHours} setReengagementHours={setReengagementHours}
            recoveryMode={recoveryMode} setRecoveryMode={setRecoveryMode}
            recoveryUntil={recoveryUntil} setRecoveryUntil={setRecoveryUntil}
          />
        </div>
        <DialogFooter>
          <button onClick={save} disabled={busy || !parentId} data-testid="sd-save" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}