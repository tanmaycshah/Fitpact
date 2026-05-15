import { useState, useEffect, useCallback, useRef } from "react";
import { auth } from "./firebase";
import { fetchGeminiVibes, CONFETTI_COLORS, CELEBRATIONS } from "./vibes";
import {
  signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  listenSettings, saveSettings,
  listenUsers, getUser, saveUser, approveUser, makeAdmin,
  listenMembers, saveMember, deleteMember,
  listenGoals, saveGoal, deleteGoal,
  listenHobbies, saveHobby, deleteHobby,
  listenWeekLogs, saveWeekLog, listenDayLogs,
  listenHobbyLogs, saveHobbyLog,
  listenFines, saveFine, adminOverrideFine,
  listenFinePayments, markFinePaid, markFineUnpaid,
  listenActivity, postActivity,
  listenBanter, postBanter,
  listenMonths, saveMonth,
  listenWeekNotes, saveWeekNote,
} from "./db";
import {
  COLORS, GOAL_CATEGORIES, HOBBY_SUGGESTIONS,
  currentWeekKey, getWeekKey, getWeekDates,
  today, formatDate, formatDateTime, getDayLabel,
  getMonthKey, uid, buildWAMsg,
  calcFine, calcMaxFine, getDoneDays, getDaysRequired, getDailyTarget,
  getGoalLogType, getGoalDirection, getGoalCadence, getGoalUnit,
} from "./utils";

// ── STYLE TOKENS ──────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a", card: "#111", border: "#1e1e1e", border2: "#2a2a2a",
  lime: "#c8f53b", red: "#ff5555", amber: "#ffb800", blue: "#4fa3e0",
  muted: "#666", text: "#f0ede6", text2: "#aaa", green: "#00b894",
};
const IS = {
  width: "100%", background: "#0c0c0c", border: `1px solid ${C.border2}`,
  borderRadius: 8, padding: "11px 13px", color: C.text,
  fontFamily: "'DM Sans',sans-serif", fontSize: 15, outline: "none", boxSizing: "border-box",
};
const mkBP = (dis, color) => ({
  padding: "12px 22px", borderRadius: 10, border: "none",
  background: dis ? "#333" : (color || C.lime),
  color: dis ? "#777" : (color ? "#fff" : "#0a0a0a"),
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700,
  cursor: dis ? "not-allowed" : "pointer",
  display: "inline-flex", alignItems: "center", gap: 8, opacity: dis ? 0.6 : 1,
});
const BO = {
  padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.border2}`,
  background: "transparent", color: C.text,
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, cursor: "pointer",
};


// ── CONFETTI ──────────────────────────────────────────────────────────────────
function Confetti({ active, onDone }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 100,
      r: 4 + Math.random() * 6, d: 2 + Math.random() * 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      tiltAngle: 0, tiltSpeed: 0.05 + Math.random() * 0.1,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.beginPath();
        if (p.shape === "circle") { ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        else { ctx.rect(p.x, p.y, p.r * 2, p.r); }
        ctx.fill();
        p.y += p.d; p.tiltAngle += p.tiltSpeed; p.x += Math.sin(p.tiltAngle) * 1.5;
      });
      frame++;
      if (frame < 180) { animRef.current = requestAnimationFrame(draw); }
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); onDone?.(); }
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);
  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }} />;
}

function CelebrationOverlay({ data, onClose }) {
  if (!data) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)" }}>
      <div style={{ textAlign: "center", padding: 32, animation: "popIn .4s ease" }}>
        <div style={{ fontSize: 72, marginBottom: 12 }}>{data.emoji}</div>
        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 38, color: C.lime, letterSpacing: 2, marginBottom: 8 }}>{data.msg}</div>
        <div style={{ fontSize: 15, color: C.text2, marginBottom: 24 }}>{data.sub}</div>
        <div style={{ fontSize: 12, color: C.muted }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}

// Vibes cache key — one per day
const VIBES_CACHE_KEY = "fitpact_vibes_" + new Date().toISOString().split("T")[0];

function DailyVibesCard() {
  const [vibes, setVibes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showJoke, setShowJoke] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadVibes = async (force = false) => {
    // Check localStorage cache first (avoids API call on every render)
    if (!force) {
      try {
        const cached = localStorage.getItem(VIBES_CACHE_KEY);
        if (cached) {
          setVibes(JSON.parse(cached));
          setLoading(false);
          return;
        }
      } catch {}
    }
    setRefreshing(true);
    const data = await fetchGeminiVibes();
    try { localStorage.setItem(VIBES_CACHE_KEY, JSON.stringify(data)); } catch {}
    setVibes(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadVibes(); }, []);

  if (loading) return (
    <div style={{ background: C.card, border: "1px solid rgba(200,245,59,0.2)", borderRadius: 14, padding: "16px", marginBottom: 16, minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: C.muted }}>Fetching today's vibes from Gemini...</div>
    </div>
  );

  return (
    <div style={{ background: C.card, border: "1px solid rgba(200,245,59,0.2)", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
      {!showJoke ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: C.lime, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Today's Fuel 🔥</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {vibes?.source === "gemini" && <span style={{ fontSize: 9, color: "#444", fontFamily: "monospace" }}>✦ Gemini</span>}
              <button onClick={() => loadVibes(true)} disabled={refreshing} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }} title="Get new vibes">
                {refreshing ? "..." : "🎲"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, fontStyle: "italic", marginBottom: vibes?.author ? 6 : 0 }}>"{vibes?.quote}"</div>
          {vibes?.author && <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>— {vibes.author}</div>}
          <button onClick={() => setShowJoke(true)} style={{ marginTop: 12, background: "transparent", border: "1px solid #2a2a2a", color: "#666", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 11 }}>
            😂 I need a laugh instead
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Today's Nonsense 😂</div>
            <button onClick={() => loadVibes(true)} disabled={refreshing} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }} title="Get new joke">
              {refreshing ? "..." : "🎲"}
            </button>
          </div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{vibes?.joke}</div>
          <button onClick={() => setShowJoke(false)} style={{ marginTop: 12, background: "transparent", border: "1px solid #2a2a2a", color: "#666", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 11 }}>
            🔥 Back to motivation
          </button>
        </>
      )}
    </div>
  );
}

// ── MICRO COMPONENTS ──────────────────────────────────────────────────────────
const Spin = () => <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid #0a0a0a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .6s linear infinite" }} />;

function Av({ name, emoji, idx, size = 40 }) {
  const c = COLORS[idx % COLORS.length];
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `${c}22`, color: c, border: `2px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, flexShrink: 0 }}>{emoji || name?.[0]?.toUpperCase() || "?"}</div>;
}

function Badge({ children, color }) {
  const clr = color || C.muted;
  return <span style={{ background: `${clr}18`, border: `1px solid ${clr}44`, color: clr, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{children}</span>;
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type === "error" ? C.red : type === "info" ? C.blue : C.lime;
  const tc = type === "error" || type === "info" ? "#fff" : "#0a0a0a";
  return <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: bg, color: tc, padding: "11px 24px", borderRadius: 30, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: `0 4px 24px ${bg}55`, pointerEvents: "none", animation: "fadeUp .3s ease", maxWidth: "90vw", textAlign: "center" }}>{msg}</div>;
}

function Modal({ open, title, onClose, children, maxWidth = 500 }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div style={{ background: "#141414", border: `1px solid ${C.border2}`, borderRadius: "18px 18px 0 0", padding: "20px 18px 32px", width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, color: C.lime, letterSpacing: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Fld({ label, children }) {
  return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 6 }}>{label}</div>{children}</div>;
}

function Card({ children, highlight, style: s }) {
  return <div style={{ background: C.card, border: `1px solid ${highlight ? `${C.lime}44` : C.border}`, borderRadius: 13, padding: "13px 14px", ...s }}>{children}</div>;
}

function Section({ title, children }) {
  return <div style={{ marginBottom: 24 }}><div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, letterSpacing: 1, marginBottom: 12 }}>{title}</div>{children}</div>;
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const doGoogle = async () => {
    setLoading(true); setErr("");
    try {
      const r = await signInWithPopup(auth, new GoogleAuthProvider());
      onAuth(r.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const doEmail = async () => {
    if (!email || !password) { setErr("Email and password required"); return; }
    setLoading(true); setErr("");
    try {
      const fn = mode === "signup" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      const r = await fn(auth, email, password);
      onAuth(r.user);
    } catch (e) { setErr(e.message.replace("Firebase: ", "").replace(/\(auth.*\)/, "")); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box} @keyframes spin{to{transform:rotate(360deg)}} @keyframes popIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}} @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-16px)}} @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}} @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 42, letterSpacing: 3, marginBottom: 4 }}>
        <span style={{ color: C.lime }}>FIT</span><span style={{ color: C.text }}>PACT</span>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 36 }}>Squad accountability. No excuses.</div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <button onClick={doGoogle} disabled={loading} style={{ ...mkBP(loading, "#4285f4"), width: "100%", justifyContent: "center", marginBottom: 16, fontSize: 15 }}>
          {loading ? <Spin /> : <span style={{ fontSize: 18 }}>G</span>}
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: C.border2 }} />
          <span style={{ fontSize: 12, color: C.muted }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border2 }} />
        </div>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={{ ...IS, marginBottom: 10 }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" style={{ ...IS, marginBottom: 14 }} onKeyDown={e => e.key === "Enter" && doEmail()} />

        {err && <div style={{ fontSize: 13, color: C.red, marginBottom: 12, padding: "8px 12px", background: "rgba(255,85,85,0.1)", borderRadius: 8 }}>{err}</div>}

        <button onClick={doEmail} disabled={loading} style={{ ...mkBP(loading), width: "100%", justifyContent: "center", marginBottom: 16 }}>
          {loading && <Spin />}{mode === "signup" ? "Create Account" : "Sign In"}
        </button>

        <div style={{ textAlign: "center", fontSize: 13, color: C.muted }}>
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ background: "none", border: "none", color: C.lime, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PENDING SCREEN ────────────────────────────────────────────────────────────
function PendingScreen({ user, onSignOut }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28, color: C.lime, marginBottom: 8 }}>PENDING APPROVAL</div>
      <div style={{ fontSize: 14, color: C.muted, textAlign: "center", maxWidth: 300, marginBottom: 8 }}>
        You're in! Your squad admin needs to approve your account and link it to your profile.
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>Signed in as <b style={{ color: C.text }}>{user.email || user.displayName}</b></div>
      <button onClick={onSignOut} style={{ ...BO }}>Sign out</button>
    </div>
  );
}

// ── WEEK LOG MODAL ────────────────────────────────────────────────────────────
function WeekLogModal({ open, onClose, goal, weekKey, existingLog, memberName, onSave }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal?.category) || GOAL_CATEGORIES[7];
  const [completed, setCompleted] = useState("yes");
  const [daysCompleted, setDaysCompleted] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);

  useEffect(() => {
    if (open) {
      setCompleted(existingLog?.completed || "yes");
      setDaysCompleted(existingLog?.daysCompleted != null ? String(existingLog.daysCompleted) : "");
      setValue(existingLog?.value != null ? String(existingLog.value) : "");
      setNote(existingLog?.note || "");
      setSaving(false); ref.current = false;
    }
  }, [open, existingLog]);

  if (!open || !goal) return null;

  const handleSave = async () => {
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    const data = {
      completed,
      note: note.trim(),
      ...(cat.dailyType === "tick" ? { daysCompleted: parseInt(daysCompleted) || 0 } : { value: parseFloat(value) || 0 }),
      loggedAt: new Date().toISOString(),
    };
    await onSave(data);
    setSaving(false);
  };

  const weekDates = getWeekDates(weekKey);
  const target = goal.weeklyTarget || 0;

  return (
    <Modal open={open} title={`LOG WEEK — ${goal.name?.toUpperCase()}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        {cat.icon} {goal.name} · Week of {formatDate(weekDates[0])} – {formatDate(weekDates[6])}
      </div>

      <Fld label="How did this week go?">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["yes","✅ Nailed it"],["partial","⚠️ Partial"],["no","❌ Missed it"]].map(([v, lbl]) => (
            <button key={v} onClick={() => setCompleted(v)} style={{
              flex: 1, minWidth: 90, padding: "10px 8px", borderRadius: 10,
              border: `2px solid ${completed === v ? C.lime : C.border2}`,
              background: completed === v ? "rgba(200,245,59,0.1)" : "#0c0c0c",
              color: completed === v ? C.lime : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>{lbl}</button>
          ))}
        </div>
      </Fld>

      {cat.dailyType === "tick" ? (
        <Fld label={`Days completed (target: ${target})`}>
          <input type="number" value={daysCompleted} onChange={e => setDaysCompleted(e.target.value)}
            placeholder={`0 – 7`} style={IS} min="0" max="7" />
        </Fld>
      ) : (
        <Fld label={`Total ${cat.unit} this week (target: ${target})`}>
          <input type="number" value={value} onChange={e => setValue(e.target.value)}
            placeholder={`Enter ${cat.unit}`} style={IS} min="0" step="0.1" />
        </Fld>
      )}

      <Fld label="Note / Reason (required if missed)">
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder={completed === "no" ? "e.g. Was travelling, on holiday in Goa..." : "e.g. Hit gym Mon, Wed, Fri — skipped Sat"}
          style={{ ...IS, resize: "vertical" }} />
      </Fld>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={handleSave} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : "Save Log →"}</button>
      </div>
    </Modal>
  );
}

// ── HOBBY LOG MODAL ───────────────────────────────────────────────────────────

// ── DAY LOG MODAL — tap a day dot to log that specific day ───────────────────
function DayLogModal({ open, onClose, goal, date, existingLog, onSave, isHistorical }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal?.category) || GOAL_CATEGORIES[7];
  const isNumeric = (goal?.logType || cat.logType) === "number";
  const unit = goal?.customUnit || cat.defaultUnit;
  const [done, setDone] = useState(true);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);

  useEffect(() => {
    if (open) {
      setDone(existingLog?.done !== false);
      setValue(existingLog?.value != null ? String(existingLog.value) : "");
      setNote(existingLog?.note || "");
      setSaving(false); ref.current = false;
    }
  }, [open, existingLog]);

  if (!open || !goal) return null;

  const dayLabel = date ? getDayLabel(date) + " " + formatDate(date) : "";

  const handleSave = async () => {
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    const data = isNumeric
      ? { done: (parseFloat(value) || 0) > 0, value: parseFloat(value) || 0, note }
      : { done, note };
    await onSave(data);
    setSaving(false);
  };

  return (
    <Modal open={open} title={`${goal.name?.toUpperCase()} — ${dayLabel.toUpperCase()}`} onClose={onClose} maxWidth={360}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{cat.icon} Tap to mark done or missed</div>

      {isNumeric ? (
        <Fld label={`${unit} today`}>
          <input type="number" value={value} onChange={e => setValue(e.target.value)}
            placeholder={`Enter ${unit}`} style={{ ...IS, fontSize: 18, padding: "14px", textAlign: "center" }}
            min="0" step="0.5" autoFocus />
        </Fld>
      ) : (
        <Fld label="Did you do this today?">
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDone(true)} style={{
              flex: 1, padding: "16px 8px", borderRadius: 12, fontSize: 24,
              border: `2px solid ${done ? C.lime : C.border2}`,
              background: done ? "rgba(200,245,59,0.1)" : "#0c0c0c", cursor: "pointer",
            }}>✅</button>
            <button onClick={() => setDone(false)} style={{
              flex: 1, padding: "16px 8px", borderRadius: 12, fontSize: 24,
              border: `2px solid ${!done ? C.red : C.border2}`,
              background: !done ? "rgba(255,85,85,0.1)" : "#0c0c0c", cursor: "pointer",
            }}>❌</button>
          </div>
        </Fld>
      )}

      <Fld label="Note (optional — reason if missed)">
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. was travelling, holiday" style={IS} />
      </Fld>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={handleSave} disabled={saving}>
          {saving && <Spin />}{saving ? "Saving..." : "Save →"}
        </button>
      </div>
    </Modal>
  );
}

function HobbyLogModal({ open, onClose, hobby, weekKey, existingLog, onSave }) {
  const [sessions, setSessions] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);

  useEffect(() => {
    if (open) {
      setSessions(existingLog?.sessions != null ? String(existingLog.sessions) : "");
      setNote(existingLog?.note || "");
      setSaving(false); ref.current = false;
    }
  }, [open, existingLog]);

  if (!open || !hobby) return null;

  const handleSave = async () => {
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    await onSave({ sessions: parseInt(sessions) || 0, note: note.trim(), loggedAt: new Date().toISOString() });
    setSaving(false);
  };

  const sug = HOBBY_SUGGESTIONS.find(h => h.id === hobby.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];

  return (
    <Modal open={open} title={`LOG HOBBY — ${hobby.name?.toUpperCase()}`} onClose={onClose} maxWidth={400}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{sug.icon} {hobby.name}</div>
      <Fld label="Sessions this week">
        <input type="number" value={sessions} onChange={e => setSessions(e.target.value)}
          placeholder="e.g. 3" style={IS} min="0" max="30" />
      </Fld>
      <Fld label="Note (optional)">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="What did you do?" style={IS} />
      </Fld>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={handleSave} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : "Save →"}</button>
      </div>
    </Modal>
  );
}

// ── ADMIN OVERRIDE MODAL ──────────────────────────────────────────────────────
function OverrideModal({ open, onClose, rawFine, memberName, goalName, onSave }) {
  const [reason, setReason] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setCustomAmount("0");
      setSaving(false); ref.current = false;
    }
  }, [open]);

  const handleSave = async () => {
    if (!reason.trim()) { alert("Reason is required"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    await onSave(reason.trim(), Number(customAmount) || 0);
    setSaving(false);
  };

  const amt = Number(customAmount) || 0;
  const saving_ = amt < rawFine ? rawFine - amt : 0;

  return (
    <Modal open={open} title="ADMIN FINE OVERRIDE" onClose={onClose} maxWidth={420}>
      <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ color: C.amber, fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{memberName} — {goalName}</div>
        <div style={{ color: C.muted, fontSize: 13 }}>Original fine: <b style={{ color: C.red }}>₹{(rawFine || 0).toLocaleString("en-IN")}</b></div>
      </div>

      <Fld label="Set fine to (₹) — 0 to waive fully, or custom amount">
        <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
          style={{ ...IS, fontSize: 20, textAlign: "center", padding: "14px" }} min="0" max={rawFine} step="100" />
      </Fld>

      {/* Quick presets */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[0, Math.round((rawFine||0)*0.25), Math.round((rawFine||0)*0.5), Math.round((rawFine||0)*0.75), rawFine].map(v => {
          const lbl = v === 0 ? "Waive" : v === rawFine ? "Full" : `${Math.round(100-((v/(rawFine||1))*100))}% off`;
          return (
            <button key={v} onClick={() => setCustomAmount(String(v))}
              style={{ flex: 1, minWidth: 50, padding: "7px 4px", borderRadius: 8, border: `1px solid ${amt === v ? C.amber : C.border2}`, background: amt === v ? "rgba(255,184,0,0.1)" : "#0c0c0c", color: amt === v ? C.amber : C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
              <div>₹{v}</div><div style={{ fontSize: 9 }}>{lbl}</div>
            </button>
          );
        })}
      </div>

      {saving_ > 0 && (
        <div style={{ background: "rgba(0,184,148,0.08)", border: "1px solid rgba(0,184,148,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#00b894", marginBottom: 14 }}>
          Saving them ₹{saving_.toLocaleString("en-IN")} — fine reduced from ₹{(rawFine||0).toLocaleString("en-IN")} to ₹{amt.toLocaleString("en-IN")}
        </div>
      )}

      <Fld label="Reason (required — shown in fines ledger)">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
          placeholder="e.g. Was on holiday, did 1 gym session instead of 3 — partial credit" style={{ ...IS, resize: "vertical" }} />
      </Fld>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving, C.amber)} onClick={handleSave} disabled={saving}>
          {saving && <Spin />}{saving ? "Saving..." : `Set Fine to ₹${amt.toLocaleString("en-IN")} →`}
        </button>
      </div>
    </Modal>
  );
}

// ── MEMBER FORM ───────────────────────────────────────────────────────────────
function MemberForm({ initial, onSave, onClose, isEdit }) {
  const [form, setForm] = useState(initial || { name: "", emoji: "", dob: "", weight: "", height: "", fitnessGoal: "" });
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);
  useEffect(() => { setForm(initial || { name: "", emoji: "", dob: "", weight: "", height: "", fitnessGoal: "" }); ref.current = false; setSaving(false); }, [initial]);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const go = async () => {
    if (!form.name.trim()) { alert("Name required"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    try { await onSave(form); } finally { setSaving(false); ref.current = false; }
  };
  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Fld label="Full Name"><input value={form.name} onChange={e => s("name", e.target.value)} placeholder="e.g. Rahul" style={IS} /></Fld></div>
        <div style={{ width: 70 }}><Fld label="Emoji"><input value={form.emoji} onChange={e => s("emoji", e.target.value)} placeholder="💪" style={{ ...IS }} maxLength={2} /></Fld></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Fld label="Weight (kg)"><input type="number" value={form.weight} onChange={e => s("weight", e.target.value)} placeholder="70" style={IS} /></Fld></div>
        <div style={{ flex: 1 }}><Fld label="Height (cm)"><input type="number" value={form.height} onChange={e => s("height", e.target.value)} placeholder="175" style={IS} /></Fld></div>
      </div>
      <Fld label="Date of Birth"><input type="date" value={form.dob} onChange={e => s("dob", e.target.value)} style={IS} /></Fld>
      <Fld label="Fitness Goal Statement"><textarea value={form.fitnessGoal} onChange={e => s("fitnessGoal", e.target.value)} placeholder="e.g. Lose 8kg, get fit before 35th birthday" rows={2} style={{ ...IS, resize: "vertical" }} /></Fld>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={go} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : isEdit ? "Save →" : "Add →"}</button>
      </div>
    </>
  );
}

// ── GOAL FORM ─────────────────────────────────────────────────────────────────
function GoalForm({ initial, members, onSave, onClose, isEdit }) {
  const EMPTY = { memberId: "", name: "", category: "gym", weeklyTarget: "", dailyTarget: "", daysPerWeek: "", fineAmount: "1000", goalType: "ongoing", cadence: "", direction: "", logType: "", customUnit: "", notes: "" };
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);
  useEffect(() => { setForm(initial || EMPTY); ref.current = false; setSaving(false); }, [initial]);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cat = GOAL_CATEGORIES.find(c => c.id === form.category) || GOAL_CATEGORIES[0];
  // Effective values — form overrides category defaults
  const effCadence = form.cadence || cat.cadence;
  const effDirection = form.direction || cat.direction;
  const effLogType = form.logType || cat.logType;
  const effUnit = form.customUnit || cat.defaultUnit;
  const isCustom = form.category === "custom";
  const isJunk = form.category === "junk";

  // When category changes, reset overrides
  const setCategory = (val) => setForm(f => ({ ...f, category: val, cadence: "", direction: "", logType: "", customUnit: "" }));

  const isDailyNumeric = effLogType === "number" && effCadence === "daily";
  const fineHint = () => {
    if (isJunk) return `Each meal over ${form.weeklyTarget || "?"}/wk = ₹${form.fineAmount || 0} fine`;
    if (effLogType === "tick") return `Miss a session = ₹${form.fineAmount || 0} fine · max ₹${(Number(form.weeklyTarget)||0) * (Number(form.fineAmount)||0)} if zero sessions`;
    if (isDailyNumeric) {
      const dt = form.dailyTarget || "?";
      const dpw = form.daysPerWeek || "?";
      const max = (Number(form.daysPerWeek)||0) * (Number(form.fineAmount)||0);
      return `Hit ${dt} ${effUnit} on ${dpw} days/wk. Miss a day = ₹${form.fineAmount || 0}. Max fine = ₹${max}/wk`;
    }
    return `Miss weekly target of ${form.weeklyTarget || "?"} ${effUnit} = ₹${form.fineAmount || 0} fine`;
  };

  const go = async () => {
    if (!form.name.trim() || !form.memberId) { alert("Member and goal name required"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    try { await onSave({ ...form, weeklyTarget: Number(form.weeklyTarget) || 0, dailyTarget: Number(form.dailyTarget) || 0, daysPerWeek: Number(form.daysPerWeek) || 0, fineAmount: Number(form.fineAmount) || 0 }); }
    finally { setSaving(false); ref.current = false; }
  };

  return (
    <>
      {!isEdit && <Fld label="For Member">
        <select value={form.memberId} onChange={e => s("memberId", e.target.value)} style={IS}>
          <option value="">Select member</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Fld>}

      <Fld label="Goal Name">
        <input value={form.name} onChange={e => s("name", e.target.value)} placeholder={cat.hint || "e.g. Gym 3x/week"} style={IS} />
      </Fld>

      <Fld label="Category">
        <select value={form.category} onChange={e => setCategory(e.target.value)} style={IS}>
          {GOAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </Fld>

      {/* Custom / override options */}
      {(isCustom || cat.logType === "number") && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Fld label="Cadence">
              <select value={effCadence} onChange={e => s("cadence", e.target.value)} style={IS}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </Fld>
          </div>
          {!isJunk && (
            <div style={{ flex: 1 }}>
              <Fld label="Direction">
                <select value={effDirection} onChange={e => s("direction", e.target.value)} style={IS}>
                  <option value="min">Minimum (hit at least X)</option>
                  <option value="max">Maximum (stay under X)</option>
                </select>
              </Fld>
            </div>
          )}
        </div>
      )}

      {isCustom && (
        <Fld label="Unit / Metric (e.g. reps, litres, pages, km)">
          <input value={form.customUnit} onChange={e => s("customUnit", e.target.value)} placeholder="e.g. pushups, litres, pages" style={IS} />
        </Fld>
      )}

      <Fld label="Goal Type">
        <select value={form.goalType} onChange={e => s("goalType", e.target.value)} style={IS}>
          <option value="ongoing">Ongoing — carries forward every month</option>
          <option value="monthly">Monthly challenge — resets each month</option>
        </select>
      </Fld>

      {isDailyNumeric ? (
        // Daily numeric goals need TWO fields: daily value target + days per week
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Fld label={`Daily target (${effUnit}/day)`}>
                <input type="number" value={form.dailyTarget} onChange={e => s("dailyTarget", e.target.value)}
                  placeholder={`e.g. ${cat.id==="steps"?"10000":cat.id==="water"?"3":"50"}`} style={IS} min="0" step="1" />
              </Fld>
            </div>
            <div style={{ flex: 1 }}>
              <Fld label="Days per week required">
                <input type="number" value={form.daysPerWeek} onChange={e => s("daysPerWeek", e.target.value)}
                  placeholder="e.g. 4" style={IS} min="1" max="7" step="1" />
              </Fld>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Fld label="Fine per missed day (₹)">
                <input type="number" value={form.fineAmount} onChange={e => s("fineAmount", e.target.value)} style={IS} min="0" step="100" />
              </Fld>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#c8f53b", fontFamily: "'DM Mono',monospace" }}>
                Max: ₹{((Number(form.daysPerWeek)||0) * (Number(form.fineAmount)||0)).toLocaleString("en-IN")}/wk
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Fld label={`${effDirection === "max" ? "Max allowed" : "Target"} (${effUnit}/${effCadence === "daily" ? "day" : "wk"})`}>
              <input type="number" value={form.weeklyTarget} onChange={e => s("weeklyTarget", e.target.value)}
                placeholder={effDirection === "max" ? "e.g. 2" : "e.g. 3"} style={IS} min="0" step="0.5" />
            </Fld>
          </div>
          <div style={{ flex: 1 }}>
            <Fld label="Fine per miss (₹)">
              <input type="number" value={form.fineAmount} onChange={e => s("fineAmount", e.target.value)} style={IS} min="0" step="100" />
            </Fld>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.15)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: C.muted, marginBottom: 14 }}>
        💡 {fineHint()}
      </div>

      <Fld label="Notes (optional)">
        <input value={form.notes} onChange={e => s("notes", e.target.value)} placeholder="e.g. 2 cheat meals allowed" style={IS} />
      </Fld>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={go} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : isEdit ? "Save →" : "Add Goal →"}</button>
      </div>
    </>
  );
}

// ── HOBBY FORM ────────────────────────────────────────────────────────────────
function HobbyForm({ initial, members, onSave, onClose, isEdit, defaultMemberId }) {
  const EMPTY = { memberId: defaultMemberId || "", name: "", hobbyType: "guitar", startDate: today(), notes: "" };
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);
  useEffect(() => { setForm(initial || EMPTY); ref.current = false; setSaving(false); }, [initial]);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const sug = HOBBY_SUGGESTIONS.find(h => h.id === form.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];
  const go = async () => {
    if (!form.name.trim() || !form.memberId) { alert("Member and hobby name required"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    try { await onSave(form); } finally { setSaving(false); ref.current = false; }
  };
  return (
    <>
      {!isEdit && <Fld label="For Member">
        <select value={form.memberId} onChange={e => s("memberId", e.target.value)} style={IS}>
          <option value="">Select member</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Fld>}
      <Fld label="Hobby / Skill">
        <select value={form.hobbyType} onChange={e => { s("hobbyType", e.target.value); const h = HOBBY_SUGGESTIONS.find(x => x.id === e.target.value); if (h && h.id !== "custom") s("name", h.label); }} style={IS}>
          {HOBBY_SUGGESTIONS.map(h => <option key={h.id} value={h.id}>{h.icon} {h.label}</option>)}
        </select>
      </Fld>
      <Fld label="Custom Name (optional)"><input value={form.name} onChange={e => s("name", e.target.value)} placeholder={sug.label} style={IS} /></Fld>
      <Fld label="Start Date"><input type="date" value={form.startDate} onChange={e => s("startDate", e.target.value)} style={IS} /></Fld>
      <Fld label="Notes"><input value={form.notes} onChange={e => s("notes", e.target.value)} placeholder="e.g. Learning classical guitar, targeting 3x/week" style={IS} /></Fld>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving)} onClick={go} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : isEdit ? "Save →" : "Add Hobby →"}</button>
      </div>
    </>
  );
}


// ── WEEKLY NOTE SECTION ───────────────────────────────────────────────────────
function WeeklyNoteSection({ initialNote, onSave }) {
  const [text, setText] = useState(initialNote || "");
  const [status, setStatus] = useState("idle"); // idle, saving, saved
  const timerRef = useRef(null);
  useEffect(() => { setText(initialNote || ""); }, [initialNote]);
  const handleChange = (val) => {
    setText(val); setStatus("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      await onSave(val);
      setStatus("saved");
    }, 1200);
  };
  return (
    <div style={{ marginTop: 20, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 11, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>📝 Week Notes</div>
        <div style={{ fontSize: 10, color: status === "saving" ? "#ffb800" : status === "saved" ? "#00b894" : "#333" }}>
          {status === "saving" ? "Saving..." : status === "saved" ? "Saved ✓" : "Auto-saves"}
        </div>
      </div>
      <textarea value={text} onChange={e => handleChange(e.target.value)}
        placeholder="Notes for this week, reminders for next week, anything on your mind... (optional)"
        rows={3}
        style={{ width: "100%", background: "transparent", border: "none", color: "#f0ede6", fontFamily: "'DM Sans',sans-serif", fontSize: 13, resize: "vertical", outline: "none", lineHeight: 1.5 }} />
    </div>
  );
}

// ── MONTHLY CALENDAR ──────────────────────────────────────────────────────────
// Apple Watch style ring SVG for a single day
function DayRings({ goalStatuses }) {
  // Each goal = one concentric arc AT the outer edge of the circle
  // Outermost ring = goal 1, next inner = goal 2, etc.
  // Done = full 360° arc, missed = partial arc (~60%), empty = faint track
  const n = Math.min(goalStatuses.length, 4);
  if (n === 0) return null;
  const SIZE = 40;          // must match button size
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const STROKE = 3;         // ring thickness
  const GAP = 1.5;          // gap between rings
  const outerR = cx - STROKE / 2 - 1; // just inside the button edge

  return (
    <svg width={SIZE} height={SIZE}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {goalStatuses.slice(0, n).map((status, i) => {
        const r = outerR - i * (STROKE + GAP);
        const circ = 2 * Math.PI * r;
        const trackClr = "#1e1e1e";
        const ringClr = status === "done" ? "#c8f53b"
                      : status === "missed" ? "#ff5555"
                      : null;
        // done = full circle, missed = 55% arc, empty = no arc (just track)
        const dashLen = status === "done" ? circ
                      : status === "missed" ? circ * 0.55
                      : 0;
        // start from top (offset by -90°)
        const offset = -circ * 0.25;
        return (
          <g key={i}>
            {/* Track */}
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={trackClr} strokeWidth={STROKE} />
            {/* Arc */}
            {ringClr && (
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={ringClr} strokeWidth={STROKE}
                strokeDasharray={`${dashLen} ${circ}`}
                strokeDashoffset={offset}
                strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyCalendar({ members, goals, dayLogs, fines, activeMemberId, onMemberChange, onDateClick }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(null);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const todayStr = today();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const pad = n => String(n).padStart(2,"0");
  const ds = day => `${year}-${pad(month+1)}-${pad(day)}`;

  // For each day, get per-goal statuses
  const getDayGoalStatuses = (day) => {
    if (!activeMemberId) return [];
    const d = ds(day);
    if (d > todayStr) return [];
    return goals.filter(g => g.memberId === activeMemberId && g.active !== false).map(g => {
      const dl = dayLogs[`${activeMemberId}__${g.id}__${d}`];
      if (!dl) return "empty";
      return (dl.done || dl.value > 0) ? "done" : "missed";
    });
  };

  // Monthly stats
  const mGoals = goals.filter(g => g.memberId === activeMemberId && g.active !== false);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const pastDays = monthDays.filter(d => ds(d) <= todayStr);
  let monthDone = 0, monthTotal = 0, monthFine = 0;
  pastDays.forEach(day => {
    mGoals.forEach(g => {
      const d = ds(day);
      monthTotal++;
      const dl = dayLogs[`${activeMemberId}__${g.id}__${d}`];
      if (dl?.done || dl?.value > 0) monthDone++;
      // fine contribution
      const wk = getWeekKey(new Date(d));
      const override = fines[`${activeMemberId}__${wk}__${g.id}`];
      if (!override?.overridden && dl && !dl.done && !dl.value) monthFine += (g.fineAmount || 0);
    });
  });

  return (
    <div>
      {/* Member selector */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
        {members.map((m, idx) => {
          const active = activeMemberId === m.id;
          return (
            <button key={m.id} onClick={() => { onMemberChange(m.id); setSelDay(null); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, flexShrink: 0, cursor: "pointer", border: `1px solid ${active ? "#c8f53b" : "#2a2a2a"}`, background: active ? "rgba(200,245,59,0.1)" : "#111" }}>
              <span style={{ fontSize: 14 }}>{m.emoji || m.name[0]}</span>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? "#c8f53b" : "#666" }}>{m.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Month navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); }}
          style={{ background: "#111", border: "1px solid #2a2a2a", color: "#f0ede6", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: "#c8f53b", letterSpacing: 1 }}>{MONTHS[month]} {year}</div>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); }}
          style={{ background: "#111", border: "1px solid #2a2a2a", color: "#f0ede6", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>›</button>
      </div>

      {/* Monthly stats strip */}
      {activeMemberId && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Activities Done", v: `${monthDone}/${monthTotal}`, c: monthDone === monthTotal && monthTotal > 0 ? "#c8f53b" : "#ffb800" },
            { l: "Completion", v: monthTotal > 0 ? `${Math.round((monthDone/monthTotal)*100)}%` : "—", c: "#c8f53b" },
            { l: "Fines (MTD)", v: `₹${monthFine.toLocaleString("en-IN")}`, c: monthFine > 0 ? "#ff5555" : "#c8f53b" },
          ].map(p => (
            <div key={p.l} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 10px" }}>
              <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{p.l}</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, color: p.c, lineHeight: 1 }}>{p.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 40px)", gap: 6, justifyContent: "space-between", marginBottom: 6 }}>
        {["M","T","W","T","F","S","S"].map((d,i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#555", fontWeight: 700, padding: "3px 0" }}>{d}</div>)}
      </div>

      {/* Calendar grid with Apple Watch rings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 40px)", gap: 6, justifyContent: "space-between" }}>
        {Array.from({ length: firstDow }).map((_,i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth },(_,i)=>i+1).map(day => {
          const d = ds(day);
          const isFuture = d > todayStr;
          const isToday = d === todayStr;
          const isSel = selDay === day;
          const statuses = getDayGoalStatuses(day);
          const allDone = statuses.length > 0 && statuses.every(s => s === "done");
          const anyMissed = statuses.some(s => s === "missed");
          const notLogged = statuses.length > 0 && statuses.every(s => s === "empty");

          return (
            <button key={day}
              onClick={() => {
                if (isFuture) return;
                if (isSel) { setSelDay(null); return; }
                setSelDay(day);
              }}
              style={{
                width: 40, height: 40, borderRadius: "50%", position: "relative",
                border: isToday ? "2.5px solid #c8f53b" : "none",
                background: isSel ? "rgba(200,245,59,0.12)" : "transparent",
                color: isToday ? "#c8f53b" : isFuture ? "#2a2a2a" : notLogged ? "#444" : allDone ? "#c8f53b" : anyMissed ? "#ff6666" : "#ffb800",
                fontSize: 11, fontWeight: isToday ? 700 : 400,
                cursor: isFuture ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 0,
              }}>
              {!isFuture && !isToday && statuses.length > 0 && <DayRings goalStatuses={statuses} />}
              <span style={{ position: "relative", zIndex: 1 }}>{day}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        {[["#c8f53b","Done"],["#ff5555","Missed"],["#2a2a2a","Not logged"],["#c8f53b","Today (circle)"]].map(([clr,lbl],i) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
            {i === 3
              ? <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${clr}` }} />
              : <div style={{ width: 10, height: 10, borderRadius: "50%", background: `${clr}33`, border: `1.5px solid ${clr}` }} />
            }
            {lbl}
          </div>
        ))}
      </div>

      {/* Tap date → navigate to that week */}
      {selDay && (
        <div style={{ marginTop: 14 }}>
          {/* Day detail */}
          {activeMemberId && (() => {
            const d = ds(selDay);
            const mGoalsDay = goals.filter(g => g.memberId === activeMemberId && g.active !== false);
            return (
              <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 16, color: "#c8f53b" }}>{MONTHS[month].slice(0,3)} {selDay}</div>
                  <button onClick={() => onDateClick && onDateClick(d)}
                    style={{ fontSize: 11, color: "#c8f53b", background: "rgba(200,245,59,0.1)", border: "1px solid rgba(200,245,59,0.3)", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>
                    Go to this week →
                  </button>
                </div>
                {mGoalsDay.map(g => {
                  const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[8];
                  const dl = dayLogs[`${activeMemberId}__${g.id}__${d}`];
                  return (
                    <div key={g.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#111", borderRadius: 7, marginBottom: 4, fontSize: 13 }}>
                      <span>{cat.icon} {g.name}</span>
                      <span style={{ color: dl?.done||dl?.value>0 ? "#c8f53b" : dl ? "#ff5555" : "#444" }}>
                        {dl ? (dl.done ? "✅" : dl.value>0 ? `${dl.value} ${cat.defaultUnit}` : "❌") : "—"}
                        
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── EXCEL / CSV EXPORT ────────────────────────────────────────────────────────
function exportData({ members, goals, dayLogs, fines, finePayments, weekNotes, months }) {
  const esc = v => { if (v == null) return ''; const s = String(v); if (s.includes(',') || s.includes('"')) return '"' + s.replaceAll('"', '""') + '"'; return s; };
  const row = arr => arr.map(esc).join(",");
  const dl = (name, csv) => {
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`FitPact_${name}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Collect all weeks with any data
  const weekSet = new Set();
  Object.keys(dayLogs).forEach(k => {
    const d = k.split("__")[2];
    if (d) { try { weekSet.add(getWeekKey(new Date(d))); } catch {} }
  });
  const sortedWeeks = [...weekSet].sort();

  // Helper: compute fine for one member/goal/week
  const computeFine = (m, g, wk) => {
    const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[8];
    const override = fines[`${m.id}__${wk}__${g.id}`];
    if (override?.overridden) return override.customAmount ?? 0;
    const wDates = getWeekDates(wk);
    const finePerMiss = Number(g.fineAmount) || 0;
    const target = Number(g.weeklyTarget) || 0;
    const logType = g.logType || cat.logType;
    const direction = g.direction || cat.direction;
    const cadence = g.cadence || cat.cadence;
    if (logType === "tick") {
      const done = wDates.filter(d => dayLogs[`${m.id}__${g.id}__${d}`]?.done).length;
      return Math.max(0, target - done) * finePerMiss;
    }
    if (direction === "max") {
      const total = wDates.reduce((s,d) => s+(Number(dayLogs[`${m.id}__${g.id}__${d}`]?.value)||0),0);
      return Math.max(0, total - target) * finePerMiss;
    }
    // min numeric
    if (cadence === "daily") {
      const today_ = new Date().toISOString().split("T")[0];
      return wDates.filter(d => {
        if (d > today_) return false;
        const dl = dayLogs[`${m.id}__${g.id}__${d}`];
        if (!dl) return false;
        return (Number(dl.value)||0) < target;
      }).length * finePerMiss;
    }
    const total = wDates.reduce((s,d) => s+(Number(dayLogs[`${m.id}__${g.id}__${d}`]?.value)||0),0);
    return total < target ? finePerMiss : 0;
  };

  // ONE FILE PER MEMBER — member-wise breakdown
  members.forEach(m => {
    const mGoals = goals.filter(g => g.memberId === m.id);
    if (!mGoals.length) return;

    const lines = [];

    // Section: Summary header
    lines.push(row([`MEMBER: ${m.name}`]));
    lines.push(row([`Goals: ${mGoals.length}`, `Weight: ${m.weight||"-"}kg`, `Height: ${m.height||"-"}cm`]));
    lines.push(row([]));

    // Section: Weekly activity per goal
    lines.push(row(["=== WEEKLY ACTIVITY ==="]));
    lines.push(row(["Week","Week Start","Week End","Goal","Category","Days Done","Target/Day or Wk","Total Value","Fine","Override","Override Reason","Paid"]));

    sortedWeeks.forEach(wk => {
      const wDates = getWeekDates(wk);
      mGoals.forEach(g => {
        const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[8];
        const dayEntries = wDates.map(d => dayLogs[`${m.id}__${g.id}__${d}`]);
        if (!dayEntries.some(Boolean)) return; // skip empty weeks
        const done = dayEntries.filter(e => e?.done || e?.value > 0).length;
        const totalVal = dayEntries.reduce((s,e) => s+(e?.value||0),0);
        const override = fines[`${m.id}__${wk}__${g.id}`];
        const fine = computeFine(m, g, wk);
        const paid = finePayments[`${m.id}__${wk}`]?.paid ? "Yes" : fine > 0 ? "No" : "";
        lines.push(row([wk, wDates[0], wDates[6], g.name, cat.label, done, g.weeklyTarget, totalVal||done, fine||"", override?.overridden?"Yes":"No", override?.overrideReason||"", paid]));
      });
    });

    lines.push(row([]));

    // Section: Monthly rollup
    const monthSet2 = new Set(sortedWeeks.map(wk => wk.substring(0,4)+"-"+("0"+(Math.ceil(parseInt(wk.split("-W")[1])/4.33))).slice(-2)));
    lines.push(row(["=== MONTHLY ROLLUP ==="]));
    lines.push(row(["Month","Goal","Days Done","Days Logged","Total Value","Month Fine","Paid"]));
    const allMonths = new Set();
    Object.keys(dayLogs).filter(k=>k.startsWith(`${m.id}__`)).forEach(k=>{const d=k.split("__")[2];if(d)allMonths.add(d.substring(0,7));});
    [...allMonths].sort().forEach(mo => {
      mGoals.forEach(g => {
        const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[8];
        const entries = Object.keys(dayLogs)
          .filter(k=>k.startsWith(`${m.id}__${g.id}__`)&&k.split("__")[2]?.startsWith(mo))
          .map(k=>dayLogs[k]);
        if (!entries.length) return;
        const done = entries.filter(e=>e?.done||e?.value>0).length;
        const total = entries.reduce((s,e)=>s+(e?.value||0),0);
        const moFine = sortedWeeks.filter(wk=>wk.startsWith(mo.substring(0,4))).reduce((s,wk)=>s+computeFine(m,g,wk),0);
        const moPaid = Object.values(finePayments).filter(p=>p.memberId===m.id&&p.weekKey?.startsWith(mo)&&p.paid).length > 0;
        lines.push(row([mo, g.name, done, entries.length, total||done, moFine||"", moPaid?"Yes":""]));
      });
    });

    lines.push(row([]));

    // Section: Fine payments
    const mPayments = Object.values(finePayments).filter(p=>p.memberId===m.id);
    if (mPayments.length) {
      lines.push(row(["=== FINE PAYMENTS ==="]));
      lines.push(row(["Week","Total Fine","Paid","Paid At","Marked By"]));
      mPayments.forEach(p => {
        const wkFine = mGoals.reduce((s,g)=>s+computeFine(m,g,p.weekKey),0);
        const paidAt = p.paidAt?.seconds ? new Date(p.paidAt.seconds*1000).toISOString().split("T")[0] : "";
        lines.push(row([p.weekKey, wkFine||"", p.paid?"Yes":"No", paidAt, p.markedBy||""]));
      });
      lines.push(row([]));
    }

    // Section: Week notes
    const mNotes = Object.values(weekNotes).filter(n=>n.memberId===m.id&&n.text);
    if (mNotes.length) {
      lines.push(row(["=== WEEK NOTES ==="]));
      lines.push(row(["Week","Note"]));
      mNotes.sort((a,b)=>a.weekKey?.localeCompare(b.weekKey)).forEach(n=>lines.push(row([n.weekKey,n.text])));
    }

    const csv = lines.join("\n");
    dl(`${m.name.replace(/[^a-zA-Z0-9]/g,"_")}`, csv);
  });
}


// ── SCORES DRILL-DOWN ─────────────────────────────────────────────────────────
function ScoresDrillDown({ years, sortedMonths, members, goals, dayLogs, fines, finePayments,
  getMemberMonthFine, getGoalMonthDetail, isAdmin, myMember, onMarkPaid, onOverride }) {

  const [selYear, setSelYear] = useState(years[0] || "");
  const [selMonth, setSelMonth] = useState("");
  const [expandedMember, setExpandedMember] = useState(null);

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // months for selected year
  const monthsForYear = sortedMonths.filter(m => m.startsWith(selYear));

  // When year changes, reset month
  const handleYearChange = (y) => { setSelYear(y); setSelMonth(""); setExpandedMember(null); };
  const handleMonthChange = (m) => { setSelMonth(m); setExpandedMember(null); };

  return (
    <div>
      {/* Year pills */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Year</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {years.map(y => (
            <button key={y} onClick={() => handleYearChange(y)}
              style={{ padding: "7px 18px", borderRadius: 20, border: `1px solid ${selYear===y ? "#c8f53b" : "#2a2a2a"}`, background: selYear===y ? "rgba(200,245,59,0.1)" : "#111", color: selYear===y ? "#c8f53b" : "#888", fontWeight: selYear===y ? 700 : 400, fontSize: 14, cursor: "pointer", fontFamily: "'Bebas Neue',cursive", letterSpacing: 1 }}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Month pills */}
      {selYear && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Month</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {monthsForYear.map(mo => {
              const moName = MONTH_NAMES[parseInt(mo.split("-")[1])-1];
              const moTotal = members.reduce((s,m) => s + getMemberMonthFine(m.id, mo), 0);
              return (
                <button key={mo} onClick={() => handleMonthChange(selMonth===mo ? "" : mo)}
                  style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${selMonth===mo ? "#c8f53b" : "#2a2a2a"}`, background: selMonth===mo ? "rgba(200,245,59,0.1)" : "#111", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 16, color: selMonth===mo ? "#c8f53b" : "#f0ede6", letterSpacing: 1 }}>{moName}</div>
                  {moTotal > 0 && <div style={{ fontSize: 9, color: "#ff5555", fontFamily: "'DM Mono',monospace" }}>₹{moTotal.toLocaleString("en-IN")}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Members for selected month */}
      {selMonth && (() => {
        const moName = MONTH_NAMES[parseInt(selMonth.split("-")[1])-1];
        const moTotal = members.reduce((s,m) => s + getMemberMonthFine(m.id, selMonth), 0);
        const moPaid = members.reduce((s,m) => {
          const memberPaid = Object.keys(finePayments)
            .filter(k => k.startsWith(`${m.id}__`) && finePayments[k]?.paid)
            .reduce((ps, k) => {
              const wk = k.split("__")[1];
              if (!wk?.includes(selMonth.replace("-","W").substring(0,7))) return ps;
              return ps + getMemberMonthFine(m.id, selMonth);
            }, 0);
          return s + memberPaid;
        }, 0);

        return (
          <div>
            {/* Month header */}
            <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, color: "#c8f53b", letterSpacing: 1, marginBottom: 4 }}>
                {moName} {selYear}
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                <span style={{ color: "#ff5555" }}>Total fines: <b>₹{moTotal.toLocaleString("en-IN")}</b></span>
                <span style={{ color: "#00b894" }}>Paid: <b>₹{moPaid.toLocaleString("en-IN")}</b></span>
                <span style={{ color: "#888" }}>Unpaid: <b>₹{Math.max(0, moTotal-moPaid).toLocaleString("en-IN")}</b></span>
              </div>
            </div>

            {/* Each member */}
            {members.map((m, idx) => {
              const mFine = getMemberMonthFine(m.id, selMonth);
              const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
              const isExpanded = expandedMember === m.id;

              // Collect all weeks in this month for this member
              const memberWeeks = [...new Set(
                Object.keys(dayLogs)
                  .filter(k => k.startsWith(`${m.id}__`) && k.split("__")[2]?.startsWith(selMonth))
                  .map(k => { try { return getWeekKey(new Date(k.split("__")[2])); } catch { return null; } })
                  .filter(Boolean)
              )].sort();

              // Check if any week is paid
              const anyPaid = memberWeeks.some(wk => finePayments[`${m.id}__${wk}`]?.paid);
              const allPaid = memberWeeks.length > 0 && memberWeeks.every(wk => finePayments[`${m.id}__${wk}`]?.paid);

              return (
                <div key={m.id} style={{ background: "#111", border: `1px solid ${mFine > 0 ? (allPaid ? "rgba(0,184,148,0.3)" : "rgba(255,85,85,0.3)") : "#1e1e1e"}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                  {/* Member row — tap to expand */}
                  <div onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{mGoals.length} goals · {memberWeeks.length} week{memberWeeks.length!==1?"s":""} logged</div>
                    </div>
                    <div style={{ textAlign: "right", marginRight: 6 }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: mFine===0 ? "#c8f53b" : allPaid ? "#00b894" : "#ff5555" }}>
                        ₹{mFine.toLocaleString("en-IN")}
                      </div>
                      {mFine > 0 && <div style={{ fontSize: 9, color: allPaid ? "#00b894" : "#ff5555" }}>{allPaid ? "PAID ✓" : anyPaid ? "PART PAID" : "UNPAID"}</div>}
                    </div>
                    <div style={{ color: "#555", fontSize: 14 }}>{isExpanded ? "▲" : "▼"}</div>
                  </div>

                  {/* Expanded: per-goal, per-week breakdown */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #1e1e1e", padding: "10px 14px" }}>
                      {/* Per-week paid toggle */}
                      {mFine > 0 && memberWeeks.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Week-by-week payment</div>
                          {memberWeeks.map(wk => {
                            const wkFine = goals.filter(g=>g.memberId===m.id&&g.active!==false)
                              .reduce((s,g)=>s+calcFine({goal:g,weekKey:wk,dayLogs,override:fines[`${m.id}__${wk}__${g.id}`]}),0);
                            const wkPaid = finePayments[`${m.id}__${wk}`]?.paid;
                            const wDates = getWeekDates(wk);
                            return (
                              <div key={wk} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#0d0d0d", borderRadius: 8, marginBottom: 6 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{wk}</div>
                                  <div style={{ fontSize: 10, color: "#666" }}>{formatDate(wDates[0])} – {formatDate(wDates[6])}</div>
                                </div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: wkFine>0 ? (wkPaid?"#00b894":"#ff5555") : "#c8f53b", fontWeight: 700 }}>
                                  ₹{wkFine.toLocaleString("en-IN")}
                                </div>
                                {wkFine > 0 && isAdmin && (
                                  <button onClick={e => { e.stopPropagation(); onMarkPaid(m.id, wk, !wkPaid); }}
                                    style={{ fontSize: 10, padding: "4px 10px", borderRadius: 7, border: "none", fontWeight: 700, cursor: "pointer",
                                      background: wkPaid ? "rgba(255,85,85,0.15)" : "rgba(0,184,148,0.15)",
                                      color: wkPaid ? "#ff5555" : "#00b894" }}>
                                    {wkPaid ? "Unpaid" : "Mark Paid"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Per-goal breakdown */}
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Goal breakdown</div>
                      {mGoals.map(g => {
                        const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[8];
                        const detail = getGoalMonthDetail(m.id, g.id, selMonth);
                        if (!detail.weeks.length) return null;
                        return (
                          <div key={g.id} style={{ background: "#0d0d0d", borderRadius: 8, padding: "9px 12px", marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: detail.weeks.length > 0 ? 6 : 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.icon} {g.name}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: detail.fine>0?"#ff5555":"#c8f53b", fontWeight: 700 }}>
                                ₹{detail.fine.toLocaleString("en-IN")}
                              </span>
                            </div>
                            {detail.weeks.map(w => {
                              const wDates = getWeekDates(w.wk);
                              return (
                                <div key={w.wk} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", padding: "2px 0", borderTop: "1px solid #1a1a1a", marginTop: 3 }}>
                                  <span>{formatDate(wDates[0])}–{formatDate(wDates[6])}</span>
                                  <span>{w.doneDays}/{g.weeklyTarget} done</span>
                                  <span style={{ color: w.fine>0?"#ff5555":"#666" }}>
                                    {w.override?.overridden ? <span style={{color:"#ffb800"}}>⚡ ₹{w.fine}</span> : w.fine>0?`₹${w.fine}`:"—"}
                                  </span>
                                  {isAdmin && w.fine > 0 && !w.override?.overridden && (
                                    <button onClick={e=>{e.stopPropagation();onOverride(m.id,w.wk,g.id,g.name,m.name,w.fine);}}
                                      style={{fontSize:9,padding:"1px 6px",borderRadius:4,border:"1px solid rgba(255,184,0,0.3)",background:"transparent",color:"#ffb800",cursor:"pointer"}}>
                                      Override
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {mFine === 0 && <div style={{ fontSize: 13, color: "#555", textAlign: "center", padding: "8px 0" }}>✓ No fines this month</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {!selMonth && selYear && (
        <div style={{ textAlign: "center", padding: "28px 0", color: "#555", fontSize: 13 }}>
          Select a month above to see detailed fines
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── AUTH STATE ──────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(undefined); // undefined=loading
  const [userDoc, setUserDoc] = useState(null);

  // ── DATA STATE ──────────────────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [hobbies, setHobbies] = useState([]);
  const [weekLogs, setWeekLogs] = useState({});
  const [dayLogs, setDayLogs] = useState({});
  const [hobbyLogs, setHobbyLogs] = useState({});
  const [fines, setFines] = useState({});
  const [finePayments, setFinePayments] = useState({});
  const [activity, setActivity] = useState([]);
  const [banter, setBanter] = useState([]);
  const [months, setMonths] = useState([]);
  const [weekNotes, setWeekNotes] = useState({});
  const [settings, setSettings] = useState({ groupName: "FitPact Squad", appUrl: "fitpact-xi.vercel.app", adminPin: "1234", startDate: new Date().toISOString() });
  const [users, setUsers] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── UI STATE ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [confetti, setConfetti] = useState(false);
  const [celebration, setCelebration] = useState(null);

  // modals
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [addGoalForMember, setAddGoalForMember] = useState(null);
  const [editGoal, setEditGoal] = useState(null);
  const [addHobbyOpen, setAddHobbyOpen] = useState(false);
  const [addHobbyForMember, setAddHobbyForMember] = useState(null);
  const [editHobby, setEditHobby] = useState(null);
  const [weekLogModal, setWeekLogModal] = useState(null); // {goal, weekKey, log}
  const [dayLogModal, setDayLogModal] = useState(null); // {goal, date, log, memberId}
  const [viewingMember, setViewingMember] = useState(null); // for admin to browse other members
  const [weekOffset, setWeekOffset] = useState(0); // 0=this week, -1=last week etc.
  const [hobbyLogModal, setHobbyLogModal] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null); // {memberId, weekKey, goalId, memberName, goalName}
  const [approveModal, setApproveModal] = useState(null); // pending user
  const [approveMemberId, setApproveMemberId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterText, setBanterText] = useState("");
  const [memberDetailOpen, setMemberDetailOpen] = useState(null);
  const [calendarMemberId, setCalendarMemberId] = useState(null);

  const weekKey = (() => {
    if (weekOffset === 0) return currentWeekKey();
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getWeekKey(d);
  })();
  const isCurrentWeek = weekOffset === 0;
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast({ msg: "", type: "" }), 3000); };
  const isAdmin = userDoc?.isAdmin || false;
  // Only the original admin (earliest createdAt) can promote others
  const sortedAdminUsers = [...users].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const originalAdminUid = sortedAdminUsers[0]?.id;
  const isSuperAdmin = authUser?.uid === originalAdminUid && isAdmin;
  const myMember = members.find(m => m.id === userDoc?.memberId);

  // ── AUTH LISTENER ───────────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        let ud = await getUser(user.uid);
        if (!ud) {
          // Check if this is the very first user — make them admin automatically
          const { getDocs, collection: col } = await import("firebase/firestore");
          const { db: fdb } = await import("./firebase");
          const existingUsers = await getDocs(col(fdb, "users"));
          const isFirstUser = existingUsers.empty;
          ud = { uid: user.uid, email: user.email, displayName: user.displayName, isPending: false, isAdmin: isFirstUser, createdAt: new Date().toISOString() };
          await saveUser(user.uid, ud);
        }
        setUserDoc(ud);
      } else {
        setUserDoc(null);
      }
    });
  }, []);

  // ── DATA LISTENERS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;
    const unsubs = [
      listenSettings(s => { if (s) setSettings(prev => ({ ...prev, ...s })); setDataLoaded(true); }),
      listenUsers(setUsers),
      listenMembers(setMembers),
      listenGoals(setGoals),
      listenHobbies(setHobbies),
      listenWeekLogs(setWeekLogs),
      listenDayLogs(setDayLogs),
      listenHobbyLogs(setHobbyLogs),
      listenFines(setFines),
      listenFinePayments(setFinePayments),
      listenActivity(setActivity),
      listenBanter(setBanter),
      listenMonths(setMonths),
      listenWeekNotes(setWeekNotes),
    ];
    return () => unsubs.forEach(u => u());
  }, [authUser]);

  // Keep userDoc ALWAYS in sync with live users list — picks up memberId changes instantly
  useEffect(() => {
    if (authUser && users.length) {
      const ud = users.find(u => u.id === authUser.uid);
      if (ud) setUserDoc(ud);
    }
  }, [users, authUser]);

  // Also re-fetch userDoc directly on mount in case users listener hasn't fired yet
  useEffect(() => {
    if (!authUser) return;
    getUser(authUser.uid).then(ud => { if (ud) setUserDoc(ud); });
  }, [authUser]);

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const getLog = (memberId, goalId, wk) => weekLogs[`${memberId}__${goalId}__${wk}`];
  const getHLog = (memberId, hobbyId, wk) => hobbyLogs[`${memberId}__${hobbyId}__${wk}`];
  const getFine = (memberId, goalId, wk) => fines[`${memberId}__${wk}__${goalId}`];

  // ── FINE HELPERS — all use the single calcFine from utils.js ────────────────
  const getGoalFine = useCallback((goal, wk) => {
    const override = getFine(goal.memberId, goal.id, wk);
    return calcFine({ goal, weekKey: wk, dayLogs, override });
  }, [dayLogs, fines]);

  const calcMaxGoalFine = useCallback((goal) => calcMaxFine({ goal }), []);

  const calcMaxMemberFine = useCallback((memberId) =>
    goals.filter(g => g.memberId === memberId && g.active !== false)
      .reduce((sum, g) => sum + calcMaxFine({ goal: g }), 0)
  , [goals]);

  const calcMemberWeekFine = useCallback((memberId, wk) =>
    goals.filter(g => g.memberId === memberId && g.active !== false)
      .reduce((sum, g) => sum + getGoalFine(g, wk), 0)
  , [goals, getGoalFine]);

  const getMemberWeekFineDetail = useCallback((memberId, wk) =>
    goals.filter(g => g.memberId === memberId && g.active !== false).map(g => {
      const override = getFine(memberId, g.id, wk);
      const fine = calcFine({ goal: g, weekKey: wk, dayLogs, override });
      const maxFine = calcMaxFine({ goal: g });
      const doneDays = getDoneDays(g, wk, dayLogs);
      return { goal: g, fine, override, maxFine, doneDays,
               rawFine: calcFine({ goal: g, weekKey: wk, dayLogs, override: null }) };
    })
  , [goals, dayLogs, fines]);

  const isWeekPaid = (memberId, wk) => finePayments[`${memberId}__${wk}`]?.paid;

  // ── ACTIONS ──────────────────────────────────────────────────────────────────
  const handleSaveMember = async (form, id) => {
    const mid = id || `m_${uid()}`;
    await saveMember(mid, { ...form, ...(id ? {} : { createdAt: new Date().toISOString() }) });
    setAddMemberOpen(false); setEditMember(null);
    showToast(id ? "Member updated ✅" : `${form.name} added 💪`);
  };

  const handleDeleteMember = async (id, name) => {
    // Double confirmation — hard to trigger accidentally
    if (!confirm(`⚠️ Remove ${name} from the squad?

This will delete their profile and ALL their goals and logs permanently.

This CANNOT be undone.`)) return;
    const confirm2 = window.prompt(`Type "${name}" to confirm deletion:`);
    if (confirm2?.trim() !== name) { showToast("Deletion cancelled — name didn't match", "error"); return; }
    await deleteMember(id);
    showToast(`${name} removed`);
  };

  const handleSaveGoal = async (form, id) => {
    const gid = id || `g_${uid()}`;
    await saveGoal(gid, { ...form, active: true, ...(id ? {} : { createdAt: new Date().toISOString() }) });
    setAddGoalOpen(false); setEditGoal(null); setAddGoalForMember(null);
    showToast(id ? "Goal updated ✅" : "Goal added 🎯");
    if (!id) await postActivity({ type: "goal_added", memberName: members.find(m => m.id === form.memberId)?.name || "", goalName: form.name });
  };

  const handleSaveHobby = async (form, id) => {
    const hid = id || `h_${uid()}`;
    await saveHobby(hid, { ...form, active: true, ...(id ? {} : { createdAt: new Date().toISOString() }) });
    setAddHobbyOpen(false); setEditHobby(null); setAddHobbyForMember(null);
    showToast(id ? "Hobby updated ✅" : "Hobby added 🎸");
    if (!id) await postActivity({ type: "hobby_added", memberName: members.find(m => m.id === form.memberId)?.name || "", hobbyName: form.name });
  };

  const handleWeekLog = async (data) => {
    const { goal, weekKey: wk, memberId } = weekLogModal;
    await saveWeekLog(memberId, goal.id, wk, data);
    setWeekLogModal(null);
    const fine = calcFine({ goal, weekKey: wk, dayLogs, override: null });
    const memberName = myMember?.name || "";
    await postActivity({
      type: "week_log",
      memberName,
      goalName: goal.name,
      completed: data.completed,
      fine,
      weekKey: wk,
    });
    if (data.completed === "yes" && fine === 0) {
      setConfetti(true);
      setCelebration(CELEBRATIONS.perfect);
    } else if (data.completed === "yes") {
      showToast("Logged! 💪");
    } else if (data.completed === "partial") {
      showToast("Partial logged ⚠️");
    } else {
      showToast("Logged. Bounce back next week! 💪");
    }
  };

  const handleDayLog = async (data) => {
    if (!dayLogModal) return;
    const { goal, date, memberId } = dayLogModal;
    // Store per-day log keyed by memberId__goalId__date
    const { db } = await import("./firebase");
    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const id = `${memberId}__${goal.id}__${date}`;
    await setDoc(doc(db, "dayLogs", id), {
      memberId, goalId: goal.id, date, ...data, updatedAt: serverTimestamp()
    }, { merge: true });

    // Recompute weekly summary from day logs and save as weekLog too
    const wk = getWeekKey(new Date(date));
    const weekDts = getWeekDates(wk);
    // count done days for tick goals
    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category);
    const isNumeric = (goal.logType || cat?.logType) === "number";

    setDayLogModal(null);
    const activeMember = members.find(m => m.id === memberId);
    await postActivity({
      type: "week_log",
      memberName: activeMember?.name || "",
      goalName: goal.name,
      completed: data.done ? "yes" : "no",
      fine: 0,
      weekKey: wk,
    });
    showToast(data.done ? "✅ Logged!" : "❌ Marked missed");
  };

  const handleHobbyLog = async (data) => {
    const { hobby, weekKey: wk, memberId } = hobbyLogModal;
    await saveHobbyLog(memberId, hobby.id, wk, data);
    setHobbyLogModal(null);
    await postActivity({ type: "hobby_log", memberName: myMember?.name || "", hobbyName: hobby.name, sessions: data.sessions, weekKey: wk });
    showToast(`${data.sessions} session${data.sessions !== 1 ? "s" : ""} logged 🎸`);
  };

  const handleOverride = async (reason, customAmount) => {
    const { memberId, weekKey: wk, goalId, memberName, goalName, adminName } = overrideModal;
    await adminOverrideFine(memberId, wk, goalId, reason, adminName, customAmount);
    await postActivity({ type: "fine_override", adminName, memberName, goalName, reason, customAmount, weekKey: wk });
    setOverrideModal(null);
    showToast(`Fine set to ₹${customAmount.toLocaleString("en-IN")} ✅`, "info");
  };

  const handleApprove = async () => {
    if (!approveMemberId) { alert("Select which member this person is"); return; }
    await approveUser(approveModal.id, approveMemberId);
    setApproveModal(null); setApproveMemberId("");
    showToast("User approved ✅");
    await postActivity({ type: "member_joined", memberName: members.find(m => m.id === approveMemberId)?.name || approveModal.email });
  };

  // Auto-close month on 1st of new month (runs once when data loads)
  useEffect(() => {
    if (!isAdmin || !members.length || !goals.length) return;
    const mk = getMonthKey();
    const alreadyClosed = months.some(m => m.id === mk);
    if (alreadyClosed) return;
    // Check if we're in a new month (compare to last closed month)
    const lastClosed = months[0]?.id;
    if (!lastClosed || lastClosed < mk) {
      // It's a new month — auto-archive monthly goals and record
      const monthlyGoals = goals.filter(g => g.goalType === "monthly" && g.active);
      const totalF = members.reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0);
      saveMonth(mk, { closedAt: new Date().toISOString(), closedBy: "Auto", totalFines: totalF, startDate: new Date().toISOString() });
      monthlyGoals.forEach(g => saveGoal(g.id, { ...g, active: false, archivedAt: new Date().toISOString() }));
      if (monthlyGoals.length > 0) {
        postActivity({ type: "month_closed", closedBy: "Auto", monthKey: mk });
        showToast("New month started! Monthly goals archived 🔄");
      }
    }
  }, [isAdmin, months.length, members.length, goals.length]);

  const handleBanter = async () => {
    if (!banterText.trim()) return;
    const name = myMember?.name || authUser?.displayName || "Anonymous";
    await postBanter({ text: banterText.trim(), author: name });
    await postActivity({ type: "banter", memberName: name, preview: banterText.slice(0, 60) });
    setBanterText(""); setBanterOpen(false);
    showToast("Posted 🗣️");
  };

  // ── ACTIVITY ICON ────────────────────────────────────────────────────────────
  const actIcon = (type) => ({
    week_log: "📋", hobby_log: "🎸", fine_override: "⚡", member_joined: "👋",
    goal_added: "🎯", hobby_added: "🎸", month_closed: "🔄", banter: "💬",
  }[type] || "📌");

  const actText = (a) => {
    if (a.type === "week_log") return `${a.memberName} logged "${a.goalName}" — ${a.completed === "yes" ? "✅ nailed it" : a.completed === "partial" ? "⚠️ partial" : "❌ missed it"}${a.fine > 0 ? ` · ₹${a.fine} fine` : ""}`;
    if (a.type === "hobby_log") return `${a.memberName} did ${a.sessions} session${a.sessions !== 1 ? "s" : ""} of ${a.hobbyName}`;
    if (a.type === "fine_override") return `${a.adminName} zeroed ${a.memberName}'s fine for "${a.goalName}" — ${a.reason}`;
    if (a.type === "member_joined") return `${a.memberName} joined the squad! 👋`;
    if (a.type === "goal_added") return `New goal added for ${a.memberName}: "${a.goalName}"`;
    if (a.type === "hobby_added") return `${a.memberName} started a new hobby: ${a.hobbyName}`;
    if (a.type === "month_closed") return `${a.closedBy} closed the month — fresh start! 🔄`;
    if (a.type === "banter") return `${a.memberName}: "${a.preview}${a.preview?.length >= 60 ? "..." : ""}"`;
    return "Activity update";
  };

  // ── LEADERBOARD ──────────────────────────────────────────────────────────────
  const leaderboard = [...members]
    .map(m => ({ ...m, fine: calcMemberWeekFine(m.id, weekKey) }))
    .sort((a, b) => a.fine - b.fine);

  // Check if whole squad is clean this week — celebrate!
  const allCleanThisWeek = members.length > 1 && leaderboard.every(m => m.fine === 0);
  const prevAllClean = useRef(false);
  useEffect(() => {
    if (allCleanThisWeek && !prevAllClean.current && members.length > 0) {
      setConfetti(true);
      setCelebration(CELEBRATIONS.allClean);
    }
    prevAllClean.current = allCleanThisWeek;
  }, [allCleanThisWeek]);

  const pendingUsers = users.filter(u => u.isPending);

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (authUser === undefined) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: C.lime, letterSpacing: 3 }}>LOADING...</div>
    </div>
  );

  if (!authUser) return <AuthScreen onAuth={u => setAuthUser(u)} />;
  // No pending screen — auto-approved on sign-up
  if (!dataLoaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: C.lime, letterSpacing: 3 }}>SYNCING DATA...</div>
      <div style={{ fontSize: 12, color: C.muted }}>Connecting to Firebase</div>
    </div>
  );

  // ── MAIN RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans',sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box; -webkit-tap-highlight-color: transparent;}
        ::-webkit-scrollbar{width:0} body{margin:0}
        @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,select:focus,textarea:focus{border-color:#c8f53b!important;outline:none}
        .tab-b{background:transparent;border:none;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer;padding:7px 9px;border-radius:7px;transition:all .15s;white-space:nowrap;color:#666;display:flex;flex-direction:column;align-items:center;gap:2px}
        .tab-b.on{background:rgba(200,245,59,0.15);color:#c8f53b}
        .tab-b:active{transform:scale(0.95)}
        .hov:active{opacity:0.7}
        .btn-wa{background:#25d366;color:#fff;border:none;border-radius:10px;padding:12px 18px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;width:100%;justify-content:center}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", position: "sticky", top: 0, background: "rgba(10,10,10,0.97)", backdropFilter: "blur(14px)", zIndex: 100, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, letterSpacing: 2, color: C.lime }}>FIT</span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, letterSpacing: 2 }}>PACT</span>
          </div>
          {myMember && <Av name={myMember.name} emoji={myMember.emoji} idx={members.findIndex(m => m.id === myMember.id)} size={30} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingUsers.length > 0 && isAdmin && (
            <button onClick={() => setApproveModal(pendingUsers[0])} style={{ background: "rgba(255,184,0,0.15)", border: "1px solid rgba(255,184,0,0.3)", color: C.amber, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
              {pendingUsers.length} pending
            </button>
          )}
          {isAdmin && <span style={{ fontSize: 10, color: C.lime, background: "rgba(200,245,59,0.1)", border: "1px solid rgba(200,245,59,0.25)", borderRadius: 6, padding: "3px 7px" }}>ADMIN</span>}
          <button onClick={() => setSettingsOpen(true)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: 2 }}>⚙️</button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 2, padding: "8px 10px", borderBottom: `1px solid ${C.border}`, overflowX: "auto", background: C.bg, position: "sticky", top: 57, zIndex: 99 }}>
        {[["dashboard","📊","Board"],["myweek","📋","My Week"],["calendar","📅","Calendar"],["squad","👥","Squad"],["fines","💸","Fines"],["hobbies","🎸","Hobbies"],["leaderboard","🏆","Scores"],["feed","📡","Feed"],["banter","🗣️","Banter"],["members","⚙️","Members"]].map(([id, icon, lbl]) => (
          <button key={id} className={`tab-b ${tab === id ? "on" : ""}`} onClick={() => { setTab(id); if (id !== "myweek") setWeekOffset(0); }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span>{lbl}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 14px 80px", animation: "slideIn .2s ease" }}>

        {/* ════ DASHBOARD ════ */}
        {tab === "dashboard" && (
          <div>
            <DailyVibesCard />

            {/* ── MY ANALYTICS (personal card) ── */}
            {myMember && (() => {
              const myGoals = goals.filter(g => g.memberId === myMember.id && g.active !== false);
              const myWeekFine = calcMemberWeekFine(myMember.id, weekKey);
              const myMaxFine = calcMaxMemberFine(myMember.id);

              // Month-to-date stats
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const allDayLogKeys = Object.keys(dayLogs).filter(k => k.startsWith(`${myMember.id}__`));
              const monthDone = allDayLogKeys.filter(k => {
                const d = k.split("__")[2];
                return d && new Date(d) >= monthStart && (dayLogs[k]?.done || dayLogs[k]?.value > 0);
              }).length;
              const monthTotal = allDayLogKeys.filter(k => {
                const d = k.split("__")[2];
                return d && new Date(d) >= monthStart;
              }).length;

              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 16, color: C.lime, letterSpacing: 1, marginBottom: 10 }}>
                    MY ANALYTICS
                  </div>

                  {/* Week + Month stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[
                      { l: "Week Fine", v: `₹${myWeekFine.toLocaleString("en-IN")}`, c: myWeekFine > 0 ? C.red : C.lime },
                      { l: "Max/Wk", v: `₹${myMaxFine.toLocaleString("en-IN")}`, c: C.muted },
                      { l: "MTD Done", v: monthTotal > 0 ? `${monthDone}/${monthTotal}` : "—", c: C.lime },
                      { l: "MTD %", v: monthTotal > 0 ? `${Math.round((monthDone/monthTotal)*100)}%` : "—", c: monthDone/Math.max(monthTotal,1) > 0.7 ? C.lime : C.amber },
                    ].map(p => (
                      <div key={p.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px" }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{p.l}</div>
                        <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 18, color: p.c, lineHeight: 1 }}>{p.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per-goal this week */}
                  {myGoals.map(goal => {
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[8];
                    const fine = getGoalFine(goal, weekKey);
                    const maxFine = calcMaxGoalFine(goal);
                    const doneDays = getDoneDays(goal, weekKey, dayLogs);
                    const pct = maxFine > 0 ? Math.max(0, 100 - Math.round((fine/maxFine)*100)) : 100;
                    const fClr = fine === 0 ? C.green : fine < maxFine * 0.5 ? C.amber : C.red;
                    return (
                      <div key={goal.id} style={{ background: "#0d0d0d", border: `1px solid ${fine > 0 ? "rgba(255,85,85,0.25)" : C.border}`, borderRadius: 9, padding: "9px 12px", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{cat.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{goal.name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>{doneDays}/{goal.weeklyTarget} {cat.defaultUnit} this week</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: fClr, fontWeight: 700 }}>
                              {fine > 0 ? `₹${fine.toLocaleString("en-IN")}` : "✓"}
                            </div>
                          </div>
                        </div>
                        {maxFine > 0 && (
                          <div style={{ marginTop: 6, height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: fClr, borderRadius: 2, transition: "width 0.4s" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── SQUAD THIS WEEK ── */}
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, marginBottom: 10 }}>SQUAD — {weekKey}</div>
            {!members.length ? (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <div style={{ marginBottom: 12 }}>No members yet</div>
                {isAdmin && <button style={mkBP(false)} onClick={() => setAddMemberOpen(true)}>Add Members →</button>}
              </div></Card>
            ) : leaderboard.map((m, rank) => {
              const RANK = ["🥇","🥈","🥉"];
              const mGoalsAll = goals.filter(g => g.memberId === m.id && g.active !== false);

              // Per-member week summary
              const mDetails = getMemberWeekFineDetail(m.id, weekKey);
              return (
                <Card key={m.id} highlight={rank === 0 && m.fine === 0} style={{ marginBottom: 10 }}>
                  {/* Header */}
                  <div className="hov" onClick={() => setMemberDetailOpen(m)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: mGoalsAll.length ? 10 : 0 }}>
                    <div style={{ fontSize: 20, width: 28, flexShrink: 0 }}>{RANK[rank] || rank + 1}</div>
                    <Av name={m.name} emoji={m.emoji} idx={members.findIndex(x => x.id === m.id)} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name} {m.id === myMember?.id ? <span style={{ color: C.lime, fontSize: 10 }}>(you)</span> : ""}</div>
                      <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fitnessGoal || "No goal set"}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: m.fine > 0 ? C.red : C.lime }}>{m.fine > 0 ? `₹${m.fine.toLocaleString("en-IN")}` : "✓ clean"}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{isWeekPaid(m.id, weekKey) ? "✅ paid" : m.fine > 0 ? "⏳ unpaid" : ""}</div>
                    </div>
                  </div>
                  {/* Per-goal mini summary */}
                  {mDetails.map(({ goal, fine, doneDays }) => {
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[8];
                    return (
                      <div key={goal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#0d0d0d", borderRadius: 6, marginBottom: 3, fontSize: 12 }}>
                        <span style={{ color: C.text2 }}>{cat.icon} {goal.name}</span>
                        <span style={{ color: C.muted, fontSize: 11 }}>{doneDays}/{goal.weeklyTarget}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: fine > 0 ? C.red : C.green, fontWeight: 600 }}>
                          {fine > 0 ? `₹${fine.toLocaleString("en-IN")}` : "✓"}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              );
            })}

            {members.length > 0 && (
              <button className="btn-wa" style={{ marginTop: 14 }} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildWAMsg(members, goals, weekLogs, settings, weekKey))}`, "_blank")}>
                📱 Share This Week on WhatsApp
              </button>
            )}
          </div>
        )}

        {/* ════ MY WEEK ════ */}
        {tab === "myweek" && (
          <div>
            {/* Week navigator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setWeekOffset(o => o - 1)}
                style={{ background: C.card, border: `1px solid ${C.border2}`, color: C.text, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>‹</button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: isCurrentWeek ? C.lime : C.text }}>
                  {isCurrentWeek ? "THIS WEEK" : weekOffset === -1 ? "LAST WEEK" : `${Math.abs(weekOffset)} WEEKS AGO`}
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>
                  {(() => { const d = getWeekDates(weekKey); return `${formatDate(d[0])} — ${formatDate(d[6])}`; })()}
                </div>
              </div>
              <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
                disabled={isCurrentWeek}
                style={{ background: isCurrentWeek ? "#0a0a0a" : C.card, border: `1px solid ${isCurrentWeek ? C.border : C.border2}`, color: isCurrentWeek ? "#333" : C.text, borderRadius: 8, padding: "7px 14px", cursor: isCurrentWeek ? "default" : "pointer", fontSize: 18, flexShrink: 0 }}>›</button>
            </div>

            {/* Past week — quiet indicator + back button */}
            {!isCurrentWeek && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button onClick={() => setWeekOffset(0)} style={{ fontSize: 11, color: C.lime, background: "transparent", border: "none", cursor: "pointer", fontWeight: 700 }}>Back to now →</button>
              </div>
            )}

            {/* Member switcher — always visible for admins */}
            {isAdmin && members.length > 1 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
                {members.map((m, idx) => {
                  const active = (viewingMember || myMember)?.id === m.id;
                  return (
                    <button key={m.id} onClick={() => setViewingMember(m.id === myMember?.id ? null : m)}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 20, flexShrink: 0, cursor: "pointer", border: `1px solid ${active ? C.lime : C.border2}`, background: active ? "rgba(200,245,59,0.1)" : "#111" }}>
                      <Av name={m.name} emoji={m.emoji} idx={idx} size={22} />
                      <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? C.lime : C.muted }}>{m.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resolve which member we're viewing */}
            {(() => {
              const activeMem = viewingMember || myMember;
              if (!activeMem) return (
                <Card>
                  <div style={{ textAlign: "center", padding: "20px 0 14px", color: C.muted, fontSize: 14, marginBottom: 14 }}>
                    {isAdmin ? "Pick a member above to log for:" : "Your account isn't linked yet. Contact your admin."}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {members.map((m, idx) => (
                        <button key={m.id} onClick={async () => {
                          await saveUser(authUser.uid, { memberId: m.id });
                          const ud = await getUser(authUser.uid);
                          if (ud) setUserDoc(ud);
                          showToast(`Linked as ${m.name} ✅`);
                        }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                          <Av name={m.name} emoji={m.emoji} idx={idx} size={36} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{m.fitnessGoal}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              );

              const weekDates = getWeekDates(weekKey);
              const todayStr = today();
              const memberFine = calcMemberWeekFine(activeMem.id, weekKey);
              const memberIdx = members.findIndex(m => m.id === activeMem.id);
              const activeMemberGoals = goals.filter(g => g.memberId === activeMem.id && g.active !== false);
              const activeMemberHobbies = hobbies.filter(h => h.memberId === activeMem.id && h.active !== false);

              return (
                <>
                  {/* Member card */}
                  <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <Av name={activeMem.name} emoji={activeMem.emoji} idx={memberIdx} size={48} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{activeMem.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{activeMem.fitnessGoal}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: memberFine > 0 ? C.red : C.lime }}>
                        ₹{memberFine.toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>fines this week</div>
                    </div>
                  </Card>

                  {/* Day-of-week header strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 16 }}>
                    {weekDates.map(d => (
                      <div key={d} style={{ textAlign: "center", padding: "6px 2px", borderRadius: 7, background: d === todayStr ? "rgba(200,245,59,0.1)" : "#111", border: `1px solid ${d === todayStr ? "rgba(200,245,59,0.3)" : C.border}` }}>
                        <div style={{ fontSize: 9, color: C.muted }}>{getDayLabel(d)}</div>
                        <div style={{ fontSize: 10, color: d === todayStr ? C.lime : C.text2, fontWeight: d === todayStr ? 700 : 400 }}>{formatDate(d).split(" ")[0]}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fitness goals with day dots */}
                  {activeMemberGoals.length === 0 ? (
                    <Card><div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 13 }}>No goals set — ask admin to add some</div></Card>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Fitness Goals</div>
                      {activeMemberGoals.map(goal => {
                        const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[8];
                        const override = getFine(activeMem.id, goal.id, weekKey);
                        const weekLog = getLog(activeMem.id, goal.id, weekKey);
                        const fine = getGoalFine(goal, weekKey);
                        const unit = goal.customUnit || cat.defaultUnit;

                        const doneDays = getDoneDays(goal, weekKey, dayLogs);

                        return (
                          <div key={goal.id} style={{ background: "#0d0d0d", border: `1px solid ${fine > 0 ? "rgba(255,85,85,0.3)" : C.border}`, borderRadius: 11, padding: "12px 13px", marginBottom: 10 }}>
                            {/* Goal header with running fine counter */}
                            {(() => {
                              const maxGoalFine = calcMaxGoalFine(goal);
                              const daysRequired = getDaysRequired(goal);
                              const dailyTgt = getDailyTarget(goal);
                              const isDailyNum = getGoalLogType(goal) === "number" && getGoalCadence(goal) === "daily";
                              // Only show progress bar if at least one day has been logged
                              const hasAnyLog = weekDates.some(d => dayLogs[`${activeMem.id}__${goal.id}__${d}`]);
                              const fineClr = fine === 0 && hasAnyLog ? C.green : fine === 0 ? C.muted : fine < maxGoalFine * 0.5 ? C.amber : C.red;
                              const saved = maxGoalFine > 0 && hasAnyLog ? maxGoalFine - fine : 0;
                              // Display target string
                              const targetStr = isDailyNum
                                ? `${dailyTgt.toLocaleString()} ${unit}/day · ${daysRequired}x/wk`
                                : `${goal.weeklyTarget} ${unit}/wk`;
                              return (
                                <div style={{ marginBottom: 10 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>{goal.name}</div>
                                      <div style={{ fontSize: 10, color: C.muted }}>Target: {targetStr} · ₹{goal.fineAmount}/miss</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, color: fineClr, lineHeight: 1 }}>
                                        ₹{fine.toLocaleString("en-IN")}
                                      </div>
                                      <div style={{ fontSize: 9, color: C.muted }}>
                                        {!hasAnyLog ? "not logged yet" : fine === 0 ? "✓ no fine" : `of ₹${maxGoalFine.toLocaleString("en-IN")} max`}
                                      </div>
                                    </div>
                                  </div>
                                  {maxGoalFine > 0 && hasAnyLog && (
                                    <div>
                                      <div style={{ height: 4, background: "#1a1a1a", borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                                        <div style={{ height: "100%", width: `${Math.max(0, 100 - Math.round((fine/maxGoalFine)*100))}%`, background: fineClr, borderRadius: 3, transition: "width 0.4s ease" }} />
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted }}>
                                        <span>{doneDays}/{daysRequired} days done</span>
                                        {saved > 0 && <span style={{ color: C.green }}>₹{saved.toLocaleString("en-IN")} saved ✓</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Day dots — M T W T F S S */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                              {weekDates.map(date => {
                                const dl = dayLogs[`${activeMem.id}__${goal.id}__${date}`];
                                const isFuture = date > todayStr;
                                const isDone = dl?.done;
                                const hasValue = dl?.value != null && dl.value > 0;
                                const isLogged = isDone || hasValue;
                                const isMissed = dl && !isDone && !hasValue;

                                let bg = "#111";
                                let border = C.border2;
                                let textClr = C.muted;
                                if (isLogged) { bg = "rgba(200,245,59,0.15)"; border = C.lime; textClr = C.lime; }
                                if (isMissed) { bg = "rgba(255,85,85,0.1)"; border = "rgba(255,85,85,0.4)"; textClr = C.red; }
                                if (isFuture) { bg = "#0a0a0a"; border = "#1a1a1a"; textClr = "#333"; }

                                const canTap = !isFuture; // anyone can edit past entries
                                // grey-out unlogged days in past weeks
                                if (!isCurrentWeek && !isLogged && !isFuture) {
                                  textClr = "#444"; border = "#222";
                                }
                                return (
                                  <button key={date}
                                    disabled={!canTap}
                                    onClick={() => canTap && setDayLogModal({ goal, date, log: dl || null, memberId: activeMem.id })}
                                    title={isFuture ? "Future date" : isCurrentWeek ? "Tap to log" : "Tap to edit"}
                                    style={{ aspectRatio: "1", borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color: textClr, fontSize: 11, fontWeight: 700, cursor: canTap ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 2 }}>
                                    <span style={{ fontSize: 10 }}>{getDayLabel(date)[0]}</span>
                                    {hasValue && <span style={{ fontSize: 8 }}>{dl.value}</span>}
                                    {isLogged && !hasValue && <span style={{ fontSize: 8 }}>✓</span>}
                                    {isMissed && <span style={{ fontSize: 8 }}>✕</span>}
                                    {!isCurrentWeek && !isLogged && !isFuture && <span style={{ fontSize: 8 }}>—</span>}
                                  </button>
                                );
                              })}
                            </div>
                            {override?.overridden && <div style={{ fontSize: 10, color: C.amber, marginTop: 6 }}>⚡ Admin override: {override.overrideReason}</div>}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Hobbies */}
                  {activeMemberHobbies.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Hobbies</div>
                      {activeMemberHobbies.map(hobby => {
                        const hlog = getHLog(activeMem.id, hobby.id, weekKey);
                        const sug = HOBBY_SUGGESTIONS.find(s => s.id === hobby.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];
                        return (
                          <div key={hobby.id} style={{ background: "#0d0d0d", border: `1px solid ${C.border}`, borderRadius: 11, padding: "12px 13px", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 20 }}>{sug.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{hobby.name}</div>
                                <div style={{ fontSize: 11, color: C.muted }}>Since {formatDate(hobby.startDate)} · {hlog?.sessions || 0} sessions this week</div>
                              </div>
                            </div>
                            <button onClick={() => setHobbyLogModal({ hobby, weekKey, log: hlog || null, memberId: activeMem.id })}
                              style={{ ...mkBP(false, C.blue), fontSize: 13, padding: "9px", width: "100%", justifyContent: "center" }}>
                              {hlog ? `Edit — ${hlog.sessions} sessions logged` : "Log Sessions →"}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {/* Weekly Notes */}
                  {(() => {
                    const noteKey = `${activeMem.id}__${weekKey}`;
                    const existingNote = weekNotes[noteKey]?.text || "";
                    return (
                      <WeeklyNoteSection
                        key={noteKey}
                        initialNote={existingNote}
                        onSave={async (text) => { await saveWeekNote(activeMem.id, weekKey, text); showToast("Note saved ✅"); }}
                      />
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

                {/* ════ SQUAD ════ */}
        {tab === "squad" && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 14 }}>SQUAD THIS WEEK</div>
            {members.map((m, idx) => {
              const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
              const fine = calcMemberWeekFine(m.id, weekKey);
              return (
                <Card key={m.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: mGoals.length ? 12 : 0 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{m.fitnessGoal}</div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: fine > 0 ? C.red : C.green }}>
                      {fine > 0 ? `-₹${fine.toLocaleString("en-IN")}` : "✓ clean"}
                    </div>
                  </div>
                  {mGoals.map(goal => {
                    const log = getLog(m.id, goal.id, weekKey);
                    const override = getFine(m.id, goal.id, weekKey);
                    const gFine = getGoalFine(goal, weekKey);
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                    return (
                      <div key={goal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#0d0d0d", borderRadius: 7, marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: C.text2 }}>{cat.icon} {goal.name}</span>
                        <span style={{ color: C.muted, fontSize: 11 }}>
                          {log ? (log.completed === "yes" ? "✅" : log.completed === "partial" ? "⚠️" : "❌") : "⏳"}
                          {log?.note ? ` "${log.note.slice(0, 30)}${log.note.length > 30 ? "..." : ""}"` : ""}
                        </span>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: gFine > 0 ? C.red : C.muted, fontWeight: 600 }}>
                          {override?.overridden ? <span title={override.overrideReason}>⚡ ₹0</span> : gFine > 0 ? `₹${gFine.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        )}

        {/* ════ FINES ════ */}
        {tab === "fines" && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 6 }}>FINE LEDGER</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Live · {weekKey} · Tap a goal to override</div>

            {members.map((m, idx) => {
              const details = getMemberWeekFineDetail(m.id, weekKey);
              const totalFine = details.reduce((s, d) => s + d.fine, 0);
              const maxFine = calcMaxMemberFine(m.id);
              const paid = isWeekPaid(m.id, weekKey);
              const pct = maxFine > 0 ? Math.max(0, 100 - Math.round((totalFine / maxFine) * 100)) : 100;
              const fineColor = totalFine === 0 ? C.lime : totalFine < maxFine * 0.5 ? C.amber : C.red;

              return (
                <Card key={m.id} style={{ marginBottom: 12, borderColor: totalFine > 0 && !paid ? "rgba(255,85,85,0.3)" : paid ? "rgba(0,184,148,0.3)" : C.border }}>
                  {/* Member header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      {maxFine > 0 && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                          Max possible: ₹{maxFine.toLocaleString("en-IN")} · {pct}% saved
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: fineColor }}>
                        ₹{totalFine.toLocaleString("en-IN")}
                      </div>
                      {totalFine > 0 && isAdmin && (
                        <button onClick={() => paid ? markFineUnpaid(m.id, weekKey) : markFinePaid(m.id, weekKey, myMember?.name || "Admin")}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", background: paid ? "rgba(255,85,85,0.15)" : "rgba(0,184,148,0.15)", color: paid ? C.red : C.green, cursor: "pointer", fontWeight: 700 }}>
                          {paid ? "Mark Unpaid" : "Mark Paid ✓"}
                        </button>
                      )}
                      {paid && <Badge color={C.green}>PAID ✓</Badge>}
                    </div>
                  </div>

                  {/* Fine progress bar */}
                  {maxFine > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ height: 5, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: totalFine === 0 ? C.lime : totalFine < maxFine * 0.5 ? C.amber : C.red, borderRadius: 4, transition: "width 0.5s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted, marginTop: 3 }}>
                        <span>₹{maxFine.toLocaleString("en-IN")} max</span>
                        <span style={{ color: fineColor }}>₹{totalFine.toLocaleString("en-IN")} owed</span>
                      </div>
                    </div>
                  )}

                  {/* Per-goal breakdown */}
                  {details.map(({ goal, log, fine, override, rawFine, maxFine: gMax, currentFine }) => {
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[8];
                    const unit = goal.customUnit || cat.defaultUnit;
                    const weekDts = getWeekDates(weekKey);
                    const doneDays = weekDts.filter(d => dayLogs[`${m.id}__${goal.id}__${d}`]?.done).length;
                    return (
                      <div key={goal.id} style={{ padding: "8px 10px", background: "#0d0d0d", borderRadius: 8, marginBottom: 5, border: `1px solid ${fine > 0 ? "rgba(255,85,85,0.15)" : C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 16 }}>{cat.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal.name}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{doneDays}/{goal.weeklyTarget} {unit} done</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            {isAdmin && (rawFine > 0 || currentFine > 0) && (
                              <button onClick={() => setOverrideModal({ memberId: m.id, weekKey, goalId: goal.id, memberName: m.name, goalName: goal.name, adminName: myMember?.name || "Admin", rawFine: rawFine || currentFine })}
                                style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, border: "1px solid rgba(255,184,0,0.3)", background: "transparent", color: C.amber, cursor: "pointer" }}>
                                ⚡ Override
                              </button>
                            )}
                            {override?.overridden ? (
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>₹{(override.customAmount || 0).toLocaleString("en-IN")}</div>
                                {override.customAmount > 0 && <div style={{ fontSize: 9, color: C.muted, textDecoration: "line-through" }}>was ₹{rawFine}</div>}
                              </div>
                            ) : (
                              <span style={{ fontFamily: "'DM Mono',monospace", color: fine > 0 ? C.red : C.green, fontWeight: 700, fontSize: 13 }}>
                                {fine > 0 ? `₹${fine.toLocaleString("en-IN")}` : "✓"}
                              </span>
                            )}
                          </div>
                        </div>
                        {override?.overridden && (
                          <div style={{ fontSize: 10, color: C.amber, marginTop: 4, display: "flex", gap: 4 }}>
                            <span>⚡</span>
                            <span><b>{override.overriddenBy}</b>: {override.overrideReason}</span>
                          </div>
                        )}
                        {log?.note && !override?.overridden && (
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontStyle: "italic" }}>"{log.note}"</div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              );
            })}

            {/* Summary pot */}
            <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 12, padding: "14px 16px", marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: C.muted }}>This week's pot</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 30, color: C.lime }}>
                  ₹{members.reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
                <span style={{ color: C.green }}>Paid: ₹{members.filter(m => isWeekPaid(m.id, weekKey)).reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}</span>
                <span style={{ color: C.red }}>Unpaid: ₹{members.filter(m => !isWeekPaid(m.id, weekKey)).reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        )}

        {/* ════ HOBBIES ════ */}
        {tab === "hobbies" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24 }}>HOBBIES & SKILLS</div>
              {(isAdmin || myMember) && <button style={{ ...mkBP(false, C.blue), fontSize: 12, padding: "8px 14px" }} onClick={() => { setAddHobbyForMember(myMember?.id || null); setAddHobbyOpen(true); }}>+ Add Hobby</button>}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>No fines here — just accountability and visibility 🎸</div>

            {members.map((m, idx) => {
              const mHobbies = hobbies.filter(h => h.memberId === m.id && h.active !== false);
              if (!mHobbies.length) return null;
              return (
                <Card key={m.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={38} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  </div>
                  {mHobbies.map(hobby => {
                    const hlog = getHLog(m.id, hobby.id, weekKey);
                    const sug = HOBBY_SUGGESTIONS.find(s => s.id === hobby.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];
                    // total sessions all time
                    const totalSessions = Object.keys(hobbyLogs)
                      .filter(k => k.startsWith(`${m.id}__${hobby.id}__`))
                      .reduce((s, k) => s + (hobbyLogs[k]?.sessions || 0), 0);
                    return (
                      <div key={hobby.id} style={{ background: "#0d0d0d", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 22 }}>{sug.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{hobby.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>Since {formatDate(hobby.startDate)} · {totalSessions} total sessions</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, color: C.blue, fontWeight: 700 }}>{hlog?.sessions || 0}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>this week</div>
                          </div>
                        </div>
                        {hlog?.note && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 4 }}>"{hlog.note}"</div>}
                      </div>
                    );
                  })}
                </Card>
              );
            })}
            {members.every(m => !hobbies.filter(h => h.memberId === m.id && h.active !== false).length) && (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎸</div>
                <div style={{ marginBottom: 12 }}>No hobbies yet — add yours!</div>
              </div></Card>
            )}
          </div>
        )}

        {/* ════ LEADERBOARD ════ */}
        {tab === "leaderboard" && (() => {
          // Build full month index from dayLogs
          const allMonths = new Set();
          Object.keys(dayLogs).forEach(k => {
            const d = k.split("__")[2];
            if (d) allMonths.add(d.substring(0,7));
          });
          const now = new Date();
          allMonths.add(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
          const sortedMonths = [...allMonths].sort().reverse(); // newest first
          const years = [...new Set(sortedMonths.map(m => m.substring(0,4)))];

          // Fine calc for a member for a whole month
          const getMemberMonthFine = (memberId, mo) => {
            const mGoals = goals.filter(g => g.memberId === memberId && g.active !== false);
            const allWks = [...new Set(
              Object.keys(dayLogs)
                .filter(k => k.startsWith(`${memberId}__`) && k.split("__")[2]?.startsWith(mo))
                .map(k => { try { return getWeekKey(new Date(k.split("__")[2])); } catch { return null; } })
                .filter(Boolean)
            )];
            return mGoals.reduce((mSum, g) =>
              mSum + allWks.reduce((wSum, wk) => {
                const override = fines[`${memberId}__${wk}__${g.id}`];
                return wSum + calcFine({ goal: g, weekKey: wk, dayLogs, override });
              }, 0), 0);
          };

          // Per-goal fine for a member for a month
          const getGoalMonthDetail = (memberId, goalId, mo) => {
            const g = goals.find(x => x.id === goalId);
            if (!g) return { fine: 0, weeks: [] };
            const allWks = [...new Set(
              Object.keys(dayLogs)
                .filter(k => k.startsWith(`${memberId}__${goalId}__`) && k.split("__")[2]?.startsWith(mo))
                .map(k => { try { return getWeekKey(new Date(k.split("__")[2])); } catch { return null; } })
                .filter(Boolean)
            )].sort();
            const weeks = allWks.map(wk => {
              const override = fines[`${memberId}__${wk}__${goalId}`];
              const fine = calcFine({ goal: g, weekKey: wk, dayLogs, override });
              const wDates = getWeekDates(wk);
              const doneDays = getDoneDays(g, wk, dayLogs);
              return { wk, fine, override, doneDays };
            });
            return { fine: weeks.reduce((s,w) => s+w.fine, 0), weeks };
          };

          return (
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24 }}>SCORES</div>
                {isAdmin && (
                  <button onClick={() => exportData({ members, goals, dayLogs, fines, finePayments, weekNotes, months })}
                    style={{ background: "rgba(200,245,59,0.1)", border: "1px solid rgba(200,245,59,0.3)", color: C.lime, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    📥 Export CSV
                  </button>
                )}
              </div>

              {/* Year selector */}
              <ScoresDrillDown
                years={years}
                sortedMonths={sortedMonths}
                members={members}
                goals={goals}
                dayLogs={dayLogs}
                fines={fines}
                finePayments={finePayments}
                getMemberMonthFine={getMemberMonthFine}
                getGoalMonthDetail={getGoalMonthDetail}
                calcFine={calcFine}
                isAdmin={isAdmin}
                myMember={myMember}
                onMarkPaid={async (memberId, weekKey, paid) => {
                  if (paid) await markFinePaid(memberId, weekKey, myMember?.name || "Admin");
                  else await markFineUnpaid(memberId, weekKey);
                  showToast(paid ? "Marked paid ✅" : "Marked unpaid");
                }}
                onOverride={(memberId, wk, goalId, goalName, memberName, rawFine) => {
                  setOverrideModal({ memberId, weekKey: wk, goalId, memberName, goalName, adminName: myMember?.name || "Admin", rawFine });
                }}
              />
            </div>
          );
        })()}

        {/* ════ FEED ════ */}
        {tab === "feed" && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 6 }}>SQUAD FEED</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Everything happening in the squad, live.</div>

            {!activity.length ? (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
                <div>No activity yet — start logging!</div>
              </div></Card>
            ) : (() => {
              // Group consecutive activities by same person into clusters
              const items = activity.slice(0, 60);
              const clusters = [];
              items.forEach(a => {
                const name = a.memberName || a.adminName || a.closedBy || "Squad";
                const last = clusters[clusters.length - 1];
                if (last && last.name === name) {
                  last.items.push(a);
                } else {
                  clusters.push({ name, items: [a] });
                }
              });

              return clusters.map((cluster, ci) => {
                const mIdx = members.findIndex(m => m.name === cluster.name);
                const member = members[mIdx];
                const clr = mIdx >= 0 ? COLORS[mIdx % COLORS.length] : "#888";
                const firstTs = cluster.items[0]?.createdAt;

                // Activity type → pill label + colour
                const typeMeta = (type) => ({
                  week_log:      { label: "Logged",         bg: "rgba(200,245,59,0.12)",  clr: "#c8f53b" },
                  hobby_log:     { label: "Hobby",          bg: "rgba(79,163,224,0.12)",  clr: "#4fa3e0" },
                  fine_override: { label: "Fine Override",  bg: "rgba(255,184,0,0.12)",   clr: "#ffb800" },
                  goal_added:    { label: "New Goal",       bg: "rgba(162,155,254,0.15)", clr: "#a29bfe" },
                  hobby_added:   { label: "New Hobby",      bg: "rgba(79,163,224,0.12)",  clr: "#4fa3e0" },
                  member_joined: { label: "Joined",         bg: "rgba(0,184,148,0.12)",   clr: "#00b894" },
                  month_closed:  { label: "Month Closed",   bg: "rgba(255,184,0,0.12)",   clr: "#ffb800" },
                  banter:        { label: "Banter",         bg: "rgba(253,121,168,0.12)", clr: "#fd79a8" },
                }[type] || { label: "Update", bg: "#1a1a1a", clr: "#888" });

                // Rich description per activity type
                const richText = (a) => {
                  if (a.type === "week_log") {
                    const icon = a.completed === "yes" ? "✅" : a.completed === "partial" ? "⚠️" : "❌";
                    const fineStr = a.fine > 0 ? ` · ₹${a.fine.toLocaleString("en-IN")} fine` : " · no fine";
                    return <span>{icon} <b style={{ color: C.text }}>{a.goalName}</b> — {a.completed === "yes" ? "nailed it" : a.completed === "partial" ? "partial" : "missed it"}{fineStr}</span>;
                  }
                  if (a.type === "hobby_log") return <span>🎸 <b style={{ color: C.text }}>{a.hobbyName}</b> — {a.sessions} session{a.sessions !== 1 ? "s" : ""} this week</span>;
                  if (a.type === "fine_override") return <span>⚡ Zeroed fine for <b style={{ color: C.text }}>{a.goalName}</b> — <i style={{ color: C.muted }}>{a.reason}</i></span>;
                  if (a.type === "goal_added") return <span>🎯 New goal added: <b style={{ color: C.text }}>{a.goalName}</b></span>;
                  if (a.type === "hobby_added") return <span>🎸 Started new hobby: <b style={{ color: C.text }}>{a.hobbyName}</b></span>;
                  if (a.type === "member_joined") return <span>👋 <b style={{ color: C.text }}>{a.memberName}</b> joined the squad!</span>;
                  if (a.type === "month_closed") return <span>🔄 Month closed by <b style={{ color: C.text }}>{a.closedBy}</b> — fresh start!</span>;
                  if (a.type === "banter") return <span>💬 <i style={{ color: C.text2 }}>"{a.preview}{a.preview?.length >= 60 ? "..." : ""}"</i></span>;
                  return <span>{actText(a)}</span>;
                };

                return (
                  <div key={ci} style={{ marginBottom: 14 }}>
                    {/* Person header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      {member
                        ? <Av name={member.name} emoji={member.emoji} idx={mIdx} size={34} />
                        : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔧</div>
                      }
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: clr }}>{cluster.name}</span>
                        <span style={{ fontSize: 10, color: C.muted, marginLeft: 8, fontFamily: "'DM Mono',monospace" }}>{formatDateTime(firstTs)}</span>
                      </div>
                    </div>

                    {/* Activity items for this person */}
                    <div style={{ marginLeft: 44, display: "flex", flexDirection: "column", gap: 6 }}>
                      {cluster.items.map(a => {
                        const meta = typeMeta(a.type);
                        return (
                          <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#0d0d0d", borderRadius: 9, padding: "9px 12px", border: `1px solid ${C.border}` }}>
                            <span style={{ background: meta.bg, color: meta.clr, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{meta.label}</span>
                            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{richText(a)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ════ BANTER ════ */}
        {/* ════ CALENDAR ════ */}
        {tab === "calendar" && (
          <div style={{ animation: "slideIn .2s ease" }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 14 }}>MONTHLY CALENDAR</div>
            <MonthlyCalendar
              members={members}
              goals={goals}
              dayLogs={dayLogs}
              fines={fines}
              activeMemberId={calendarMemberId || myMember?.id || members[0]?.id}
              onMemberChange={setCalendarMemberId}
              onDateClick={(dateStr) => {
                // Navigate to My Week showing the week containing this date
                const wk = getWeekKey(new Date(dateStr));
                const offset = Math.round((new Date(dateStr) - new Date()) / (7 * 24 * 60 * 60 * 1000));
                setWeekOffset(Math.min(0, Math.round(offset)));
                setTab("myweek");
              }}
            />
          </div>
        )}

        {tab === "banter" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24 }}>SQUAD BANTER</div>
              <button style={mkBP(false)} onClick={() => setBanterOpen(true)}>+ Post</button>
            </div>
            {!banter.length ? (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🗣️</div><div>Be the first to post</div>
              </div></Card>
            ) : banter.map(b => {
              const mIdx = members.findIndex(m => m.name === b.author);
              const clr = mIdx >= 0 ? COLORS[mIdx % COLORS.length] : "#888";
              return (
                <div key={b.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: clr, fontSize: 13 }}>{b.author}</span>
                    <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>{formatDateTime(b.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "#ccc", lineHeight: 1.55 }}>{b.text}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ MEMBERS (ADMIN) ════ */}
        {tab === "members" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24 }}>MEMBERS & GOALS</div>
              {isAdmin && <button style={mkBP(false)} onClick={() => setAddMemberOpen(true)}>+ Add</button>}
            </div>

            {/* ── Unlinked sign-ups ── */}
            {isSuperAdmin && (() => {
              const unlinked = users.filter(u => !u.memberId && !u.isPending);
              if (!unlinked.length) return null;
              return (
                <div style={{ background: "rgba(255,184,0,0.07)", border: "1px solid rgba(255,184,0,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 16, color: C.amber, marginBottom: 10 }}>
                    {unlinked.length} SIGN-UP{unlinked.length > 1 ? "S" : ""} NOT LINKED
                  </div>
                  {unlinked.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", background: "#0d0d0d", borderRadius: 9 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.displayName || u.email}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{u.email}</div>
                      </div>
                      <select
                        defaultValue=""
                        onChange={async e => {
                          if (!e.target.value) return;
                          await approveUser(u.id, e.target.value);
                          await makeAdmin(u.id, true);
                          showToast(`Linked & made admin ✅`);
                          await postActivity({ type: "member_joined", memberName: members.find(m => m.id === e.target.value)?.name || u.email });
                        }}
                        style={{ ...IS, width: "auto", fontSize: 12, padding: "5px 10px" }}>
                        <option value="">Link to member →</option>
                        {members.filter(m => !users.some(u2 => u2.memberId === m.id)).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })()}

            {members.map((m, idx) => {
              const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
              const mUser = users.find(u => u.memberId === m.id);
              return (
                <Card key={m.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={46} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{m.fitnessGoal}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.weight && <Badge color={C.muted}>⚖️ {m.weight}kg</Badge>}
                        {m.height && <Badge color={C.muted}>📏 {m.height}cm</Badge>}
                        {mUser && <Badge color={C.green}>✓ linked</Badge>}
                        {mUser?.isAdmin && <Badge color={C.lime}>ADMIN</Badge>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <button onClick={() => setEditMember(m)} style={{ ...BO, fontSize: 11, padding: "5px 10px" }}>Edit</button>
                        {isSuperAdmin && mUser && !mUser.isAdmin && (
                          <button onClick={() => { if (confirm(`Make ${m.name} an admin?\n\nThey will be able to add/edit goals, override fines, and manage all members.`)) makeAdmin(mUser.id, true).then(() => showToast(`${m.name} is now an admin ✅`)); }}
                            style={{ background: "rgba(200,245,59,0.1)", border: "1px solid rgba(200,245,59,0.3)", color: C.lime, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>+ Admin</button>
                        )}
                        {isSuperAdmin && mUser?.isAdmin && m.id !== myMember?.id && (
                          <button onClick={() => { if (confirm(`Remove admin from ${m.name}?`)) makeAdmin(mUser.id, false).then(() => showToast(`Admin removed from ${m.name}`)); }}
                            style={{ background: "transparent", border: "1px solid rgba(255,85,85,0.3)", color: C.red, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 10 }}>- Admin</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Goals ({mGoals.length})</div>
                      {(isAdmin || myMember?.id === m.id) && <button onClick={() => { setAddGoalForMember(m.id); setAddGoalOpen(true); }} style={{ ...mkBP(false), fontSize: 10, padding: "4px 10px" }}>+ Goal</button>}
                    </div>
                    {mGoals.map(goal => {
                      const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                      return (
                        <div key={goal.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#0d0d0d", borderRadius: 7, marginBottom: 5 }}>
                          <span>{cat.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{goal.name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>{goal.goalType === "monthly" ? "Monthly" : "Ongoing"} · {goal.weeklyTarget} {cat.unit}/wk · ₹{goal.fineAmount}/miss</div>
                          </div>
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setEditGoal(goal)} style={{ background: "#1a1a1a", border: `1px solid ${C.border2}`, color: C.muted, borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 10 }}>Edit</button>
                              <button onClick={() => { if (confirm("Delete?")) deleteGoal(goal.id); }} style={{ background: "transparent", border: "1px solid rgba(255,85,85,0.25)", color: C.red, borderRadius: 5, padding: "3px 6px", cursor: "pointer", fontSize: 10 }}>✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}
      <WeekLogModal open={!!weekLogModal} onClose={() => setWeekLogModal(null)} goal={weekLogModal?.goal} weekKey={weekLogModal?.weekKey} existingLog={weekLogModal?.log} memberName={myMember?.name} onSave={handleWeekLog} />
      <DayLogModal open={!!dayLogModal} onClose={() => setDayLogModal(null)} goal={dayLogModal?.goal} date={dayLogModal?.date} existingLog={dayLogModal?.log} onSave={handleDayLog} isHistorical={dayLogModal?.date < today()} />
      <HobbyLogModal open={!!hobbyLogModal} onClose={() => setHobbyLogModal(null)} hobby={hobbyLogModal?.hobby} weekKey={hobbyLogModal?.weekKey} existingLog={hobbyLogModal?.log} onSave={handleHobbyLog} />
      <OverrideModal open={!!overrideModal} onClose={() => setOverrideModal(null)} rawFine={overrideModal?.rawFine} memberName={overrideModal?.memberName} goalName={overrideModal?.goalName} onSave={handleOverride} />

      <Modal open={addMemberOpen} title="ADD MEMBER" onClose={() => setAddMemberOpen(false)}>
        <MemberForm initial={null} onSave={f => handleSaveMember(f, null)} onClose={() => setAddMemberOpen(false)} isEdit={false} />
      </Modal>
      <Modal open={!!editMember} title="EDIT MEMBER" onClose={() => setEditMember(null)}>
        {editMember && (
          <>
            <MemberForm key={editMember.id} initial={{ name: editMember.name, emoji: editMember.emoji || "", dob: editMember.dob || "", weight: editMember.weight || "", height: editMember.height || "", fitnessGoal: editMember.fitnessGoal || "" }} onSave={f => handleSaveMember(f, editMember.id)} onClose={() => setEditMember(null)} isEdit />
            <div style={{ marginTop: 24, borderTop: "1px solid #1e1e1e", paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Danger Zone</div>
              <button onClick={() => { const m = editMember; setEditMember(null); setTimeout(() => handleDeleteMember(m.id, m.name), 100); }}
                style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 11, width: "100%" }}>
                Remove this member permanently...
              </button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={addGoalOpen} title="ADD GOAL" onClose={() => { setAddGoalOpen(false); setAddGoalForMember(null); }}>
        <GoalForm key={`ng-${addGoalForMember}`} initial={{ memberId: addGoalForMember || "", name: "", category: "gym", weeklyTarget: "", fineAmount: "1000", goalType: "ongoing", notes: "" }} members={members} onSave={f => handleSaveGoal(f, null)} onClose={() => { setAddGoalOpen(false); setAddGoalForMember(null); }} isEdit={false} />
      </Modal>
      <Modal open={!!editGoal} title="EDIT GOAL" onClose={() => setEditGoal(null)}>
        {editGoal && <GoalForm key={editGoal.id} initial={{ memberId: editGoal.memberId, name: editGoal.name, category: editGoal.category, weeklyTarget: String(editGoal.weeklyTarget), fineAmount: String(editGoal.fineAmount), goalType: editGoal.goalType || "ongoing", notes: editGoal.notes || "" }} members={members} onSave={f => handleSaveGoal(f, editGoal.id)} onClose={() => setEditGoal(null)} isEdit />}
      </Modal>
      <Modal open={addHobbyOpen} title="ADD HOBBY" onClose={() => { setAddHobbyOpen(false); setAddHobbyForMember(null); }}>
        <HobbyForm key={`nh-${addHobbyForMember}`} initial={null} members={members} onSave={f => handleSaveHobby(f, null)} onClose={() => { setAddHobbyOpen(false); setAddHobbyForMember(null); }} isEdit={false} defaultMemberId={addHobbyForMember || myMember?.id} />
      </Modal>
      <Modal open={!!editHobby} title="EDIT HOBBY" onClose={() => setEditHobby(null)}>
        {editHobby && <HobbyForm key={editHobby.id} initial={{ memberId: editHobby.memberId, name: editHobby.name, hobbyType: editHobby.hobbyType, startDate: editHobby.startDate, notes: editHobby.notes || "" }} members={members} onSave={f => handleSaveHobby(f, editHobby.id)} onClose={() => setEditHobby(null)} isEdit />}
      </Modal>

      {/* Approve User */}
      <Modal open={!!approveModal} title="APPROVE NEW MEMBER" onClose={() => { setApproveModal(null); setApproveMemberId(""); }}>
        {approveModal && (
          <>
            <div style={{ background: "rgba(200,245,59,0.08)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <div style={{ color: C.lime, fontWeight: 600 }}>New sign-up waiting</div>
              <div style={{ color: C.muted, marginTop: 2 }}>{approveModal.email || approveModal.displayName}</div>
            </div>
            <Fld label="Link to which squad member?">
              <select value={approveMemberId} onChange={e => setApproveMemberId(e.target.value)} style={IS}>
                <option value="">Select member profile</option>
                {members.filter(m => !users.some(u => u.memberId === m.id && !u.isPending)).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Fld>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Once approved, this person will be permanently logged in as {members.find(m => m.id === approveMemberId)?.name || "the selected member"}.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={BO} onClick={() => { setApproveModal(null); setApproveMemberId(""); }}>Later</button>
              <button style={mkBP(false)} onClick={handleApprove}>Approve & Link →</button>
            </div>
            {pendingUsers.length > 1 && <div style={{ fontSize: 12, color: C.muted, marginTop: 10, textAlign: "center" }}>{pendingUsers.length - 1} more pending after this</div>}
          </>
        )}
      </Modal>

      {/* Banter */}
      <Modal open={banterOpen} title="POST TO BANTER" onClose={() => setBanterOpen(false)} maxWidth={400}>
        <Fld label="Message">
          <textarea value={banterText} onChange={e => setBanterText(e.target.value)} rows={4} placeholder="Drop a win, call someone out, motivate the squad 🔥" style={{ ...IS, resize: "vertical" }} />
        </Fld>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <button style={BO} onClick={() => setBanterOpen(false)}>Cancel</button>
          <button style={mkBP(!banterText.trim())} onClick={handleBanter} disabled={!banterText.trim()}>Post 🗣️</button>
        </div>
      </Modal>

      {/* Member Detail */}
      <Modal open={!!memberDetailOpen} title={memberDetailOpen?.name?.toUpperCase() || ""} onClose={() => setMemberDetailOpen(null)}>
        {memberDetailOpen && (() => {
          const m = memberDetailOpen;
          const mGoals = goals.filter(g => g.memberId === m.id && g.active !== false);
          const mHobbies = hobbies.filter(h => h.memberId === m.id && h.active !== false);
          return (
            <>
              <div style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "center" }}>
                <Av name={m.name} emoji={m.emoji} idx={members.findIndex(x => x.id === m.id)} size={56} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 6px" }}>{m.fitnessGoal}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {m.weight && <Badge color={C.muted}>⚖️ {m.weight}kg</Badge>}
                    {m.height && <Badge color={C.muted}>📏 {m.height}cm</Badge>}
                  </div>
                </div>
              </div>
              {mGoals.length > 0 && <>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Goals This Week</div>
                {mGoals.map(goal => {
                  const log = getLog(m.id, goal.id, weekKey);
                  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                  return <div key={goal.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#0d0d0d", borderRadius: 7, marginBottom: 5, fontSize: 12 }}>
                    <span>{cat.icon} {goal.name}</span>
                    <span style={{ color: C.muted }}>{log ? (log.completed === "yes" ? "✅" : log.completed === "partial" ? "⚠️" : "❌") : "⏳"}</span>
                  </div>;
                })}
              </>}
              {mHobbies.length > 0 && <>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 8px" }}>Hobbies</div>
                {mHobbies.map(hobby => {
                  const sug = HOBBY_SUGGESTIONS.find(s => s.id === hobby.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];
                  const hlog = getHLog(m.id, hobby.id, weekKey);
                  return <div key={hobby.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#0d0d0d", borderRadius: 7, marginBottom: 5, fontSize: 12 }}>
                    <span>{sug.icon} {hobby.name}</span>
                    <span style={{ color: C.blue }}>{hlog?.sessions || 0} sessions this week</span>
                  </div>;
                })}
              </>}
            </>
          );
        })()}
      </Modal>

      {/* Month Close */}
      {/* Month closes automatically on 1st of each month */}

      {/* Settings */}
      <Modal open={settingsOpen} title="SETTINGS" onClose={() => setSettingsOpen(false)}>
        {!isAdmin ? (
          <div style={{ padding: "16px 0", color: C.muted, fontSize: 14, textAlign: "center" }}>Admin access required to change settings</div>
        ) : (
          <>
            <Fld label="Group Name"><input value={settings.groupName} onChange={e => setSettings(s => ({ ...s, groupName: e.target.value }))} style={IS} /></Fld>
            <Fld label="App URL"><input value={settings.appUrl || ""} onChange={e => setSettings(s => ({ ...s, appUrl: e.target.value }))} style={IS} /></Fld>
            <Fld label="Challenge Start Date"><input type="date" value={settings.startDate?.split("T")[0] || ""} onChange={e => setSettings(s => ({ ...s, startDate: new Date(e.target.value).toISOString() }))} style={IS} /></Fld>
            <div style={{ marginTop: 6, padding: "10px 14px", background: "rgba(200,245,59,0.05)", borderRadius: 8, fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Signed in as: {authUser?.email || authUser?.displayName}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 16 }}>
              <button onClick={() => signOut(auth)} style={{ ...BO, color: C.red, borderColor: "rgba(255,85,85,0.3)", fontSize: 13 }}>Sign Out</button>
              <button style={mkBP(false)} onClick={async () => { await saveSettings(settings); setSettingsOpen(false); showToast("Saved ✅"); }}>Save →</button>
            </div>
          </>
        )}
      </Modal>

      <Toast msg={toast.msg} type={toast.type} />
      <Confetti active={confetti} onDone={() => setConfetti(false)} />
      <CelebrationOverlay data={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}
