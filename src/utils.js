export const COLORS = ["#c8f53b","#ff6b6b","#4ecdc4","#ffd93d","#a29bfe","#fd79a8","#00cec9","#fdcb6e","#55efc4","#fab1a0"];

// cadence: "weekly" = log once per week, "daily" = log per day
// direction: "min" = must hit at least X, "max" = must stay under X
// logType: "tick" = yes/no per day, "number" = numeric value
export const GOAL_CATEGORIES = [
  { id: "gym",    label: "Gym / Workout",   icon: "🏋️", defaultUnit: "sessions", cadence: "weekly", logType: "tick",   direction: "min", hint: "e.g. 3 sessions/week" },
  { id: "steps",  label: "Daily Steps",     icon: "🚶", defaultUnit: "k steps",  cadence: "daily",  logType: "number", direction: "min", hint: "e.g. 10k steps/day" },
  { id: "sleep",  label: "Sleep on Time",   icon: "😴", defaultUnit: "nights",   cadence: "weekly", logType: "tick",   direction: "min", hint: "e.g. 5 nights/week" },
  { id: "junk",   label: "No Junk Food",    icon: "🍕", defaultUnit: "meals",    cadence: "weekly", logType: "number", direction: "max", hint: "e.g. max 2 junk meals/week" },
  { id: "water",  label: "Water Intake",    icon: "💧", defaultUnit: "litres",   cadence: "daily",  logType: "number", direction: "min", hint: "e.g. 2.5 litres/day" },
  { id: "run",    label: "Running",         icon: "🏃", defaultUnit: "km",       cadence: "weekly", logType: "number", direction: "min", hint: "e.g. 10 km/week" },
  { id: "weight", label: "Weight Check-in", icon: "⚖️", defaultUnit: "kg",       cadence: "weekly", logType: "number", direction: "min", hint: "Log your weight each week" },
  { id: "pushups",label: "Pushups",         icon: "💪", defaultUnit: "reps",     cadence: "daily",  logType: "number", direction: "min", hint: "e.g. 50 reps/day" },
  { id: "custom", label: "Custom",          icon: "🎯", defaultUnit: "times",    cadence: "weekly", logType: "tick",   direction: "min", hint: "Define your own goal" },
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

export const ADMIN_PIN = "1234";

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

export function getDayLabel(iso) {
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][(new Date(iso + "T00:00:00").getDay() + 6) % 7];
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function uid() { return Math.random().toString(36).slice(2, 10); }

// ── GOAL META HELPERS ─────────────────────────────────────────────────────────
// Get effective cadence — goal can override category default
export function getGoalCadence(goal) {
  return goal.cadence || GOAL_CATEGORIES.find(c => c.id === goal.category)?.cadence || "weekly";
}

export function getGoalLogType(goal) {
  return goal.logType || GOAL_CATEGORIES.find(c => c.id === goal.category)?.logType || "tick";
}

export function getGoalDirection(goal) {
  return goal.direction || GOAL_CATEGORIES.find(c => c.id === goal.category)?.direction || "min";
}

export function getGoalUnit(goal) {
  return goal.customUnit || GOAL_CATEGORIES.find(c => c.id === goal.category)?.defaultUnit || "times";
}

// ── FINE CALC ─────────────────────────────────────────────────────────────────
export function calcGoalFine(goal, weekLog) {
  if (!weekLog) return 0;
  if (weekLog.overridden) return 0;

  const fine = goal.fineAmount || 0;
  const target = Number(goal.weeklyTarget) || 0;
  const cadence = getGoalCadence(goal);
  const logType = getGoalLogType(goal);
  const direction = getGoalDirection(goal);

  // Junk food special case — fine per meal OVER the max
  if (goal.category === "junk") {
    const over = Math.max(0, (weekLog.value || 0) - target);
    return over * fine;
  }

  // Tick goals (gym, sleep, custom tick) — fine per missed session
  if (logType === "tick") {
    const done = weekLog.daysCompleted || 0;
    const missed = Math.max(0, target - done);
    return missed * fine;
  }

  // Daily numeric — fine per missed day
  if (cadence === "daily") {
    if (direction === "min") {
      // value = total for week, target = daily minimum × 7
      const dailyTarget = target;
      const dailyActual = weekLog.dailyAvg || (weekLog.value || 0);
      return dailyActual < dailyTarget ? fine : 0;
    }
    return 0;
  }

  // Weekly numeric — one fine if target missed
  if (direction === "min") {
    return (weekLog.value || 0) < target ? fine : 0;
  }
  if (direction === "max") {
    const over = Math.max(0, (weekLog.value || 0) - target);
    return over * fine;
  }

  return 0;
}

// ── GOAL SUMMARY TEXT ─────────────────────────────────────────────────────────
export function getGoalSummary(goal, weekLog) {
  const unit = getGoalUnit(goal);
  const cadence = getGoalCadence(goal);
  const logType = getGoalLogType(goal);
  const target = goal.weeklyTarget || 0;

  if (!weekLog) return `${target} ${unit}/${cadence === "daily" ? "day" : "wk"} — not logged`;

  if (goal.category === "junk") return `${weekLog.value || 0} meals (max ${target}/wk)`;
  if (logType === "tick") return `${weekLog.daysCompleted || 0}/${target} sessions`;
  if (cadence === "daily") return `${weekLog.dailyAvg || weekLog.value || 0}/${target} ${unit}/day avg`;
  return `${weekLog.value || 0}/${target} ${unit}`;
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
