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

// Generate a human-readable label from a category key when the backend
// doesn't include one (backend /config returns {key, type} only).
const CATEGORY_LABELS = {
  morning_wish: "Morning Wish",
  breakfast: "Breakfast Check",
  lunch: "Lunch Check",
  dinner: "Dinner Check",
  afternoon_checkin: "Afternoon Check-in",
  tea_check: "Tea / Coffee Check",
  walk_check: "Walk Check",
  how_feeling: "How Are You Feeling?",
  goodnight: "Good Night",
  love_note: "Love Note",
  medicine: "Medicine Reminder",
  water: "Water Reminder",
  bp_check: "BP Check",
  sugar_check: "Sugar Check",
  health_check: "Health Check",
};

const CATEGORY_ICON_MAP = {
  morning_wish: "sunrise",
  breakfast: "coffee",
  lunch: "utensils",
  dinner: "utensils",
  afternoon_checkin: "sun",
  tea_check: "coffee",
  walk_check: "heart",
  how_feeling: "heart",
  goodnight: "moon",
  love_note: "star",
  medicine: "pill",
  water: "droplet",
  bp_check: "activity",
  sugar_check: "candy",
  health_check: "heart-pulse",
};

// Normalize a category from backend (may have {key, type} only) to
// {key, label, type, icon} for rendering.
export function normalizeCategory(c) {
  const key = c.key || c.value || c;
  return {
    key,
    label: c.label || CATEGORY_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    type: c.type || "checkin",
    icon: c.icon || CATEGORY_ICON_MAP[key] || "heart",
  };
}

// A clean, responsive schedule builder — check-ins only.
// Medicine reminders are handled by the dedicated Medicine section in the parent card.
export function ScheduleEditor({ messages, setMessages, categories, maxCheckins }) {
  const cats = categories.map(normalizeCategory).filter((c) => c.type === "checkin");
  const catByKey = Object.fromEntries(cats.map((c) => [c.key, c]));

  if (!cats.length) {
    return (
      <div className="py-6 text-center text-sm text-ayana-muted animate-pulse">
        Loading schedule categories…
      </div>
    );
  }

  const add = () => {
    if (messages.length >= maxCheckins) {
      toast.error(`Your plan allows up to ${maxCheckins} daily check-ins. Upgrade for more.`);
      return;
    }
    const first = cats[0]?.key || "morning_wish";
    setMessages([...messages, { time: "09:00", category: first, type: "checkin" }]);
  };
  const updateAt = (idx, key, val) => {
    const next = [...messages]; next[idx] = { ...next[idx], [key]: val }; setMessages(next);
  };
  const removeAt = (idx) => setMessages(messages.filter((_, i) => i !== idx));

  const Row = ({ m, idx }) => {
    const cat = catByKey[m.category] || normalizeCategory({ key: m.category, type: "checkin" });
    const Icon = CATEGORY_ICONS[cat.icon] || MessageCircle;
    return (
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-ayana-line p-2.5" data-testid={`sched-row-${idx}`}>
        <span className="w-9 h-9 rounded-lg bg-ayana-primary/8 flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5 text-ayana-primary" strokeWidth={1.5} /></span>
        <input type="time" value={m.time} onChange={(e) => updateAt(idx, "time", e.target.value)} data-testid={`sched-time-${idx}`}
          className="px-3 py-2 rounded-lg border border-ayana-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ayana-accent/50 w-[8.5rem]" />
        <Select value={m.category} onValueChange={(v) => updateAt(idx, "category", v)}>
          <SelectTrigger className="flex-1 min-w-[9rem] bg-white" data-testid={`sched-cat-${idx}`}><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {cats.map((c) => {
              const CI = CATEGORY_ICONS[c.icon] || MessageCircle;
              return <SelectItem key={c.key} value={c.key}><span className="flex items-center gap-2"><CI className="w-4 h-4 text-ayana-primary" /> {c.label}</span></SelectItem>;
            })}
          </SelectContent>
        </Select>
        <button onClick={() => removeAt(idx)} data-testid={`sched-remove-${idx}`} className="text-ayana-muted hover:text-red-500 transition-colors p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2" data-testid="checkins-list">
        {messages.map((m, idx) => <Row key={idx} m={m} idx={idx} />)}
      </div>
      {messages.length === 0 && (
        <p className="text-sm text-ayana-muted text-center py-3">No check-ins yet. Add your first one below.</p>
      )}
      <button onClick={add} data-testid="add-checkin" disabled={messages.length >= maxCheckins}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ayana-accent hover:text-ayana-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <Plus className="w-4 h-4" /> Add check-in
      </button>
    </div>
  );
}
