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
  listenWeekLogs, saveWeekLog,
  listenHobbyLogs, saveHobbyLog,
  listenFines, saveFine, adminOverrideFine,
  listenFinePayments, markFinePaid, markFineUnpaid,
  listenActivity, postActivity,
  listenBanter, postBanter,
  listenMonths, saveMonth,
} from "./db";
import {
  COLORS, GOAL_CATEGORIES, HOBBY_SUGGESTIONS,
  currentWeekKey, getWeekKey, getWeekDates,
  today, formatDate, formatDateTime, getDayLabel,
  getMonthKey, uid, calcGoalFine, buildWAMsg,
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
function OverrideModal({ open, onClose, fine, memberName, goalName, onSave }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);

  useEffect(() => { if (open) { setReason(""); setSaving(false); ref.current = false; } }, [open]);

  const handleSave = async () => {
    if (!reason.trim()) { alert("Please enter a reason"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    await onSave(reason.trim());
    setSaving(false);
  };

  return (
    <Modal open={open} title="ADMIN FINE OVERRIDE" onClose={onClose} maxWidth={400}>
      <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
        <div style={{ color: C.amber, fontWeight: 600, marginBottom: 4 }}>Zeroing fine for {memberName}</div>
        <div style={{ color: C.muted }}>Goal: {goalName}</div>
      </div>
      <Fld label="Reason for override (required)">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="e.g. Was on holiday in Goa, approved exception" style={{ ...IS, resize: "vertical" }} />
      </Fld>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>This will be recorded with your name and shown publicly in the fines ledger.</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={mkBP(saving, C.amber)} onClick={handleSave} disabled={saving}>{saving && <Spin />}{saving ? "Saving..." : "Zero Fine →"}</button>
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
  const EMPTY = { memberId: "", name: "", category: "gym", weeklyTarget: "", fineAmount: "1000", goalType: "ongoing", notes: "" };
  const [form, setForm] = useState(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const ref = useRef(false);
  useEffect(() => { setForm(initial || EMPTY); ref.current = false; setSaving(false); }, [initial]);
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cat = GOAL_CATEGORIES.find(c => c.id === form.category) || GOAL_CATEGORIES[0];
  const go = async () => {
    if (!form.name.trim() || !form.memberId) { alert("Member and goal name required"); return; }
    if (saving || ref.current) return;
    ref.current = true; setSaving(true);
    try { await onSave({ ...form, weeklyTarget: Number(form.weeklyTarget) || 0, fineAmount: Number(form.fineAmount) || 0 }); }
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
      <Fld label="Goal Name"><input value={form.name} onChange={e => s("name", e.target.value)} placeholder="e.g. Gym 3x/week, No chips, Sleep by midnight" style={IS} /></Fld>
      <Fld label="Category">
        <select value={form.category} onChange={e => s("category", e.target.value)} style={IS}>
          {GOAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </Fld>
      <Fld label="Goal Type">
        <select value={form.goalType} onChange={e => s("goalType", e.target.value)} style={IS}>
          <option value="ongoing">Ongoing — carries forward every month</option>
          <option value="monthly">Monthly challenge — resets each month</option>
        </select>
      </Fld>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Fld label={`Weekly Target (${cat.unit})`}><input type="number" value={form.weeklyTarget} onChange={e => s("weeklyTarget", e.target.value)} placeholder={form.category === "junk" ? "Max allowed" : "Min target"} style={IS} min="0" /></Fld></div>
        <div style={{ flex: 1 }}><Fld label="Fine per miss (₹)"><input type="number" value={form.fineAmount} onChange={e => s("fineAmount", e.target.value)} style={IS} min="0" step="100" /></Fld></div>
      </div>
      <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.15)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: C.muted, marginBottom: 14 }}>
        {form.category === "junk" ? `💡 Each junk meal over limit = ₹${form.fineAmount || 0}` : `💡 Miss weekly target = ₹${form.fineAmount || 0} fine`}
      </div>
      <Fld label="Notes (optional)"><input value={form.notes} onChange={e => s("notes", e.target.value)} placeholder="e.g. 2 cheat meals allowed" style={IS} /></Fld>
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
  const [hobbyLogs, setHobbyLogs] = useState({});
  const [fines, setFines] = useState({});
  const [finePayments, setFinePayments] = useState({});
  const [activity, setActivity] = useState([]);
  const [banter, setBanter] = useState([]);
  const [months, setMonths] = useState([]);
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
  const [hobbyLogModal, setHobbyLogModal] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null); // {memberId, weekKey, goalId, memberName, goalName}
  const [approveModal, setApproveModal] = useState(null); // pending user
  const [approveMemberId, setApproveMemberId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [banterOpen, setBanterOpen] = useState(false);
  const [banterText, setBanterText] = useState("");
  const [monthCloseOpen, setMonthCloseOpen] = useState(false);
  const [memberDetailOpen, setMemberDetailOpen] = useState(null);

  const weekKey = currentWeekKey();
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast({ msg: "", type: "" }), 3000); };
  const isAdmin = userDoc?.isAdmin || false;
  const myMember = members.find(m => m.id === userDoc?.memberId);

  // ── AUTH LISTENER ───────────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        let ud = await getUser(user.uid);
        if (!ud) {
          ud = { uid: user.uid, email: user.email, displayName: user.displayName, isPending: true, isAdmin: false, createdAt: new Date().toISOString() };
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
      listenHobbyLogs(setHobbyLogs),
      listenFines(setFines),
      listenFinePayments(setFinePayments),
      listenActivity(setActivity),
      listenBanter(setBanter),
      listenMonths(setMonths),
    ];
    return () => unsubs.forEach(u => u());
  }, [authUser]);

  // Keep userDoc in sync with live users list
  useEffect(() => {
    if (authUser && users.length) {
      const ud = users.find(u => u.id === authUser.uid);
      if (ud) setUserDoc(ud);
    }
  }, [users, authUser]);

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const getLog = (memberId, goalId, wk) => weekLogs[`${memberId}__${goalId}__${wk}`];
  const getHLog = (memberId, hobbyId, wk) => hobbyLogs[`${memberId}__${hobbyId}__${wk}`];
  const getFine = (memberId, goalId, wk) => fines[`${memberId}__${wk}__${goalId}`];

  const calcMemberWeekFine = useCallback((memberId, wk) => {
    const mGoals = goals.filter(g => g.memberId === memberId && g.active !== false);
    return mGoals.reduce((sum, g) => {
      const override = getFine(memberId, g.id, wk);
      if (override?.overridden) return sum;
      const log = getLog(memberId, g.id, wk);
      return sum + calcGoalFine(g, log);
    }, 0);
  }, [goals, weekLogs, fines]);

  const getMemberWeekFineDetail = useCallback((memberId, wk) => {
    const mGoals = goals.filter(g => g.memberId === memberId && g.active !== false);
    return mGoals.map(g => {
      const override = getFine(memberId, g.id, wk);
      const log = getLog(memberId, g.id, wk);
      const rawFine = calcGoalFine(g, log);
      const fine = override?.overridden ? 0 : rawFine;
      return { goal: g, log, fine, override, rawFine };
    });
  }, [goals, weekLogs, fines]);

  const isWeekPaid = (memberId, wk) => finePayments[`${memberId}__${wk}`]?.paid;

  // ── ACTIONS ──────────────────────────────────────────────────────────────────
  const handleSaveMember = async (form, id) => {
    const mid = id || `m_${uid()}`;
    await saveMember(mid, { ...form, ...(id ? {} : { createdAt: new Date().toISOString() }) });
    setAddMemberOpen(false); setEditMember(null);
    showToast(id ? "Member updated ✅" : `${form.name} added 💪`);
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
    const fine = calcGoalFine(goal, data);
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

  const handleHobbyLog = async (data) => {
    const { hobby, weekKey: wk, memberId } = hobbyLogModal;
    await saveHobbyLog(memberId, hobby.id, wk, data);
    setHobbyLogModal(null);
    await postActivity({ type: "hobby_log", memberName: myMember?.name || "", hobbyName: hobby.name, sessions: data.sessions, weekKey: wk });
    showToast(`${data.sessions} session${data.sessions !== 1 ? "s" : ""} logged 🎸`);
  };

  const handleOverride = async (reason) => {
    const { memberId, weekKey: wk, goalId, memberName, goalName, adminName } = overrideModal;
    await adminOverrideFine(memberId, wk, goalId, reason, adminName);
    await postActivity({ type: "fine_override", adminName, memberName, goalName, reason, weekKey: wk });
    setOverrideModal(null);
    showToast("Fine zeroed ✅", "info");
  };

  const handleApprove = async () => {
    if (!approveMemberId) { alert("Select which member this person is"); return; }
    await approveUser(approveModal.id, approveMemberId);
    setApproveModal(null); setApproveMemberId("");
    showToast("User approved ✅");
    await postActivity({ type: "member_joined", memberName: members.find(m => m.id === approveMemberId)?.name || approveModal.email });
  };

  const handleCloseMonth = async () => {
    const mk = getMonthKey();
    await saveMonth(mk, {
      closedAt: new Date().toISOString(),
      closedBy: myMember?.name || "Admin",
      totalFines: members.reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0),
    });
    // carry forward ongoing goals — they stay active automatically
    // deactivate monthly goals
    const monthlyGoals = goals.filter(g => g.goalType === "monthly" && g.active);
    await Promise.all(monthlyGoals.map(g => saveGoal(g.id, { ...g, active: false, archivedAt: new Date().toISOString() })));
    setMonthCloseOpen(false);
    showToast("Month closed! Ongoing goals carried forward 🔄");
    await postActivity({ type: "month_closed", closedBy: myMember?.name || "Admin", monthKey: mk });
  };

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
  if (userDoc?.isPending) return <PendingScreen user={authUser} onSignOut={() => signOut(auth)} />;
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
        {[["dashboard","📊","Board"],["myweek","📋","My Week"],["squad","👥","Squad"],["fines","💸","Fines"],["hobbies","🎸","Hobbies"],["history","🏆","History"],["feed","📡","Feed"],["banter","🗣️","Banter"],["members","⚙️","Members"]].map(([id, icon, lbl]) => (
          <button key={id} className={`tab-b ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { l: "Squad", v: members.length, c: C.lime },
                { l: "This Week", v: `${leaderboard.filter(m => m.fine === 0).length} clean`, c: C.green },
                { l: "Fines", v: `₹${leaderboard.reduce((s, m) => s + m.fine, 0).toLocaleString("en-IN")}`, c: leaderboard.reduce((s, m) => s + m.fine, 0) > 0 ? C.red : C.lime },
              ].map(p => (
                <div key={p.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{p.l}</div>
                  <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: p.c, lineHeight: 1 }}>{p.v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, marginBottom: 10 }}>THIS WEEK — {weekKey}</div>
            {!members.length ? (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <div style={{ marginBottom: 12 }}>No members yet</div>
                {isAdmin && <button style={mkBP(false)} onClick={() => setAddMemberOpen(true)}>Add Members →</button>}
              </div></Card>
            ) : leaderboard.map((m, rank) => {
              const RANK = ["🥇","🥈","🥉"];
              return (
                <Card key={m.id} highlight={rank === 0 && m.fine === 0} style={{ marginBottom: 8, cursor: "pointer" }}>
                  <div className="hov" onClick={() => setMemberDetailOpen(m)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 4 }}>MY WEEK</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{weekKey}</div>

            {!myMember ? (
              <Card><div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 14 }}>
                Your account is linked but no member profile found.<br />Contact your admin.
              </div></Card>
            ) : (
              <>
                <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <Av name={myMember.name} emoji={myMember.emoji} idx={members.findIndex(m => m.id === myMember.id)} size={50} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{myMember.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{myMember.fitnessGoal}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {myMember.weight && <Badge color={C.muted}>⚖️ {myMember.weight}kg</Badge>}
                      {myMember.height && <Badge color={C.muted}>📏 {myMember.height}cm</Badge>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: calcMemberWeekFine(myMember.id, weekKey) > 0 ? C.red : C.lime }}>
                      ₹{calcMemberWeekFine(myMember.id, weekKey).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>fines this week</div>
                  </div>
                </Card>

                {goals.filter(g => g.memberId === myMember.id && g.active !== false).length === 0 ? (
                  <Card><div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 13 }}>No goals set — ask admin to add some</div></Card>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Fitness Goals</div>
                    {goals.filter(g => g.memberId === myMember.id && g.active !== false).map(goal => {
                      const log = getLog(myMember.id, goal.id, weekKey);
                      const override = getFine(myMember.id, goal.id, weekKey);
                      const fine = override?.overridden ? 0 : calcGoalFine(goal, log);
                      const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                      const statusC = !log ? C.muted : log.completed === "yes" ? C.green : log.completed === "partial" ? C.amber : C.red;
                      return (
                        <div key={goal.id} style={{ background: "#0d0d0d", border: `1px solid ${fine > 0 ? "rgba(255,85,85,0.3)" : C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 20 }}>{cat.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{goal.name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>Target: {goal.weeklyTarget} {cat.unit}/wk · ₹{goal.fineAmount}/miss</div>
                              {override?.overridden && <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>⚡ Admin override: {override.overrideReason}</div>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: fine > 0 ? C.red : C.green }}>{fine > 0 ? `₹${fine.toLocaleString("en-IN")}` : "✓"}</div>
                              {log && <div style={{ fontSize: 10, color: statusC }}>{log.completed === "yes" ? "done" : log.completed === "partial" ? "partial" : "missed"}</div>}
                            </div>
                          </div>
                          {log?.note && <div style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginBottom: 8 }}>"{log.note}"</div>}
                          <button onClick={() => setWeekLogModal({ goal, weekKey, log: log || null, memberId: myMember.id })}
                            style={{ ...mkBP(false), fontSize: 13, padding: "9px 16px", width: "100%", justifyContent: "center" }}>
                            {log ? "Edit Log" : "Log This Week →"}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Hobbies */}
                {hobbies.filter(h => h.memberId === myMember.id && h.active !== false).length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>Hobbies</div>
                    {hobbies.filter(h => h.memberId === myMember.id && h.active !== false).map(hobby => {
                      const hlog = getHLog(myMember.id, hobby.id, weekKey);
                      const sug = HOBBY_SUGGESTIONS.find(s => s.id === hobby.hobbyType) || HOBBY_SUGGESTIONS[HOBBY_SUGGESTIONS.length - 1];
                      return (
                        <div key={hobby.id} style={{ background: "#0d0d0d", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 20 }}>{sug.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{hobby.name}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>Since {formatDate(hobby.startDate)}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, color: C.blue }}>{hlog?.sessions || 0}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>sessions</div>
                            </div>
                          </div>
                          <button onClick={() => setHobbyLogModal({ hobby, weekKey, log: hlog || null, memberId: myMember.id })}
                            style={{ ...mkBP(false, C.blue), fontSize: 13, padding: "9px 16px", width: "100%", justifyContent: "center" }}>
                            {hlog ? "Edit Hobby Log" : "Log Hobby →"}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
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
                    const gFine = override?.overridden ? 0 : calcGoalFine(goal, log);
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
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Live · {weekKey}</div>

            {members.map((m, idx) => {
              const details = getMemberWeekFineDetail(m.id, weekKey);
              const totalFine = details.reduce((s, d) => s + d.fine, 0);
              const paid = isWeekPaid(m.id, weekKey);
              return (
                <Card key={m.id} style={{ marginBottom: 12, borderColor: totalFine > 0 && !paid ? "rgba(255,85,85,0.3)" : paid ? "rgba(0,184,148,0.3)" : C.border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: details.length ? 10 : 0 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={38} />
                    <div style={{ flex: 1, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: totalFine > 0 ? (paid ? C.green : C.red) : C.lime }}>
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
                  {details.map(({ goal, log, fine, override, rawFine }) => {
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                    return (
                      <div key={goal.id} style={{ padding: "7px 10px", background: "#0d0d0d", borderRadius: 7, marginBottom: 5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                          <span>{cat.icon} {goal.name}</span>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {isAdmin && rawFine > 0 && !override?.overridden && (
                              <button onClick={() => setOverrideModal({ memberId: m.id, weekKey, goalId: goal.id, memberName: m.name, goalName: goal.name, adminName: myMember?.name || "Admin" })}
                                style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(255,184,0,0.3)", background: "transparent", color: C.amber, cursor: "pointer" }}>
                                Override
                              </button>
                            )}
                            {override?.overridden ? (
                              <span style={{ fontSize: 11, color: C.amber }} title={`${override.overriddenBy}: ${override.overrideReason}`}>⚡ ₹0</span>
                            ) : (
                              <span style={{ fontFamily: "'DM Mono',monospace", color: fine > 0 ? C.red : C.muted, fontWeight: 600, fontSize: 12 }}>{fine > 0 ? `₹${fine.toLocaleString("en-IN")}` : "—"}</span>
                            )}
                          </div>
                        </div>
                        {override?.overridden && (
                          <div style={{ fontSize: 10, color: C.amber, marginTop: 3 }}>⚡ {override.overriddenBy} override: {override.overrideReason}</div>
                        )}
                        {log?.note && <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontStyle: "italic" }}>"{log.note}"</div>}
                      </div>
                    );
                  })}
                </Card>
              );
            })}

            {/* Summary */}
            <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 12, padding: "14px 16px", marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: C.muted }}>This week's pot</div>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 30, color: C.lime }}>₹{members.reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
                <span>Paid: ₹{members.filter(m => isWeekPaid(m.id, weekKey)).reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}</span>
                <span>Unpaid: ₹{members.filter(m => !isWeekPaid(m.id, weekKey)).reduce((s, m) => s + calcMemberWeekFine(m.id, weekKey), 0).toLocaleString("en-IN")}</span>
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

        {/* ════ HISTORY ════ */}
        {tab === "history" && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 6 }}>ALL-TIME LEADERBOARD</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Cumulative fines since start</div>
            {members.map((m, idx) => {
              const allFine = Object.keys(weekLogs)
                .filter(k => k.startsWith(`${m.id}__`))
                .reduce((sum, k) => {
                  const [, goalId] = k.split("__");
                  const wk = k.split("__")[2];
                  const goal = goals.find(g => g.id === goalId);
                  const override = fines[`${m.id}__${wk}__${goalId}`];
                  if (!goal || override?.overridden) return sum;
                  return sum + calcGoalFine(goal, weekLogs[k]);
                }, 0);
              const paidTotal = Object.keys(finePayments)
                .filter(k => k.startsWith(`${m.id}__`) && finePayments[k]?.paid)
                .reduce((sum, k) => {
                  const wk = k.split("__")[1];
                  return sum + calcMemberWeekFine(m.id, wk);
                }, 0);
              return (
                <Card key={m.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Av name={m.name} emoji={m.emoji} idx={idx} size={42} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: C.green }}>Paid: ₹{paidTotal.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: allFine > 0 ? C.red : C.lime }}>₹{allFine.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>total fines</div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {isAdmin && (
              <button onClick={() => setMonthCloseOpen(true)} style={{ ...mkBP(false, C.amber), width: "100%", justifyContent: "center", marginTop: 16 }}>
                🔄 Close This Month
              </button>
            )}
            {months.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, marginBottom: 10 }}>PAST MONTHS</div>
                {months.map(mo => (
                  <Card key={mo.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 600 }}>{mo.id}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: C.red }}>₹{(mo.totalFines || 0).toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Closed by {mo.closedBy} · {formatDate(mo.closedAt)}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ FEED ════ */}
        {tab === "feed" && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, marginBottom: 14 }}>SQUAD FEED</div>
            {!activity.length ? (
              <Card><div style={{ textAlign: "center", padding: "28px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
                <div>No activity yet — start logging!</div>
              </div></Card>
            ) : activity.slice(0, 50).map(a => (
              <div key={a.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: "center" }}>{actIcon(a.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{actText(a)}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{formatDateTime(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════ BANTER ════ */}
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
            {!isAdmin && <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.amber }}>View only — admin manages members & goals</div>}

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
                        {mUser && !mUser.isAdmin && <button onClick={() => { if (confirm(`Make ${m.name} an admin?`)) makeAdmin(mUser.id, true); }} style={{ background: "rgba(200,245,59,0.1)", border: "1px solid rgba(200,245,59,0.3)", color: C.lime, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>+ Admin</button>}
                        {mUser?.isAdmin && m.id !== myMember?.id && <button onClick={() => { if (confirm(`Remove admin from ${m.name}?`)) makeAdmin(mUser.id, false); }} style={{ background: "transparent", border: "1px solid rgba(255,85,85,0.3)", color: C.red, borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 10 }}>- Admin</button>}
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Goals ({mGoals.length})</div>
                      {isAdmin && <button onClick={() => { setAddGoalForMember(m.id); setAddGoalOpen(true); }} style={{ ...mkBP(false), fontSize: 10, padding: "4px 10px" }}>+ Goal</button>}
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
      <HobbyLogModal open={!!hobbyLogModal} onClose={() => setHobbyLogModal(null)} hobby={hobbyLogModal?.hobby} weekKey={hobbyLogModal?.weekKey} existingLog={hobbyLogModal?.log} onSave={handleHobbyLog} />
      <OverrideModal open={!!overrideModal} onClose={() => setOverrideModal(null)} fine={overrideModal} memberName={overrideModal?.memberName} goalName={overrideModal?.goalName} onSave={handleOverride} />

      <Modal open={addMemberOpen} title="ADD MEMBER" onClose={() => setAddMemberOpen(false)}>
        <MemberForm initial={null} onSave={f => handleSaveMember(f, null)} onClose={() => setAddMemberOpen(false)} isEdit={false} />
      </Modal>
      <Modal open={!!editMember} title="EDIT MEMBER" onClose={() => setEditMember(null)}>
        {editMember && <MemberForm key={editMember.id} initial={{ name: editMember.name, emoji: editMember.emoji || "", dob: editMember.dob || "", weight: editMember.weight || "", height: editMember.height || "", fitnessGoal: editMember.fitnessGoal || "" }} onSave={f => handleSaveMember(f, editMember.id)} onClose={() => setEditMember(null)} isEdit />}
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
      <Modal open={monthCloseOpen} title="CLOSE THIS MONTH" onClose={() => setMonthCloseOpen(false)} maxWidth={400}>
        <div style={{ fontSize: 14, color: C.text2, marginBottom: 14, lineHeight: 1.6 }}>
          Closing the month will:<br />
          ✅ Archive all monthly challenge goals<br />
          ✅ Carry forward all ongoing goals automatically<br />
          ✅ Save a historical record of this month's fines<br />
          ✅ Start fresh for next month
        </div>
        <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.amber }}>
          ⚠️ This cannot be undone. Ongoing goals will continue as-is.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={BO} onClick={() => setMonthCloseOpen(false)}>Cancel</button>
          <button style={mkBP(false, C.amber)} onClick={handleCloseMonth}>Close Month →</button>
        </div>
      </Modal>

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
