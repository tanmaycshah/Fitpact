export const COLORS = ["#c8f53b","#ff6b6b","#4ecdc4","#ffd93d","#a29bfe","#fd79a8","#00cec9","#fdcb6e","#55efc4","#fab1a0"];

export const GOAL_CATEGORIES = [
  { id: "gym",    label: "Gym / Workout",  icon: "🏋️", unit: "sessions", dailyType: "tick" },
  { id: "steps",  label: "Daily Steps",    icon: "🚶", unit: "k steps",  dailyType: "number" },
  { id: "sleep",  label: "Sleep on Time",  icon: "😴", unit: "nights",   dailyType: "tick" },
  { id: "junk",   label: "No Junk Food",   icon: "🍕", unit: "meals",    dailyType: "number" },
  { id: "weight", label: "Weight Check",   icon: "⚖️", unit: "kg",       dailyType: "number" },
  { id: "run",    label: "Running",        icon: "🏃", unit: "km",       dailyType: "number" },
  { id: "water",  label: "Water Intake",   icon: "💧", unit: "litres",   dailyType: "number" },
  { id: "custom", label: "Custom",         icon: "🎯", unit: "times",    dailyType: "tick" },
];

export const HOBBY_SUGGESTIONS = [
  { id: "guitar",      label: "Guitar",          icon: "🎸" },
  { id: "reading",     label: "Reading",          icon: "📚" },
  { id: "writing",     label: "Writing",          icon: "✍️" },
  { id: "chess",       label: "Chess",            icon: "♟️" },
  { id: "painting",    label: "Painting",         icon: "🎨" },
  { id: "meditation",  label: "Meditation",       icon: "🧘" },
  { id: "cooking",     label: "Cooking",          icon: "👨‍🍳" },
  { id: "language",    label: "Language Learning", icon: "🗣️" },
  { id: "photography", label: "Photography",      icon: "📷" },
  { id: "journaling",  label: "Journaling",       icon: "📓" },
  { id: "coding",      label: "Coding",           icon: "💻" },
  { id: "yoga",        label: "Yoga",             icon: "🤸" },
  { id: "piano",       label: "Piano",            icon: "🎹" },
  { id: "drawing",     label: "Drawing / Sketching", icon: "✏️" },
  { id: "podcast",     label: "Podcast / Learning", icon: "🎙️" },
  { id: "custom",      label: "Custom",           icon: "⭐" },
];

export const ADMIN_PIN = "1234";

// ── WEEK KEY ──────────────────────────────────────────────────────────────────
// Returns ISO week key e.g. "2025-W03"
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
  // Parse YYYY-Www and return Mon-Sun dates
  const [year, wStr] = weekKey.split("-W");
  const w = parseInt(wStr);
  const jan4 = new Date(parseInt(year), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startOfWeek1);
  monday.setDate(startOfWeek1.getDate() + (w - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function today() { return new Date().toISOString().split("T")[0]; }

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDateTime(ts) {
  if (!ts) return "";
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function getDayLabel(iso) {
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][(new Date(iso).getDay() + 6) % 7];
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function uid() { return Math.random().toString(36).slice(2, 10); }

// ── FINE CALC ─────────────────────────────────────────────────────────────────
export function calcGoalFine(goal, weekLog) {
  if (!weekLog) return 0;
  if (weekLog.overridden) return 0;
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category);
  const fine = goal.fineAmount || 0;
  const target = goal.weeklyTarget || 0;
  if (!cat) return 0;
  if (cat.id === "junk") {
    const over = Math.max(0, (weekLog.value || 0) - target);
    return over * fine;
  }
  if (cat.dailyType === "tick") {
    const done = weekLog.daysCompleted || 0;
    const missed = Math.max(0, target - done);
    return missed * fine;
  }
  // numeric min target
  if ((weekLog.value || 0) < target) return fine;
  return 0;
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
export function buildWAMsg(members, goals, weekLogs, settings, weekKey) {
  const lines = [`🏋️ *${settings?.groupName || "FitPact"}* — ${weekKey}\n`];
  members.forEach(m => {
    const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
    let fine = 0;
    mGoals.forEach(g => {
      const log = weekLogs[`${m.id}__${g.id}__${weekKey}`];
      fine += calcGoalFine(g, log);
    });
    lines.push(`• *${m.name}* — fines: ₹${fine.toLocaleString("en-IN")}`);
  });
  lines.push(`\nLog at ${settings?.appUrl || "fitpact-xi.vercel.app"} 💪`);
  return lines.join("\n");
}
