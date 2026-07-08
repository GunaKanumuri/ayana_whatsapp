import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarHeart, MessageCircle, CheckCircle2, Plus, Pencil, Trash2,
  Loader2, ShieldCheck, Clock, Power, Sunrise, Coffee, Pill, Droplet,
  Utensils, Sun, Moon, Star, Heart, AlertTriangle,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TIMEZONES, LANG_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CATEGORY_ICONS = {
  morning_wish: Sunrise, breakfast: Coffee, medicine: Pill, water: Droplet,
  lunch: Utensils, afternoon_checkin: Sun, dinner: Moon, goodnight: Star, love_note: Heart,
};
const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 focus:border-ayana-accent transition";

export default function Dashboard() {
  const { user, config, logout } = useAuth();
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activation, setActivation] = useState({});
  const [loading, setLoading] = useState(true);

  const templates = config?.message_templates || {};
  const templateEntries = Object.entries(templates);
  const relationships = config?.relationships || [];
  const languages = config?.languages || [];

  const load = useCallback(async () => {
    try {
      const [p, s, l, a] = await Promise.all([
        api.get("/parents"), api.get("/schedules"), api.get("/messages/logs"), api.get("/activation"),
      ]);
      setParents(p.data); setSchedules(s.data); setLogs(l.data); setActivation(a.data);
    } catch (e) { toast.error("Could not load your data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const parentName = (id) => parents.find((p) => p.id === id)?.name || "Parent";

  const stats = [
    { icon: Users, label: "Parents", value: parents.length },
    { icon: CalendarHeart, label: "Active schedules", value: schedules.filter((s) => s.active).length },
    { icon: MessageCircle, label: "Messages sent", value: logs.length },
    { icon: CheckCircle2, label: "Care circle", value: activation.whatsapp_activated ? "Active" : "Off" },
  ];

  if (loading) {
    return <div className="min-h-screen bg-ayana-bg"><Navbar /><div className="flex items-center justify-center py-40"><Loader2 className="w-8 h-8 animate-spin text-ayana-primary" /></div></div>;
  }

  return (
    <div className="min-h-screen bg-ayana-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ayana-text">Hello, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="mt-1 text-ayana-secondary">Here's how your care circle is doing.</p>
          </div>
          {!activation.whatsapp_activated && (
            <button onClick={() => navigate("/onboarding")} data-testid="finish-setup" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ayana-accent text-white text-sm font-medium hover:bg-ayana-accent-hover transition-colors">Finish setup</button>
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
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
          </TabsList>

          {/* PARENTS */}
          <TabsContent value="parents" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-medium text-ayana-text">Your parents</h2>
              <ParentDialog relationships={relationships} languages={languages} onSaved={load}
                trigger={<button data-testid="add-parent" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover transition-colors"><Plus className="w-4 h-4" /> Add parent</button>} />
            </div>
            {parents.length === 0 ? (
              <EmptyState text="No parents added yet." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4" data-testid="parents-list">
                {parents.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{p.name}</p>
                        <p className="text-sm text-ayana-muted">{p.relationship} · {LANG_LABELS[p.language]}</p>
                      </div>
                      <div className="flex gap-1">
                        <ParentDialog parent={p} relationships={relationships} languages={languages} onSaved={load}
                          trigger={<button data-testid={`edit-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDelete onConfirm={async () => { await api.delete(`/parents/${p.id}`); toast.success("Parent removed."); load(); }}
                          trigger={<button data-testid={`delete-parent-${p.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-ayana-secondary">
                      <p className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5" /> {p.phone}</p>
                      <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {p.timezone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SCHEDULES */}
          <TabsContent value="schedules" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-medium text-ayana-text">Daily schedules</h2>
              {parents.length > 0 && (
                <ScheduleDialog parents={parents} templateEntries={templateEntries} onSaved={load}
                  trigger={<button data-testid="add-schedule" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover transition-colors"><Plus className="w-4 h-4" /> New schedule</button>} />
              )}
            </div>
            {schedules.length === 0 ? (
              <EmptyState text="No schedules yet. Add a parent, then create a daily rhythm." />
            ) : (
              <div className="space-y-4" data-testid="schedules-list">
                {schedules.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-ayana-line p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="font-display font-medium text-ayana-text">{parentName(s.parent_id)}</p>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${s.mode === "care_plus" ? "bg-ayana-accent/10 text-ayana-accent" : "bg-ayana-primary/10 text-ayana-primary"}`}>{s.mode === "care_plus" ? "Care+" : "Normal"} · {s.messages.length} check-ins</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Power className="w-4 h-4 text-ayana-muted" />
                          <Switch checked={s.active} data-testid={`toggle-schedule-${s.id}`}
                            onCheckedChange={async (v) => { await api.put(`/schedules/${s.id}`, { parent_id: s.parent_id, mode: s.mode, messages: s.messages, active: v }); load(); }} />
                        </div>
                        <ScheduleDialog parents={parents} templateEntries={templateEntries} schedule={s} onSaved={load}
                          trigger={<button data-testid={`edit-schedule-${s.id}`} className="p-2 text-ayana-muted hover:text-ayana-primary transition-colors"><Pencil className="w-4 h-4" /></button>} />
                        <ConfirmDelete onConfirm={async () => { await api.delete(`/schedules/${s.id}`); toast.success("Schedule deleted."); load(); }}
                          trigger={<button data-testid={`delete-schedule-${s.id}`} className="p-2 text-ayana-muted hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.messages.map((m, i) => {
                        const Icon = CATEGORY_ICONS[m.category] || MessageCircle;
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-ayana-alt rounded-lg px-2.5 py-1.5 text-ayana-secondary">
                            <Icon className="w-3.5 h-3.5 text-ayana-primary" /> {m.time} · {templates[m.category]?.label || m.category}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="mt-6">
            <h2 className="font-display text-xl font-medium text-ayana-text mb-4">Recent deliveries</h2>
            {logs.length === 0 ? (
              <div data-testid="activity-empty"><EmptyState text="No messages delivered yet. Check-ins appear here once they're sent." /></div>
            ) : (
              <div className="bg-white rounded-xl border border-ayana-line divide-y divide-ayana-line" data-testid="activity-list">
                {logs.slice(0, 40).map((l) => (
                  <div key={l.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-ayana-text">{l.body}</p>
                      <p className="text-xs text-ayana-muted mt-1">{templates[l.category]?.label || l.category} · {new Date(l.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${l.status === "sent" ? "bg-ayana-whatsapp/15 text-ayana-whatsapp" : l.status === "simulated" ? "bg-ayana-primary/10 text-ayana-primary" : "bg-red-100 text-red-600"}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ACCOUNT */}
          <TabsContent value="account" className="mt-6 max-w-xl">
            <div className="bg-white rounded-xl border border-ayana-line p-6">
              <h2 className="font-display text-lg font-medium text-ayana-text mb-4">Account</h2>
              <div className="space-y-2 text-sm text-ayana-secondary">
                <p><span className="text-ayana-muted">Name:</span> {user?.name}</p>
                <p><span className="text-ayana-muted">Email:</span> {user?.email}</p>
                <p><span className="text-ayana-muted">Phone:</span> {user?.phone}</p>
                <p className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-ayana-primary" /> Consent on file · Privacy-first</p>
              </div>
            </div>

            <div className="mt-6 bg-white rounded-xl border border-red-200 p-6">
              <h3 className="font-display text-lg font-medium text-ayana-text flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Delete account</h3>
              <p className="mt-2 text-sm text-ayana-secondary">This permanently removes your account, parents, schedules, and stops all messages.</p>
              <ConfirmDelete
                title="Delete your account?"
                description="This cannot be undone. All your data and your parents' schedules will be removed."
                confirmLabel="Delete everything"
                onConfirm={async () => { await api.delete("/account"); toast.success("Account deleted."); logout(); navigate("/"); }}
                trigger={<button data-testid="delete-account" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /> Delete my account</button>} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="bg-white rounded-xl border border-dashed border-ayana-line p-10 text-center text-ayana-muted text-sm">{text}</div>;
}

function ConfirmDelete({ trigger, onConfirm, title = "Are you sure?", description = "This action cannot be undone.", confirmLabel = "Delete" }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-delete" disabled={busy} onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }} className="bg-red-600 hover:bg-red-700">{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ParentDialog({ parent, relationships, languages, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(parent || { name: "", relationship: relationships[0] || "Mother", phone: "", language: "en", timezone: "Asia/Kolkata", notes: "" });

  const save = async () => {
    setBusy(true);
    try {
      if (parent) await api.put(`/parents/${parent.id}`, form);
      else await api.post("/parents", form);
      toast.success("Saved.");
      setOpen(false); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg">
        <DialogHeader><DialogTitle className="font-display">{parent ? "Edit parent" : "Add parent"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pd-name" placeholder="Name" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} data-testid="pd-relationship" className={inputCls}>{relationships.map((r) => <option key={r}>{r}</option>)}</select>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} data-testid="pd-language" className={inputCls}>{languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
          </div>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="pd-phone" placeholder="+919876543210" className={inputCls} />
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} data-testid="pd-timezone" className={inputCls}>{TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select>
        </div>
        <DialogFooter>
          <button onClick={save} disabled={busy || !form.name || !form.phone} data-testid="pd-save" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ parents, templateEntries, schedule, onSaved, trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parentId, setParentId] = useState(schedule?.parent_id || parents[0]?.id || "");
  const [mode, setMode] = useState(schedule?.mode || "normal");
  const [messages, setMessages] = useState(schedule?.messages || [{ time: "08:00", category: "morning_wish" }]);
  const limit = mode === "normal" ? 5 : 10;

  const upd = (i, k, v) => { const n = [...messages]; n[i] = { ...n[i], [k]: v }; setMessages(n); };
  const add = () => { if (messages.length >= limit) { toast.error(`Up to ${limit} in ${mode} mode.`); return; } setMessages([...messages, { time: "12:00", category: "love_note" }]); };
  const rm = (i) => setMessages(messages.filter((_, idx) => idx !== i));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { parent_id: parentId, mode, messages, active: schedule?.active ?? true };
      if (schedule) await api.put(`/schedules/${schedule.id}`, payload);
      else await api.post("/schedules", payload);
      toast.success("Schedule saved.");
      setOpen(false); onSaved();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-ayana-bg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{schedule ? "Edit schedule" : "New schedule"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="sd-parent" className={inputCls}>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select value={mode} onChange={(e) => setMode(e.target.value)} data-testid="sd-mode" className={inputCls}><option value="normal">Normal (5)</option><option value="care_plus">Care+ (10)</option></select>
          </div>
          <div className="space-y-2" data-testid="sd-messages">
            {messages.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" value={m.time} onChange={(e) => upd(i, "time", e.target.value)} data-testid={`sd-time-${i}`} className={`${inputCls} w-32`} />
                <select value={m.category} onChange={(e) => upd(i, "category", e.target.value)} data-testid={`sd-cat-${i}`} className={`${inputCls} flex-1`}>{templateEntries.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <button onClick={() => rm(i)} className="text-ayana-muted hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={add} data-testid="sd-add" className="inline-flex items-center gap-1.5 text-sm font-medium text-ayana-accent"><Plus className="w-4 h-4" /> Add check-in ({messages.length}/{limit})</button>
        </div>
        <DialogFooter>
          <button onClick={save} disabled={busy || !parentId} data-testid="sd-save" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-ayana-primary text-white text-sm font-medium hover:bg-ayana-primary-hover disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
