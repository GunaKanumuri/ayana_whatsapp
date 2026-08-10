import {
  Sunrise, Coffee, Heart, Utensils, Sun, Moon, Star, Pill, Droplet,
  Activity, HeartPulse, Candy, MessageCircle, Plus, Trash2,
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
export function ScheduleEditor({ messages, setMessages, categories, limits }) {
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
    </div>
  );
}
