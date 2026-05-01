export const COLORS = ["#c8f53b","#ff6b6b","#4ecdc4","#ffd93d","#a29bfe","#fd79a8","#00cec9","#fdcb6e","#55efc4","#fab1a0"];

export const GOAL_CATEGORIES = [
  { id: "gym",     label: "Gym / Workout",   icon: "🏋️", defaultUnit: "sessions", cadence: "weekly", logType: "tick",   direction: "min" },
  { id: "steps",   label: "Daily Steps",     icon: "🚶", defaultUnit: "k steps",  cadence: "daily",  logType: "number", direction: "min" },
  { id: "sleep",   label: "Sleep on Time",   icon: "😴", defaultUnit: "nights",   cadence: "weekly", logType: "tick",   direction: "min" },
  { id: "junk",    label: "No Junk Food",    icon: "🍕", defaultUnit: "meals",    cadence: "weekly", logType: "number", direction: "max" },
  { id: "water",   label: "Water Intake",    icon: "💧", defaultUnit: "litres",   cadence: "daily",  logType: "number", direction: "min" },
  { id: "run",     label: "Running",         icon: "🏃", defaultUnit: "km",       cadence: "weekly", logType: "number", direction: "min" },
  { id: "weight",  label: "Weight Check-in", icon: "⚖️", defaultUnit: "kg",       cadence: "weekly", logType: "number", direction: "min" },
  { id: "pushups", label: "Pushups",         icon: "💪", defaultUnit: "reps",     cadence: "daily",  logType: "number", direction: "min" },
  { id: "custom",  label: "Custom",          icon: "🎯", defaultUnit: "times",    cadence: "weekly", logType: "tick",   direction: "min" },
];

export const HOBBY_SUGGESTIONS = [
  { id: "guitar",      label: "Guitar",             icon: "🎸" },
  { id: "reading",     label: "Reading",            icon: "📚" },
  { id: "writing",     label: "Writing",            icon: "✍️" },
  { id: "chess",       label: "Chess",              icon: "♟️" },
  { id: "painting",    label: "Painting",           icon: "🎨" },
  { id: "meditation",  label: "Meditation",         icon: "🧘" },
  { id: "cooking",     label: "Cooking",            icon: "👨‍🍳" },
  { id: "language",    label: "Language Learning",  icon: "🗣️" },
  { id: "photography", label: "Photography",        icon: "📷" },
  { id: "journaling",  label: "Journaling",         icon: "📓" },
  { id: "coding",      label: "Coding",             icon: "💻" },
  { id: "yoga",        label: "Yoga",               icon: "🤸" },
  { id: "piano",       label: "Piano",              icon: "🎹" },
  { id: "drawing",     label: "Drawing / Sketching",icon: "✏️" },
  { id: "podcast",     label: "Podcast / Learning", icon: "🎙️" },
  { id: "custom",      label: "Custom",             icon: "⭐" },
];

// ── WEEK KEY ──────────────────────────────────────────────────────────────────
export function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function currentWeekKey() { return getWeekKey(); }

export function getWeekDates(weekKey) {
  const [year, wStr] = weekKey.split("-W");
  const w = parseInt(wStr);
  const jan4 = new Date(parseInt(year), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startOfWeek1);
  monday.setDate(startOfWeek1.getDate() + (w - 1) * 7);
  // Returns Mon, Tue, Wed, Thu, Fri, Sat, Sun
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function today() { return new Date().toISOString().split("T")[0]; }

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDateTime(ts) {
  if (!ts) return "";
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Mon=0 … Sun=6
export function getDayLabel(iso) {
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][(new Date(iso + "T00:00:00").getDay() + 6) % 7];
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function uid() { return Math.random().toString(36).slice(2, 10); }

// ── GOAL META HELPERS ─────────────────────────────────────────────────────────
export function getEffectiveCat(goal) {
  return GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[8];
}
export function getGoalLogType(goal) {
  // goal.logType overrides category default
  return goal.logType || getEffectiveCat(goal).logType;
}
export function getGoalDirection(goal) {
  return goal.direction || getEffectiveCat(goal).direction;
}
export function getGoalCadence(goal) {
  return goal.cadence || getEffectiveCat(goal).cadence;
}
export function getGoalUnit(goal) {
  return goal.customUnit || getEffectiveCat(goal).defaultUnit;
}

// ── THE ONE TRUE FINE CALCULATOR ──────────────────────────────────────────────
// All fine logic lives HERE. App.jsx calls this. No duplicates.
//
// dayLogs: { "memberId__goalId__YYYY-MM-DD": { done, value, note } }
// weekKey: "2026-W18"
// override: fine doc from Firestore { overridden, customAmount, ... }
//
export function calcFine({ goal, weekKey, dayLogs, override }) {
  // Admin override always wins
  if (override?.overridden) {
    return override.customAmount != null ? Number(override.customAmount) : 0;
  }

  const finePerMiss = Number(goal.fineAmount) || 0;
  const target      = Number(goal.weeklyTarget) || 0;
  const logType     = getGoalLogType(goal);
  const direction   = getGoalDirection(goal);
  const weekDates   = getWeekDates(weekKey);

  // ── TICK goals (gym, sleep, custom tick) ──────────────────────────────────
  // direction MUST be "min" — target = minimum sessions per week
  // fine = (target - doneDays) × finePerMiss, floored at 0
  if (logType === "tick") {
    const doneDays = weekDates.filter(d => {
      const dl = dayLogs[`${goal.memberId}__${goal.id}__${d}`];
      return dl?.done === true;
    }).length;
    const missed = Math.max(0, target - doneDays);
    return missed * finePerMiss;
  }

  // ── NUMERIC MAX goals (junk food, any "stay under X" goal) ────────────────
  // direction === "max" — target = maximum allowed per week
  // fine = (total - target) × finePerMiss, floored at 0
  if (logType === "number" && direction === "max") {
    const total = weekDates.reduce((sum, d) => {
      const dl = dayLogs[`${goal.memberId}__${goal.id}__${d}`];
      return sum + (Number(dl?.value) || 0);
    }, 0);
    const over = Math.max(0, total - target);
    return over * finePerMiss;
  }

  // ── NUMERIC MIN goals (steps, water, running, pushups, weight) ────────────
  // direction === "min" — target = minimum to hit per week (or per day avg)
  // fine = ONE fine if total for week < target, else 0
  if (logType === "number" && direction === "min") {
    const total = weekDates.reduce((sum, d) => {
      const dl = dayLogs[`${goal.memberId}__${goal.id}__${d}`];
      return sum + (Number(dl?.value) || 0);
    }, 0);
    return total < target ? finePerMiss : 0;
  }

  return 0;
}

// Max possible fine this week if nothing is done
export function calcMaxFine({ goal }) {
  const finePerMiss = Number(goal.fineAmount) || 0;
  const target      = Number(goal.weeklyTarget) || 0;
  const logType     = getGoalLogType(goal);
  const direction   = getGoalDirection(goal);

  if (logType === "tick") return target * finePerMiss;
  if (logType === "number" && direction === "max") return 0; // unlimited upside, no ceiling
  if (logType === "number" && direction === "min") return finePerMiss; // one fine
  return 0;
}

// How many days logged done this week
export function getDoneDays(goal, weekKey, dayLogs) {
  return getWeekDates(weekKey).filter(d => {
    const dl = dayLogs[`${goal.memberId}__${goal.id}__${d}`];
    return getGoalLogType(goal) === "tick" ? dl?.done === true : (Number(dl?.value) || 0) > 0;
  }).length;
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
export function buildWAMsg(members, goals, dayLogs, settings, weekKey) {
  const lines = [`🏋️ *${settings?.groupName || "FitPact"}* — ${weekKey}\n`];
  members.forEach(m => {
    const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
    let fine = 0;
    mGoals.forEach(g => {
      fine += calcFine({ goal: g, weekKey, dayLogs, override: null });
    });
    lines.push(`• *${m.name}* — fines: ₹${fine.toLocaleString("en-IN")}`);
  });
  lines.push(`\nLog at ${settings?.appUrl || "fitpact-xi.vercel.app"} 💪`);
  return lines.join("\n");
}
