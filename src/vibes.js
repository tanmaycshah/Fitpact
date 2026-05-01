// ── STATIC FALLBACKS (used if Gemini is unavailable) ─────────────────────────
const FALLBACK_QUOTES = [
  { quote: "The only bad workout is the one that didn't happen.", author: "" },
  { quote: "Discipline is choosing between what you want now and what you want most.", author: "" },
  { quote: "Your future self is watching you right now through memories.", author: "" },
  { quote: "It never gets easier. You just get stronger.", author: "" },
  { quote: "Don't stop when you're tired. Stop when you're done.", author: "" },
  { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { quote: "What seems impossible today will one day become your warm-up.", author: "" },
  { quote: "Your only competition is who you were yesterday.", author: "" },
];

const FALLBACK_JOKES = [
  "My fitness journey: Day 1 — bought gym shoes. Day 180 — still wearing them to eat out.",
  "Six-pack abs? I have a keg. I'm just ahead of schedule.",
  "Diet tip: your stomach is only the size of your fist. Unless your fist is the size of a biryani pot.",
  "They say your body is a temple. Mine is more of a dhaba. Open 24 hours, slightly chaotic.",
  "Current fitness level: I get winded opening a new tab.",
  "I'm not out of shape. This is exactly what a rectangle looks like.",
  "My metabolism ghosted me at 27 and never came back.",
  "Life is short. Eat the samosa. Cry about it at the gym. Eat another samosa.",
];

// ── CACHE KEY ─────────────────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

// ── FETCH FROM GEMINI VIA SERVERLESS FUNCTION ────────────────────────────────
export async function fetchGeminiVibes() {
  try {
    const res = await fetch("/api/vibes?type=both", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.quote || !data.joke) throw new Error("Incomplete response");
    return {
      quote: data.quote,
      author: data.author || "",
      joke: data.joke,
      date: todayKey(),
      source: "gemini",
    };
  } catch (err) {
    console.warn("Gemini fetch failed, using fallback:", err.message);
    return getFallback();
  }
}

function getFallback() {
  const day = Math.floor(Date.now() / 86400000);
  return {
    quote: FALLBACK_QUOTES[day % FALLBACK_QUOTES.length].quote,
    author: FALLBACK_QUOTES[day % FALLBACK_QUOTES.length].author,
    joke: FALLBACK_JOKES[(day + 3) % FALLBACK_JOKES.length],
    date: todayKey(),
    source: "fallback",
  };
}

// ── CONFETTI COLOURS ──────────────────────────────────────────────────────────
export const CONFETTI_COLORS = [
  "#c8f53b", "#ff6b6b", "#4ecdc4", "#ffd93d",
  "#a29bfe", "#fd79a8", "#00cec9", "#fdcb6e",
];

// ── CELEBRATION MESSAGES ──────────────────────────────────────────────────────
export const CELEBRATIONS = {
  perfect:  { emoji: "🏆", msg: "PERFECT WEEK!", sub: "Every single goal nailed. Absolute beast." },
  great:    { emoji: "🔥", msg: "GREAT WEEK!", sub: "Almost perfect. Keep this up." },
  partial:  { emoji: "💪", msg: "SOLID EFFORT", sub: "Did some. Fines sting less than regret." },
  missed:   { emoji: "😬", msg: "ROUGH WEEK", sub: "Pay up. Bounce back. Simple." },
  noFine:   { emoji: "✨", msg: "CLEAN WEEK", sub: "Zero fines. Your wallet is proud." },
  streak3:  { emoji: "🔥🔥🔥", msg: "3-WEEK STREAK!", sub: "Habit forming. Don't break it now." },
  streak5:  { emoji: "⚡", msg: "5-WEEK STREAK!", sub: "You're different. Respect." },
  allClean: { emoji: "🎉", msg: "WHOLE SQUAD CLEAN!", sub: "Everyone nailed it this week. Rare." },
};
