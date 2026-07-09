import { useCallback, useEffect, useState } from "react";
import {
  Users, CheckCircle2, MessageCircle, AlertTriangle, CalendarHeart,
  Loader2, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Pagination constants ───────────────────────────────────────────────────
const USERS_PER_PAGE = 50;
const MSGS_PER_PAGE  = 100;

// ─── Reusable pagination bar ────────────────────────────────────────────────
function PaginationBar({ skip, limit, total, onSkip }) {
  const page   = Math.floor(skip / limit) + 1;
  const pages  = Math.max(1, Math.ceil(total / limit));
  const canPrev = skip > 0;
  const canNext = skip + limit < total;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-ayana-line text-sm text-ayana-secondary">
      <span>
        {Math.min(skip + 1, total)}–{Math.min(skip + limit, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={!canPrev}
          onClick={() => onSkip(Math.max(0, skip - limit))}
          className="p-1.5 rounded-lg border border-ayana-line disabled:opacity-30 hover:bg-ayana-alt transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[56px] text-center">
          {page} / {pages}
        </span>
        <button
          disabled={!canNext}
          onClick={() => onSkip(skip + limit)}
          className="p-1.5 rounded-lg border border-ayana-line disabled:opacity-30 hover:bg-ayana-alt transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function Admin() {
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [emergencies, setEmergencies] = useState([]);

  // Paginated: users
  const [users,      setUsers]      = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSkip,  setUsersSkip]  = useState(0);

  // Paginated: messages
  const [messages,      setMessages]      = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesSkip,  setMessagesSkip]  = useState(0);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get("/admin/stats"),
      api.get(`/admin/users?skip=0&limit=${USERS_PER_PAGE}`),
      api.get(`/admin/messages?skip=0&limit=${MSGS_PER_PAGE}`),
      api.get("/admin/emergencies"),
    ]).then(([s, u, m, e]) => {
      setStats(s.data);
      // users & messages now return {total, skip, limit, items}
      setUsers(u.data.items ?? u.data);
      setUsersTotal(u.data.total ?? (u.data.items ?? u.data).length);
      setMessages(m.data.items ?? m.data);
      setMessagesTotal(m.data.total ?? (m.data.items ?? m.data).length);
      setEmergencies(e.data);
    }).finally(() => setLoading(false));
  }, []);

  // ── Paginated fetch: users ───────────────────────────────────────────────
  const fetchUsers = useCallback(async (skip) => {
    const { data } = await api.get(`/admin/users?skip=${skip}&limit=${USERS_PER_PAGE}`);
    setUsers(data.items ?? data);
    setUsersTotal(data.total ?? (data.items ?? data).length);
    setUsersSkip(skip);
  }, []);

  // ── Paginated fetch: messages ────────────────────────────────────────────
  const fetchMessages = useCallback(async (skip) => {
    const { data } = await api.get(`/admin/messages?skip=${skip}&limit=${MSGS_PER_PAGE}`);
    setMessages(data.items ?? data);
    setMessagesTotal(data.total ?? (data.items ?? data).length);
    setMessagesSkip(skip);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-ayana-bg">
        <Navbar />
        <div className="flex justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-ayana-primary" />
        </div>
      </div>
    );
  }

  const cards = [
    { icon: Users,         label: "Total users",          value: stats.total_users          },
    { icon: CheckCircle2,  label: "Completed onboarding", value: stats.completed_onboarding },
    { icon: Activity,      label: "Activated circles",    value: stats.activated            },
    { icon: CalendarHeart, label: "Active schedules",     value: stats.active_schedules     },
    { icon: MessageCircle, label: "Messages delivered",   value: stats.messages_delivered   },
    { icon: AlertTriangle, label: "Open emergencies",     value: stats.open_emergencies     },
  ];

  return (
    <div className="min-h-screen bg-ayana-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ayana-text">Admin dashboard</h1>
            <p className="mt-1 text-ayana-secondary">Onboarding, activation and delivery insights.</p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full ${
            stats.whatsapp_enabled
              ? "bg-ayana-whatsapp/15 text-ayana-whatsapp"
              : "bg-ayana-accent/10 text-ayana-accent"
          }`}>
            WhatsApp: {stats.whatsapp_enabled ? "Live" : "Test mode"}
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10" data-testid="admin-stats">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-ayana-line p-5">
              <c.icon className="w-5 h-5 text-ayana-primary mb-3" strokeWidth={1.5} />
              <p className="font-display text-2xl font-semibold text-ayana-text">{c.value}</p>
              <p className="text-sm text-ayana-muted">{c.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="bg-ayana-alt">
            <TabsTrigger value="users"       data-testid="admin-tab-users">Users</TabsTrigger>
            <TabsTrigger value="messages"    data-testid="admin-tab-messages">Deliveries</TabsTrigger>
            <TabsTrigger value="emergencies" data-testid="admin-tab-emergencies">Emergencies</TabsTrigger>
          </TabsList>

          {/* ── Users tab ── */}
          <TabsContent value="users" className="mt-6">
            <div className="bg-white rounded-xl border border-ayana-line overflow-x-auto" data-testid="admin-users-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead>Parents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.phone}</TableCell>
                      <TableCell>
                        {u.onboarding_complete
                          ? <span className="text-ayana-primary">Complete</span>
                          : <span className="text-ayana-muted">Step {u.onboarding_step}</span>}
                      </TableCell>
                      <TableCell>
                        {u.activated ? <span className="text-ayana-whatsapp">Yes</span> : "No"}
                      </TableCell>
                      <TableCell>{u.parents_count}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-ayana-muted py-8">
                        No users yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {usersTotal > USERS_PER_PAGE && (
                <PaginationBar
                  skip={usersSkip}
                  limit={USERS_PER_PAGE}
                  total={usersTotal}
                  onSkip={fetchUsers}
                />
              )}
            </div>
          </TabsContent>

          {/* ── Messages tab ── */}
          <TabsContent value="messages" className="mt-6">
            <div className="bg-white rounded-xl border border-ayana-line overflow-x-auto" data-testid="admin-messages-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="max-w-md truncate">{m.body}</TableCell>
                      <TableCell>{m.category}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          m.status === "sent"
                            ? "bg-ayana-whatsapp/15 text-ayana-whatsapp"
                            : m.status === "simulated"
                            ? "bg-ayana-primary/10 text-ayana-primary"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {m.status}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(m.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {messages.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-ayana-muted py-8">
                        No deliveries yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {messagesTotal > MSGS_PER_PAGE && (
                <PaginationBar
                  skip={messagesSkip}
                  limit={MSGS_PER_PAGE}
                  total={messagesTotal}
                  onSkip={fetchMessages}
                />
              )}
            </div>
          </TabsContent>

          {/* ── Emergencies tab ── */}
          <TabsContent value="emergencies" className="mt-6">
            <div className="bg-white rounded-xl border border-ayana-line overflow-x-auto" data-testid="admin-emergencies-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emergencies.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.phone}</TableCell>
                      <TableCell className="max-w-xs truncate">{e.body}</TableCell>
                      <TableCell>
                        <span className="text-xs text-ayana-accent">
                          {(e.keywords || []).join(", ")}
                        </span>
                      </TableCell>
                      <TableCell>{e.status}</TableCell>
                      <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {emergencies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-ayana-muted py-8">
                        No emergency events flagged.
                      </TableCell>
                    </TableRow>
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