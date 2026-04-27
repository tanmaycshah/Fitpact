// ── CONSTANTS ─────────────────────────────────────────────────────────────────
export const COLORS = [
  "#c8f53b","#ff6b6b","#4ecdc4","#ffd93d",
  "#a29bfe","#fd79a8","#00cec9","#fdcb6e",
];

export const GOAL_CATEGORIES = [
  { id: "gym",     label: "Gym / Workout",    icon: "🏋️", unit: "sessions", dailyType: "tick" },
  { id: "steps",   label: "Daily Steps",      icon: "🚶", unit: "steps",    dailyType: "number" },
  { id: "sleep",   label: "Sleep Before",     icon: "😴", unit: "nights",   dailyType: "tick" },
  { id: "junk",    label: "No Junk Food",     icon: "🍕", unit: "meals",    dailyType: "number" },
  { id: "weight",  label: "Weight Loss",      icon: "⚖️", unit: "kg",       dailyType: "number" },
  { id: "run",     label: "Running",          icon: "🏃", unit: "km",       dailyType: "number" },
  { id: "water",   label: "Water Intake",     icon: "💧", unit: "litres",   dailyType: "number" },
  { id: "custom",  label: "Custom",           icon: "🎯", unit: "times",    dailyType: "tick"   },
];

export const ADMIN_PIN = "1234"; // changeable in settings

// ── DATE HELPERS ──────────────────────────────────────────────────────────────
export function today() {
  return new Date().toISOString().split("T")[0];
}

export function getWeekDates(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function getCurrentWeekNum(startDate) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(1, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function getDayLabel(iso) {
  const d = new Date(iso);
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][
    (d.getDay() + 6) % 7
  ];
}

// ── FINE CALCULATOR ───────────────────────────────────────────────────────────
// Returns { totalFine, breakdown } for a member's goal in a given week
export function calcWeekFine(goal, logs, weekDates, memberId) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[0];
  const fine = goal.fineAmount || 0;
  const target = goal.weeklyTarget || 0;

  // collect this week's logs for this member+goal
  const weekLogs = weekDates.map(date => {
    const key = `${memberId}__${goal.id}__${date}`;
    return logs[key] || null;
  });

  let missed = 0;
  let detail = "";

  if (cat.dailyType === "tick") {
    // e.g. gym sessions, sleep nights — count ticked days
    const done = weekLogs.filter(l => l?.done).length;
    missed = Math.max(0, target - done);
    detail = `${done}/${target} ${cat.unit}`;
  } else {
    // e.g. junk food (max meals), steps (min), weight
    if (goal.category === "junk") {
      // junk: fine per meal OVER the allowed limit
      const eaten = weekLogs.reduce((s, l) => s + (l?.value || 0), 0);
      missed = Math.max(0, eaten - target);
      detail = `${eaten} junk meals (${target} allowed)`;
    } else {
      // for numeric goals: sum or latest value
      const total = weekLogs.reduce((s, l) => s + (l?.value || 0), 0);
      missed = total < target ? 1 : 0;
      detail = `${total}/${target} ${cat.unit}`;
    }
  }

  return {
    totalFine: missed * fine,
    missed,
    detail,
  };
}

// ── nanoid-lite ───────────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── WHATSAPP MSG ──────────────────────────────────────────────────────────────
export function buildWAMsg(members, goals, logs, settings) {
  const week = getWeekDates(0);
  const lines = [`🏋️ *${settings?.groupName || "FitPact"}* — Week Update\n`];
  members.forEach(m => {
    const mGoals = goals.filter(g => g.memberId === m.id);
    let totalFine = 0;
    mGoals.forEach(g => {
      const { totalFine: f } = calcWeekFine(g, logs, week, m.id);
      totalFine += f;
    });
    lines.push(`• *${m.name}* — ${mGoals.length} goals | fines: ₹${totalFine.toLocaleString("en-IN")}`);
  });
  lines.push(`\nLog your week at ${settings?.appUrl || "fitpact.vercel.app"} 💪`);
  return lines.join("\n");
}
