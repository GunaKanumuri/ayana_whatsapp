import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, CheckCircle2, MessageCircle, AlertTriangle, CalendarHeart,
  Loader2, Activity, ArrowLeft, TrendingUp, Zap, Heart, Mic,
  ShieldAlert, BarChart2, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/ui/PaginationBar";

// ─── Constants ───────────────────────────────────────────────────────────────
const USERS_PER_PAGE = 50;
const MSGS_PER_PAGE  = 100;

const CHART_COLORS = {
  primary:   "#0A5940",
  accent:    "#E8590C",
  gold:      "#D4960A",
  whatsapp:  "#25D366",
  muted:     "#8A948F",
  danger:    "#ef4444",
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.gold, CHART_COLORS.whatsapp, CHART_COLORS.muted];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "primary", trend }) {
  const colorMap = {
    primary:  "text-ayana-primary bg-ayana-primary/8",
    accent:   "text-ayana-accent bg-ayana-accent/10",
    gold:     "text-ayana-gold bg-ayana-gold/15",
    whatsapp: "text-ayana-whatsapp bg-ayana-whatsapp/10",
    danger:   "text-red-500 bg-red-50",
  };
  return (
    <div className="bg-white rounded-2xl border border-ayana-line p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-display text-2xl font-semibold text-ayana-text">{value ?? "—"}</p>
        <p className="text-sm text-ayana-muted mt-0.5">{label}</p>
        {sub && <p className="text-xs text-ayana-secondary mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="font-display text-lg font-semibold text-ayana-text mb-4">{children}</h2>;
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-ayana-line p-6 ${className}`}>
      {title && <p className="text-sm font-semibold text-ayana-text mb-5">{title}</p>}
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-ayana-line rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-ayana-text mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function Admin() {
  const [usersSkip, setUsersSkip] = useState(0);
  const [messagesSkip, setMessagesSkip] = useState(0);

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
    staleTime: 60_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.get("/admin/analytics").then((r) => r.data),
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", usersSkip],
    queryFn: () => api.get(`/admin/users?skip=${usersSkip}&limit=${USERS_PER_PAGE}`).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["admin-messages", messagesSkip],
    queryFn: () => api.get(`/admin/messages?skip=${messagesSkip}&limit=${MSGS_PER_PAGE}`).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const emergenciesQuery = useQuery({
    queryKey: ["admin-emergencies"],
    queryFn: () => api.get("/admin/emergencies").then((r) => r.data),
    staleTime: 60_000,
  });

  const isLoading = statsQuery.isLoading || analyticsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ayana-bg">
        <Navbar />
        <div className="flex justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-ayana-primary" />
        </div>
      </div>
    );
  }

  const stats    = statsQuery.data || {};
  const analytics = analyticsQuery.data || {};
  const users    = usersQuery.data?.items ?? [];
  const usersTotal = usersQuery.data?.total ?? 0;
  const messages = messagesQuery.data?.items ?? [];
  const messagesTotal = messagesQuery.data?.total ?? 0;
  const emergencies = emergenciesQuery.data?.items ?? [];

  // Build combined chart data for user + message volume
  const allDates = new Set([
    ...(analytics.user_growth || []).map((d) => d.date),
    ...(analytics.msg_volume  || []).map((d) => d.date),
  ]);
  const combinedTimeline = Array.from(allDates).sort().map((date) => ({
    date: date.slice(5), // MM-DD
    Users:    (analytics.user_growth || []).find((d) => d.date === date)?.users    || 0,
    Messages: (analytics.msg_volume  || []).find((d) => d.date === date)?.messages || 0,
  }));

  const deliveryRate = stats.messages_delivered > 0
    ? Math.round((analytics.sent_count || 0) / stats.messages_delivered * 100)
    : 0;

  return (
    <div className="min-h-screen bg-ayana-bg">
      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-2 text-sm text-ayana-secondary border-b border-ayana-line">
        <Link to="/dashboard" className="hover:text-ayana-text transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-ayana-line mx-1">&middot;</span>
        <span className="text-ayana-text font-medium">Admin Analytics</span>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-ayana-text">Analytics Dashboard</h1>
            <p className="mt-1 text-ayana-secondary text-sm">Platform health, growth, and engagement at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              stats.whatsapp_enabled
                ? "bg-ayana-whatsapp/15 text-ayana-whatsapp"
                : "bg-ayana-accent/10 text-ayana-accent"
            }`}>
              WhatsApp: {stats.whatsapp_enabled ? "🟢 Live" : "🟡 Test mode"}
            </span>
            <button
              onClick={() => { statsQuery.refetch(); analyticsQuery.refetch(); }}
              className="p-2 rounded-lg border border-ayana-line hover:bg-ayana-alt transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4 text-ayana-muted" />
            </button>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10" data-testid="admin-stats">
          <StatCard icon={Users}         label="Total users"          value={stats.total_users}          color="primary" />
          <StatCard icon={CheckCircle2}  label="Setup complete"       value={stats.completed_onboarding} color="primary" />
          <StatCard icon={Activity}      label="WA activated"         value={stats.activated}            color="whatsapp" />
          <StatCard icon={MessageCircle} label="Messages sent"        value={stats.messages_delivered}   color="primary" sub={`${deliveryRate}% delivered live`} />
          <StatCard icon={CalendarHeart} label="Active schedules"     value={stats.active_schedules}     color="gold" />
          <StatCard icon={AlertTriangle} label="Open emergencies"     value={stats.open_emergencies}     color={stats.open_emergencies > 0 ? "danger" : "primary"} />
        </div>

        {/* ── Engagement row ─────────────────────────────────── */}
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          <StatCard icon={TrendingUp}  label="Reply rate"        value={`${analytics.reply_rate ?? 0}%`}    color="accent"   sub="of messages get a reply" />
          <StatCard icon={Mic}         label="Voice replies"      value={analytics.voice_replies ?? 0}        color="gold"    sub="parents sent voice notes" />
          <StatCard icon={ShieldAlert} label="Emergency alerts"   value={analytics.emergency_count ?? 0}     color="danger"  sub="flagged keywords detected" />
          <StatCard icon={Zap}         label="Active this week"   value={analytics.active_7d ?? 0}           color="whatsapp" sub="users sent msgs in 7 days" />
        </div>

        {/* ── Charts row 1: Timeline ─────────────────────────── */}
        <div className="mb-6">
          <SectionTitle>Growth &amp; Volume (Last 30 days)</SectionTitle>
          <ChartCard>
            {combinedTimeline.length === 0 ? (
              <p className="text-sm text-ayana-muted text-center py-12">No data in the last 30 days yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={combinedTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A948F" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8A948F" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Area type="monotone" dataKey="Users"    stroke={CHART_COLORS.primary} fill="url(#gradUsers)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Messages" stroke={CHART_COLORS.accent}  fill="url(#gradMsgs)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Charts row 2: Donut + Bar + Funnel ────────────── */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">

          {/* Delivery status donut */}
          <ChartCard title="Message Delivery Status">
            {(analytics.msg_status || []).length === 0 ? (
              <p className="text-sm text-ayana-muted text-center py-8">No messages yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={analytics.msg_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={3}
                  >
                    {(analytics.msg_status || []).map((entry, i) => (
                      <Cell
                        key={entry.status}
                        fill={
                          entry.status === "sent"      ? CHART_COLORS.whatsapp :
                          entry.status === "simulated" ? CHART_COLORS.primary  :
                                                         CHART_COLORS.danger
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Language distribution bar */}
          <ChartCard title="Parent Languages">
            {(analytics.lang_dist || []).length === 0 ? (
              <p className="text-sm text-ayana-muted text-center py-8">No parents yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.lang_dist} margin={{ top: 5, right: 5, left: -30, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD4" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#8A948F" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="language" tick={{ fontSize: 11, fill: "#8A948F" }} width={30} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Conversion funnel */}
          <ChartCard title="Conversion Funnel">
            <div className="space-y-3 py-2">
              {(analytics.funnel || []).map((f, i) => {
                const base = analytics.funnel?.[0]?.count || 1;
                const pct  = Math.round(f.count / base * 100);
                const colors = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.whatsapp];
                return (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-ayana-secondary">{f.stage}</span>
                      <span className="font-semibold text-ayana-text">{f.count} <span className="text-ayana-muted font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2.5 bg-ayana-alt rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>

        {/* ── Tables ─────────────────────────────────────────── */}
        <Tabs defaultValue="users">
          <TabsList className="bg-ayana-alt">
            <TabsTrigger value="users"       data-testid="admin-tab-users">Users ({usersTotal})</TabsTrigger>
            <TabsTrigger value="messages"    data-testid="admin-tab-messages">Deliveries ({messagesTotal})</TabsTrigger>
            <TabsTrigger value="emergencies" data-testid="admin-tab-emergencies">
              Emergencies
              {stats.open_emergencies > 0 && (
                <span className="ml-1.5 text-xs px-1.5 rounded-full bg-red-500 text-white">{stats.open_emergencies}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Users */}
          <TabsContent value="users" className="mt-6">
            <div className="bg-white rounded-2xl border border-ayana-line overflow-x-auto" data-testid="admin-users-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ayana-alt/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Parents</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-ayana-alt/30 transition-colors">
                      <TableCell className="font-medium text-ayana-text">{u.name}</TableCell>
                      <TableCell className="text-ayana-secondary text-sm">{u.email}</TableCell>
                      <TableCell className="text-ayana-secondary text-sm">{u.phone}</TableCell>
                      <TableCell>
                        {u.onboarding_complete
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-primary/10 text-ayana-primary font-medium">Complete</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-alt text-ayana-muted">Step {u.onboarding_step}</span>}
                      </TableCell>
                      <TableCell>
                        {u.activated
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-whatsapp/15 text-ayana-whatsapp font-medium">Active</span>
                          : <span className="text-xs text-ayana-muted">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-ayana-secondary">{u.parents_count}</TableCell>
                      <TableCell className="text-xs text-ayana-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-ayana-muted py-10">No users yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationBar skip={usersSkip} limit={USERS_PER_PAGE} total={usersTotal} onSkip={setUsersSkip} />
            </div>
          </TabsContent>

          {/* Deliveries */}
          <TabsContent value="messages" className="mt-6">
            <div className="bg-white rounded-2xl border border-ayana-line overflow-x-auto" data-testid="admin-messages-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ayana-alt/50">
                    <TableHead>Message</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((m) => (
                    <TableRow key={m.id} className="hover:bg-ayana-alt/30 transition-colors">
                      <TableCell className="max-w-md">
                        <p className="text-sm text-ayana-text line-clamp-2">{m.body}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-ayana-alt text-ayana-secondary">{m.category}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          m.status === "sent"      ? "bg-ayana-whatsapp/15 text-ayana-whatsapp" :
                          m.status === "simulated" ? "bg-ayana-primary/10 text-ayana-primary"  :
                                                     "bg-red-100 text-red-600"
                        }`}>{m.status}</span>
                      </TableCell>
                      <TableCell className="text-xs text-ayana-muted whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {messages.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-ayana-muted py-10">No deliveries yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationBar skip={messagesSkip} limit={MSGS_PER_PAGE} total={messagesTotal} onSkip={setMessagesSkip} />
            </div>
          </TabsContent>

          {/* Emergencies */}
          <TabsContent value="emergencies" className="mt-6">
            <div className="bg-white rounded-2xl border border-ayana-line overflow-x-auto" data-testid="admin-emergencies-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ayana-alt/50">
                    <TableHead>Phone</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emergencies.map((e) => (
                    <TableRow key={e.id} className="hover:bg-red-50/30 transition-colors">
                      <TableCell className="text-sm font-medium text-ayana-text">{e.phone}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-ayana-secondary line-clamp-2">{e.body}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(e.keywords || []).map((k) => (
                            <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{k}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          e.status === "open" ? "bg-red-100 text-red-600" : "bg-ayana-alt text-ayana-muted"
                        }`}>{e.status}</span>
                      </TableCell>
                      <TableCell className="text-xs text-ayana-muted whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {emergencies.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-ayana-muted py-10">No emergency events. 🎉</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}