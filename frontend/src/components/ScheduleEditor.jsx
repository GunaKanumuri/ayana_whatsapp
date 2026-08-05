import {
  Sunrise, Coffee, Heart, Utensils, Sun, Moon, Star, Pill, Droplet,
  Activity, HeartPulse, Candy, MessageCircle, Plus, Trash2, ShieldPlus, Clock3,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const CATEGORY_ICONS = {
  sunrise: Sunrise, coffee: Coffee, heart: Heart, utensils: Utensils, sun: Sun,
  moon: Moon, star: Star, pill: Pill, droplet: Droplet, activity: Activity,
  "heart-pulse": HeartPulse, candy: Candy,
};

function firstOfType(categories, type) {
  const c = categories.find((x) => x.type === type);
  return c ? c.key : categories[0]?.key;
}

// A clean, responsive schedule builder used by onboarding + dashboard.
export function ScheduleEditor({
  messages, setMessages, categories, limits,
  reengagementHours, setReengagementHours,
  recoveryMode, setRecoveryMode, recoveryUntil, setRecoveryUntil,
}) {
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c]));
  const checkinCats = categories.filter((c) => c.type === "checkin");
  const reminderCats = categories.filter((c) => c.type === "reminder");
  const checkins = messages.filter((m) => (catByKey[m.category]?.type || "checkin") === "checkin");
  const reminders = messages.filter((m) => (catByKey[m.category]?.type || "checkin") === "reminder");

  const addOfType = (type) => {
    const cats = type === "checkin" ? checkinCats : reminderCats;
    const current = type === "checkin" ? checkins.length : reminders.length;
    const max = type === "checkin" ? limits.checkins : limits.reminders;
    if (current >= max) { toast.error(`Your plan allows up to ${max} ${type === "checkin" ? "check-ins" : "reminders"}. Upgrade to Care+ for more.`); return; }
    setMessages([...messages, { time: type === "checkin" ? "09:00" : "20:00", category: firstOfType(cats, type), type }]);
  };
  const updateAt = (globalIdx, key, val) => {
    const next = [...messages]; next[globalIdx] = { ...next[globalIdx], [key]: val }; setMessages(next);
  };
  const removeAt = (globalIdx) => setMessages(messages.filter((_, i) => i !== globalIdx));

  const Row = ({ m, gi, cats }) => {
    const Icon = CATEGORY_ICONS[catByKey[m.category]?.icon] || MessageCircle;
    return (
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-ayana-line p-2.5" data-testid={`sched-row-${gi}`}>
        <span className="w-9 h-9 rounded-lg bg-ayana-primary/8 flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5 text-ayana-primary" strokeWidth={1.5} /></span>
        <input type="time" value={m.time} onChange={(e) => updateAt(gi, "time", e.target.value)} data-testid={`sched-time-${gi}`}
          className="px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 w-[8.5rem]" />
        <Select value={m.category} onValueChange={(v) => updateAt(gi, "category", v)}>
          <SelectTrigger className="flex-1 min-w-[9rem] bg-white" data-testid={`sched-cat-${gi}`}><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {cats.map((c) => {
              const CI = CATEGORY_ICONS[c.icon] || MessageCircle;
              return <SelectItem key={c.key} value={c.key}><span className="flex items-center gap-2"><CI className="w-4 h-4 text-ayana-primary" /> {c.label}</span></SelectItem>;
            })}
          </SelectContent>
        </Select>
        <button onClick={() => removeAt(gi)} data-testid={`sched-remove-${gi}`} className="text-ayana-muted hover:text-red-500 transition-colors p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="font-display font-medium text-ayana-text flex items-center gap-2"><Heart className="w-4 h-4 text-ayana-accent" /> Daily check-ins <span className="text-xs text-ayana-muted font-normal">({checkins.length}/{limits.checkins})</span></h4>
        </div>
        <div className="space-y-2" data-testid="checkins-list">
          {messages.map((m, gi) => (catByKey[m.category]?.type || "checkin") === "checkin" ? <Row key={gi} m={m} gi={gi} cats={checkinCats} /> : null)}
        </div>
        <button onClick={() => addOfType("checkin")} data-testid="add-checkin" disabled={checkins.length >= limits.checkins}
          className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-ayana-accent hover:text-ayana-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-4 h-4" /> Add check-in
        </button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="font-display font-medium text-ayana-text flex items-center gap-2"><Pill className="w-4 h-4 text-ayana-primary" /> Medicine &amp; health reminders <span className="text-xs text-ayana-muted font-normal">({reminders.length}/{limits.reminders})</span></h4>
        </div>
        <div className="space-y-2" data-testid="reminders-list">
          {messages.map((m, gi) => (catByKey[m.category]?.type || "checkin") === "reminder" ? <Row key={gi} m={m} gi={gi} cats={reminderCats} /> : null)}
        </div>
        <button onClick={() => addOfType("reminder")} data-testid="add-reminder" disabled={reminders.length >= limits.reminders}
          className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-ayana-primary hover:text-ayana-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Plus className="w-4 h-4" /> Add reminder
        </button>
      </section>

      {limits.variants_per_slot > 3 && (
        <p className="text-xs text-ayana-muted flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-ayana-gold" /> Each message rotates through {limits.variants_per_slot} handwritten variants so it never feels repetitive.
        </p>
      )}

      {setReengagementHours && (
        <section className="rounded-xl border border-ayana-line bg-white p-3.5">
          <h4 className="font-display font-medium text-ayana-text flex items-center gap-2 text-sm">
            <Clock3 className="w-4 h-4 text-ayana-primary" /> Re-engagement window
          </h4>
          <p className="mt-1 text-xs text-ayana-muted">If they don't reply, we gently follow up after this many hours (before the free WhatsApp reply window closes).</p>
          <select value={reengagementHours} onChange={(e) => setReengagementHours(Number(e.target.value))} data-testid="sched-reengagement-hours"
            className="mt-2 px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50">
            {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}
          </select>
        </section>
      )}

      {limits.recovery_mode && setRecoveryMode && (
        <section className="rounded-xl border border-ayana-accent/30 bg-ayana-accent/5 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-display font-medium text-ayana-text flex items-center gap-2 text-sm">
              <ShieldPlus className="w-4 h-4 text-ayana-accent" /> Recovery mode
            </h4>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={!!recoveryMode} onChange={(e) => setRecoveryMode(e.target.checked)} data-testid="sched-recovery-toggle" className="w-4 h-4 accent-ayana-accent" />
              <span className="text-xs text-ayana-secondary">{recoveryMode ? "On" : "Off"}</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-ayana-muted">
            Pre/post-surgery? Turn this on for up to {limits.recovery_extra_reminders || 2} extra reminder slots for {limits.recovery_days || 30} days — it reverts automatically.
          </p>
          {recoveryMode && (
            <div className="mt-2.5 flex items-center gap-2">
              <label className="text-xs text-ayana-secondary shrink-0">Ends on</label>
              <input type="date" value={recoveryUntil || ""} onChange={(e) => setRecoveryUntil(e.target.value)} data-testid="sched-recovery-until"
                className="px-3 py-1.5 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
