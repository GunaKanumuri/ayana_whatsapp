import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Users, CheckCircle2, MessageCircle, AlertTriangle, CalendarHeart,
  Loader2, Activity, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
  // Pagination cursors live as plain state; react-query owns the fetching,
  // caching (60s staleTime from index.js), and refetch-on-page-change.
  const [usersSkip, setUsersSkip] = useState(0);
  const [messagesSkip, setMessagesSkip] = useState(0);

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", usersSkip],
    queryFn: () =>
      api.get(`/admin/users?skip=${usersSkip}&limit=${USERS_PER_PAGE}`).then((r) => r.data),
    placeholderData: keepPreviousData, // keep showing old page while the next one loads
  });

  const messagesQuery = useQuery({
    queryKey: ["admin-messages", messagesSkip],
    queryFn: () =>
      api.get(`/admin/messages?skip=${messagesSkip}&limit=${MSGS_PER_PAGE}`).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const emergenciesQuery = useQuery({
    queryKey: ["admin-emergencies"],
    queryFn: () => api.get("/admin/emergencies").then((r) => r.data),
  });

  const stats = statsQuery.data;
  const users = usersQuery.data?.items ?? [];
  const usersTotal = usersQuery.data?.total ?? 0;
  const messages = messagesQuery.data?.items ?? [];
  const messagesTotal = messagesQuery.data?.total ?? 0;
  const emergencies = emergenciesQuery.data?.items ?? [];

  const loading = statsQuery.isLoading || usersQuery.isLoading || messagesQuery.isLoading || emergenciesQuery.isLoading;

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
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-2 text-sm text-ayana-secondary border-b border-ayana-line">
        <Link to="/dashboard" className="hover:text-ayana-text transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-ayana-line mx-1">&middot;</span>
        <span className="text-ayana-text font-medium">Admin Panel</span>
      </div>
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
                  onSkip={setUsersSkip}
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
                  onSkip={setMessagesSkip}
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