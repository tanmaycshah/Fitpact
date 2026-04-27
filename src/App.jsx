import { useState, useEffect, useCallback } from "react";
import {
  listenSettings, saveSettings,
  listenMembers, saveMember, deleteMember,
  listenGoals, saveGoal, deleteGoal,
  listenLogs, saveLog,
  listenBanter, postBanter,
} from "./db";
import {
  COLORS, GOAL_CATEGORIES, ADMIN_PIN,
  today, getWeekDates, getCurrentWeekNum,
  formatDate, getDayLabel, calcWeekFine, uid, buildWAMsg,
} from "./utils";

const C = {
  bg: "#0a0a0a", card: "#111", border: "#1e1e1e", border2: "#2a2a2a",
  lime: "#c8f53b", red: "#ff5555", amber: "#ffb800", muted: "#666",
  text: "#f0ede6", text2: "#aaa",
};
const IS = {
  width: "100%", background: "#0c0c0c", border: `1px solid ${C.border2}`,
  borderRadius: 8, padding: "10px 13px", color: C.text,
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box",
};
const BP = {
  padding: "11px 22px", borderRadius: 10, border: "none",
  background: C.lime, color: "#0a0a0a",
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const BO = {
  padding: "10px 18px", borderRadius: 10, border: `1px solid ${C.border2}`,
  background: "transparent", color: C.text,
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer",
};

function Avatar({ name, emoji, idx, size = 40 }) {
  const c = COLORS[idx % COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${c}22`, color: c, border: `2px solid ${c}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, fontWeight: 700, flexShrink: 0,
    }}>
      {emoji || name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function Tag({ children, accent, red }) {
  return (
    <span style={{
      background: accent ? "rgba(200,245,59,0.1)" : red ? "rgba(255,85,85,0.1)" : "#1a1a1a",
      border: `1px solid ${accent ? "rgba(200,245,59,0.3)" : red ? "rgba(255,85,85,0.3)" : C.border2}`,
      color: accent ? C.lime : red ? C.red : C.muted,
      borderRadius: 20, padding: "2px 9px", fontSize: 11,
      fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Toast({ msg }) {
  return msg ? (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: C.lime, color: "#0a0a0a", padding: "11px 26px",
      borderRadius: 30, fontWeight: 700, fontSize: 13, zIndex: 9999,
      boxShadow: "0 4px 28px rgba(200,245,59,0.45)", pointerEvents: "none",
      animation: "fadeUp .3s ease",
    }}>{msg}</div>
  ) : null;
}

function Modal({ open, title, onClose, children, maxWidth = 500 }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#141414", border: `1px solid ${C.border2}`, borderRadius: 18,
        padding: "24px 22px", width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: C.lime, letterSpacing: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, row }) {
  return (
    <div style={{ marginBottom: 14, flex: row ? 1 : undefined }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Pill({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: color || C.lime, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function WeekDots({ goal, memberId, logs, weekDates, onLog }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
  const todayStr = today();
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
      {weekDates.map(date => {
        const key = `${memberId}__${goal.id}__${date}`;
        const log = logs[key];
        const isFuture = date > todayStr;
        let dotBg = C.border2;
        if (log?.done) dotBg = C.lime;
        if (log?.value > 0) dotBg = cat.id === "junk" ? C.red : C.lime;
        if (isFuture) dotBg = "#1a1a1a";
        return (
          <button key={date} onClick={() => !isFuture && onLog && onLog(goal, date, log)} disabled={isFuture}
            title={`${getDayLabel(date)} ${formatDate(date)}`}
            style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${dotBg}`,
              background: (log?.done || log?.value > 0) ? `${dotBg}33` : "#0a0a0a",
              color: isFuture ? "#2a2a2a" : dotBg === C.border2 ? C.muted : dotBg,
              fontSize: 10, fontWeight: 700, cursor: isFuture ? "default" : "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            }}>
            <span>{getDayLabel(date)[0]}</span>
            {log?.value != null && cat.dailyType === "number" && <span style={{ fontSize: 8 }}>{log.value}</span>}
          </button>
        );
      })}
    </div>
  );
}

function GoalCard({ goal, memberId, logs, weekDates, onLog, compact }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
  const { totalFine, detail } = calcWeekFine(goal, logs, weekDates, memberId);
  return (
    <div style={{
      background: "#0d0d0d", border: `1px solid ${totalFine > 0 ? "rgba(255,85,85,0.3)" : C.border}`,
      borderRadius: 10, padding: compact ? "10px 12px" : "14px 16px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{cat.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{goal.name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{detail}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: totalFine > 0 ? C.red : C.muted, fontWeight: 600 }}>
            {totalFine > 0 ? `₹${totalFine.toLocaleString("en-IN")}` : "✓ on track"}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>this week</div>
        </div>
      </div>
      {!compact && <WeekDots goal={goal} memberId={memberId} logs={logs} weekDates={weekDates} onLog={onLog} />}
    </div>
  );
}

function LogModal({ open, onClose, goal, date, existingLog, onSave }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal?.category) || GOAL_CATEGORIES[7];
  const [done, setDone] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setDone(existingLog?.done || false);
      setValue(existingLog?.value != null ? String(existingLog.value) : "");
      setNote(existingLog?.note || "");
    }
  }, [open, existingLog]);

  if (!open || !goal) return null;

  return (
    <Modal open={open} title={`LOG — ${getDayLabel(date || "")} ${formatDate(date || "")}`} onClose={onClose} maxWidth={380}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{cat.icon} {goal.name}</div>
      {cat.dailyType === "tick" ? (
        <Field label="Did you complete this today?">
          <div style={{ display: "flex", gap: 10 }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setDone(v)} style={{
                flex: 1, padding: 12, borderRadius: 10,
                border: `2px solid ${done === v ? C.lime : C.border2}`,
                background: done === v ? "rgba(200,245,59,0.1)" : "#0c0c0c",
                color: done === v ? C.lime : C.muted, cursor: "pointer", fontWeight: 600, fontSize: 14,
              }}>{v ? "✅ Yes" : "❌ No"}</button>
            ))}
          </div>
        </Field>
      ) : (
        <Field label={`How many ${cat.unit}?${goal.category === "junk" ? " (junk meals eaten)" : ""}`}>
          <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={`Enter ${cat.unit}`} style={IS} min="0" step="0.1" />
        </Field>
      )}
      <Field label="Note (optional)">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. skipped due to travel" style={IS} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button style={BO} onClick={onClose}>Cancel</button>
        <button style={BP} onClick={() => onSave(cat.dailyType === "tick" ? { done, note } : { value: parseFloat(value) || 0, note })}>Save →</button>
      </div>
    </Modal>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState({});
  const [banter, setBanter] = useState([]);
  const [settings, setSettings] = useState({ groupName: "FitPact Squad", appUrl: "", adminPin: ADMIN_PIN, startDate: new Date().toISOString() });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeMember, setActiveMember] = useState(null);

  const [addMemberModal, setAddMemberModal] = useState(false);
  const [editMemberModal, setEditMemberModal] = useState(null);
  const [addGoalModal, setAddGoalModal] = useState(false);
  const [editGoalModal, setEditGoalModal] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [banterModal, setBanterModal] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [memberDetailModal, setMemberDetailModal] = useState(null);
  const [pinInput, setPinInput] = useState("");

  const weekDates = getWeekDates(0);
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  useEffect(() => {
    const unsubs = [
      listenSettings(s => { if (s) setSettings(prev => ({ ...prev, ...s })); setLoading(false); }),
      listenMembers(setMembers),
      listenGoals(setGoals),
      listenLogs(setLogs),
      listenBanter(setBanter),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const tryAdmin = () => {
    if (pinInput === (settings.adminPin || ADMIN_PIN)) {
      setIsAdmin(true); setAdminModal(false); setPinInput(""); showToast("Admin mode unlocked 🔓");
    } else { showToast("Wrong PIN ❌"); }
  };

  const [mForm, setMForm] = useState({ name: "", emoji: "", dob: "", weight: "", height: "", fitnessGoal: "" });
  const saveMemberForm = async (id) => {
    if (!mForm.name.trim()) { showToast("Name required"); return; }
    const mid = id || `m_${uid()}`;
    await saveMember(mid, { ...mForm, createdAt: id ? undefined : new Date().toISOString() });
    setAddMemberModal(false); setEditMemberModal(null);
    setMForm({ name: "", emoji: "", dob: "", weight: "", height: "", fitnessGoal: "" });
    showToast(id ? "Member updated" : `${mForm.name} added 💪`);
  };
  const removeMember = async (id) => {
    if (!confirm("Remove this member?")) return;
    await deleteMember(id); showToast("Removed");
  };

  const [gForm, setGForm] = useState({ memberId: "", name: "", category: "gym", weeklyTarget: "", fineAmount: 1000, notes: "" });
  const saveGoalForm = async (id) => {
    if (!gForm.name.trim() || !gForm.memberId) { showToast("Fill all fields"); return; }
    const gid = id || `g_${uid()}`;
    await saveGoal(gid, { ...gForm, weeklyTarget: Number(gForm.weeklyTarget) || 0, fineAmount: Number(gForm.fineAmount) || 0, createdAt: id ? undefined : new Date().toISOString() });
    setAddGoalModal(false); setEditGoalModal(null);
    setGForm({ memberId: "", name: "", category: "gym", weeklyTarget: "", fineAmount: 1000, notes: "" });
    showToast(id ? "Goal updated" : "Goal added 🎯");
  };
  const removeGoal = async (id) => { if (!confirm("Delete goal?")) return; await deleteGoal(id); showToast("Deleted"); };

  const submitLog = async (data) => {
    if (!logModal || !activeMember) return;
    await saveLog(activeMember.id, logModal.goal.id, logModal.date, data);
    setLogModal(null); showToast("Logged ✅");
  };

  const [banterText, setBanterText] = useState("");
  const [banterAuthor, setBanterAuthor] = useState("");
  const submitBanter = async () => {
    if (!banterText.trim() || !banterAuthor.trim()) { showToast("Name + message required"); return; }
    await postBanter({ text: banterText.trim(), author: banterAuthor.trim() });
    setBanterText(""); setBanterModal(false); showToast("Posted 🗣️");
  };

  const getMemberFine = useCallback((memberId) =>
    goals.filter(g => g.memberId === memberId)
      .reduce((sum, g) => sum + calcWeekFine(g, logs, weekDates, memberId).totalFine, 0),
    [goals, logs, weekDates]);

  const getTotalFine = useCallback(() =>
    members.reduce((sum, m) => sum + getMemberFine(m.id), 0), [members, getMemberFine]);

  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28, color: C.lime, letterSpacing: 3 }}>LOADING FITPACT...</div>
    </div>
  );

  const leaderboard = [...members]
    .map(m => ({ ...m, fine: getMemberFine(m.id) }))
    .sort((a, b) => a.fine - b.fine);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        input:focus,select:focus,textarea:focus{border-color:#c8f53b!important;outline:none}
        .tab-b{background:transparent;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;padding:8px 14px;border-radius:8px;transition:all .18s;white-space:nowrap;color:#666}
        .tab-b.on{background:#c8f53b;color:#0a0a0a} .tab-b:hover:not(.on){background:#1a1a1a;color:#ddd}
        .hov:hover{border-color:#333!important}
        .btn-wa{background:#25d366;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
      `}</style>

      {/* NAV */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "rgba(10,10,10,0.97)", backdropFilter: "blur(14px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, letterSpacing: 2, color: C.lime }}>FIT</span>
          <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, letterSpacing: 2 }}>PACT</span>
          <span style={{ fontSize: 12, color: "#444", marginLeft: 4 }}>{settings.groupName}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={activeMember?.id || ""} onChange={e => setActiveMember(members.find(m => m.id === e.target.value) || null)}
            style={{ ...IS, width: "auto", fontSize: 12, padding: "5px 10px" }}>
            <option value="">Who are you?</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setAdminModal(true)} style={{
            background: isAdmin ? "rgba(200,245,59,0.1)" : "#1a1a1a",
            border: `1px solid ${isAdmin ? "rgba(200,245,59,0.3)" : C.border2}`,
            color: isAdmin ? C.lime : C.muted, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12,
          }}>{isAdmin ? "✓ Admin" : "🔐 Admin"}</button>
          <button onClick={() => setSettingsModal(true)} style={{ background: "#1a1a1a", border: `1px solid ${C.border2}`, color: C.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>⚙️</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 3, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {[["dashboard","📊 Dashboard"],["myweek","📋 My Week"],["squad","👥 Squad"],["fines","💸 Fines"],["banter","🗣️ Banter"],["members","⚙️ Members"]].map(([id, lbl]) => (
          <button key={id} className={`tab-b ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={{ padding: "18px 16px", maxWidth: 860, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
              <Pill label="Members" value={members.length} />
              <Pill label="Active Goals" value={goals.length} color={C.amber} />
              <Pill label="Fines This Week" value={`₹${getTotalFine().toLocaleString("en-IN")}`} color={getTotalFine() > 0 ? C.red : C.lime} />
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, marginBottom: 12 }}>THIS WEEK'S STANDINGS</div>
            {!members.length ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ color: C.text2, marginBottom: 12 }}>No squad members yet</div>
                {isAdmin && <button style={BP} onClick={() => setAddMemberModal(true)}>Add Members →</button>}
              </div>
            ) : leaderboard.map((m, rank) => {
              const RANK_C = ["#ffd700","#c0c0c0","#cd7f32"];
              const mGoalCount = goals.filter(g => g.memberId === m.id).length;
              return (
                <div key={m.id} className="hov" onClick={() => setMemberDetailModal(m)}
                  style={{ background: C.card, border: `1px solid ${rank === 0 && m.fine === 0 ? "rgba(200,245,59,0.3)" : C.border}`, borderRadius: 13, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "border-color .2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: RANK_C[rank] || "#333", width: 24, flexShrink: 0 }}>{rank + 1}</div>
                    <Avatar name={m.name} emoji={m.emoji} idx={members.findIndex(x => x.id === m.id)} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fitnessGoal || "No goal statement"}</div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Tag>{mGoalCount} goals</Tag>
                        {m.weight && <Tag>⚖️ {m.weight}kg</Tag>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: m.fine > 0 ? C.red : C.lime }}>
                        {m.fine > 0 ? `₹${m.fine.toLocaleString("en-IN")}` : "✓ clean"}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>this week</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {members.length > 0 && (
              <button className="btn-wa" style={{ marginTop: 12 }}
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildWAMsg(members, goals, logs, settings))}`, "_blank")}>
                📱 Share Weekly Update to WhatsApp
              </button>
            )}
          </div>
        )}

        {/* MY WEEK */}
        {tab === "myweek" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28, marginBottom: 6 }}>MY WEEK</div>
            {!activeMember ? (
              <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 12, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: C.lime, marginBottom: 12 }}>Select your name at the top to log your week</div>
                <select value="" onChange={e => setActiveMember(members.find(m => m.id === e.target.value) || null)} style={{ ...IS, width: "auto", fontSize: 14 }}>
                  <option value="">Who are you?</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={activeMember.name} emoji={activeMember.emoji} idx={members.findIndex(m => m.id === activeMember.id)} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{activeMember.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{activeMember.fitnessGoal}</div>
                    <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                      {activeMember.weight && <Tag>⚖️ {activeMember.weight}kg</Tag>}
                      {activeMember.height && <Tag>📏 {activeMember.height}cm</Tag>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: getMemberFine(activeMember.id) > 0 ? C.red : C.lime }}>
                      ₹{getMemberFine(activeMember.id).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>fines this week</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 18, overflowX: "auto" }}>
                  {weekDates.map(d => (
                    <div key={d} style={{ flex: 1, minWidth: 38, textAlign: "center", padding: "7px 4px", borderRadius: 8, background: d === today() ? "rgba(200,245,59,0.1)" : "#111", border: `1px solid ${d === today() ? "rgba(200,245,59,0.3)" : C.border}` }}>
                      <div style={{ fontSize: 9, color: C.muted }}>{getDayLabel(d)}</div>
                      <div style={{ fontSize: 11, color: d === today() ? C.lime : C.text2, fontWeight: d === today() ? 700 : 400 }}>{formatDate(d).split(" ")[0]}</div>
                    </div>
                  ))}
                </div>

                {goals.filter(g => g.memberId === activeMember.id).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: C.muted }}>
                    <div style={{ fontSize: 13, marginBottom: 10 }}>No goals set yet</div>
                    {isAdmin && <button style={{ ...BP, fontSize: 13 }} onClick={() => { setGForm(f => ({ ...f, memberId: activeMember.id })); setAddGoalModal(true); }}>+ Add Goal</button>}
                  </div>
                ) : goals.filter(g => g.memberId === activeMember.id).map(goal => (
                  <GoalCard key={goal.id} goal={goal} memberId={activeMember.id} logs={logs} weekDates={weekDates}
                    onLog={(g, d, l) => setLogModal({ goal: g, date: d, log: l })} />
                ))}
              </>
            )}
          </div>
        )}

        {/* SQUAD */}
        {tab === "squad" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28, marginBottom: 16 }}>SQUAD THIS WEEK</div>
            {members.map((m, idx) => {
              const mGoals = goals.filter(g => g.memberId === m.id);
              const fine = getMemberFine(m.id);
              return (
                <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: mGoals.length ? 12 : 0 }}>
                    <Avatar name={m.name} emoji={m.emoji} idx={idx} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{m.fitnessGoal}</div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: fine > 0 ? C.red : C.lime }}>
                      {fine > 0 ? `-₹${fine.toLocaleString("en-IN")}` : "✓ clean"}
                    </div>
                  </div>
                  {mGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} memberId={m.id} logs={logs} weekDates={weekDates} compact />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* FINES */}
        {tab === "fines" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28, marginBottom: 6 }}>FINE LEDGER</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Live — updates instantly as people log.</div>
            {members.map((m, idx) => {
              const mGoals = goals.filter(g => g.memberId === m.id);
              const totalFine = getMemberFine(m.id);
              return (
                <div key={m.id} style={{ background: C.card, border: `1px solid ${totalFine > 0 ? "rgba(255,85,85,0.3)" : C.border}`, borderRadius: 13, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: mGoals.length ? 12 : 0 }}>
                    <Avatar name={m.name} emoji={m.emoji} idx={idx} size={38} />
                    <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                    <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: totalFine > 0 ? C.red : C.lime }}>₹{totalFine.toLocaleString("en-IN")}</div>
                  </div>
                  {mGoals.map(goal => {
                    const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                    const { totalFine: gFine, detail } = calcWeekFine(goal, logs, weekDates, m.id);
                    return (
                      <div key={goal.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#0d0d0d", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                        <span>{cat.icon} {goal.name}</span>
                        <span style={{ color: C.muted, fontSize: 12 }}>{detail}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: gFine > 0 ? C.red : C.muted, fontWeight: 600 }}>{gFine > 0 ? `₹${gFine.toLocaleString("en-IN")}` : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.2)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div style={{ fontSize: 13, color: C.muted }}>Total pot this week</div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 34, color: C.lime }}>₹{getTotalFine().toLocaleString("en-IN")}</div>
            </div>
          </div>
        )}

        {/* BANTER */}
        {tab === "banter" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28 }}>SQUAD BANTER</div>
              <button style={BP} onClick={() => setBanterModal(true)}>+ Post</button>
            </div>
            {!banter.length ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗣️</div>
                <div>Be the first to post</div>
              </div>
            ) : banter.map(b => {
              const mIdx = members.findIndex(m => m.name === b.author);
              const clr = mIdx >= 0 ? COLORS[mIdx % COLORS.length] : "#888";
              const ts = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date();
              return (
                <div key={b.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: "13px 15px", marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontWeight: 700, color: clr, fontSize: 13 }}>{b.author}</span>
                    <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>
                      {ts.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "#ccc", lineHeight: 1.55 }}>{b.text}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* MEMBERS (ADMIN) */}
        {tab === "members" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 28 }}>MEMBERS & GOALS</div>
              {isAdmin && <button style={BP} onClick={() => { setMForm({ name: "", emoji: "", dob: "", weight: "", height: "", fitnessGoal: "" }); setAddMemberModal(true); }}>+ Add Member</button>}
            </div>
            {!isAdmin && (
              <div style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: C.amber }}>
                🔐 Admin mode required to manage members and goals
              </div>
            )}
            {members.map((m, idx) => {
              const mGoals = goals.filter(g => g.memberId === m.id);
              return (
                <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <Avatar name={m.name} emoji={m.emoji} idx={idx} size={48} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{m.fitnessGoal}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {m.weight && <Tag>⚖️ {m.weight}kg</Tag>}
                        {m.height && <Tag>📏 {m.height}cm</Tag>}
                        {m.dob && <Tag>🎂 {formatDate(m.dob)}</Tag>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button onClick={() => { setMForm({ name: m.name, emoji: m.emoji || "", dob: m.dob || "", weight: m.weight || "", height: m.height || "", fitnessGoal: m.fitnessGoal || "" }); setEditMemberModal(m.id); }} style={{ ...BO, fontSize: 12, padding: "6px 12px" }}>Edit</button>
                        <button onClick={() => removeMember(m.id)} style={{ background: "transparent", border: "1px solid rgba(255,85,85,0.3)", color: C.red, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>Remove</button>
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Goals ({mGoals.length})</div>
                      {isAdmin && <button onClick={() => { setGForm(f => ({ ...f, memberId: m.id })); setAddGoalModal(true); }} style={{ ...BP, fontSize: 11, padding: "5px 12px" }}>+ Add Goal</button>}
                    </div>
                    {mGoals.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#444", fontStyle: "italic" }}>No goals yet</div>
                    ) : mGoals.map(goal => {
                      const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[7];
                      return (
                        <div key={goal.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0d0d0d", borderRadius: 8, marginBottom: 6 }}>
                          <span>{cat.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{goal.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>Target: {goal.weeklyTarget} {cat.unit}/wk · Fine: ₹{Number(goal.fineAmount).toLocaleString("en-IN")} per miss</div>
                          </div>
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { setGForm({ memberId: m.id, name: goal.name, category: goal.category, weeklyTarget: String(goal.weeklyTarget), fineAmount: goal.fineAmount, notes: goal.notes || "" }); setEditGoalModal(goal.id); }}
                                style={{ background: "#1a1a1a", border: `1px solid ${C.border2}`, color: C.muted, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Edit</button>
                              <button onClick={() => removeGoal(goal.id)}
                                style={{ background: "transparent", border: "1px solid rgba(255,85,85,0.25)", color: C.red, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Member Detail */}
      <Modal open={!!memberDetailModal} title={memberDetailModal?.name?.toUpperCase() || ""} onClose={() => setMemberDetailModal(null)} maxWidth={560}>
        {memberDetailModal && (() => {
          const m = memberDetailModal;
          const mGoals = goals.filter(g => g.memberId === m.id);
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <Avatar name={m.name} emoji={m.emoji} idx={members.findIndex(x => x.id === m.id)} size={60} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{m.fitnessGoal}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {m.weight && <Tag>⚖️ {m.weight}kg</Tag>}
                    {m.height && <Tag>📏 {m.height}cm</Tag>}
                    {m.dob && <Tag>🎂 {formatDate(m.dob)}</Tag>}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 18, color: C.lime, marginBottom: 10 }}>THIS WEEK'S GOALS</div>
              {mGoals.map(goal => <GoalCard key={goal.id} goal={goal} memberId={m.id} logs={logs} weekDates={weekDates} />)}
            </>
          );
        })()}
      </Modal>

      {/* Add Member */}
      <Modal open={addMemberModal} title="ADD MEMBER" onClose={() => setAddMemberModal(false)}>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Name" row><input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" style={IS} /></Field>
          <Field label="Emoji" row><input value={mForm.emoji} onChange={e => setMForm(f => ({ ...f, emoji: e.target.value }))} placeholder="💪" style={{ ...IS, width: 70 }} maxLength={2} /></Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Weight (kg)" row><input type="number" value={mForm.weight} onChange={e => setMForm(f => ({ ...f, weight: e.target.value }))} placeholder="70" style={IS} /></Field>
          <Field label="Height (cm)" row><input type="number" value={mForm.height} onChange={e => setMForm(f => ({ ...f, height: e.target.value }))} placeholder="175" style={IS} /></Field>
        </div>
        <Field label="Date of Birth"><input type="date" value={mForm.dob} onChange={e => setMForm(f => ({ ...f, dob: e.target.value }))} style={IS} /></Field>
        <Field label="Fitness Goal Statement"><textarea value={mForm.fitnessGoal} onChange={e => setMForm(f => ({ ...f, fitnessGoal: e.target.value }))} placeholder="e.g. Lose 8kg, get fit before my 35th birthday" rows={2} style={{ ...IS, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={BO} onClick={() => setAddMemberModal(false)}>Cancel</button>
          <button style={BP} onClick={() => saveMemberForm(null)}>Add to Squad →</button>
        </div>
      </Modal>

      {/* Edit Member */}
      <Modal open={!!editMemberModal} title="EDIT MEMBER" onClose={() => setEditMemberModal(null)}>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Name" row><input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} style={IS} /></Field>
          <Field label="Emoji" row><input value={mForm.emoji} onChange={e => setMForm(f => ({ ...f, emoji: e.target.value }))} style={{ ...IS, width: 70 }} maxLength={2} /></Field>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Weight (kg)" row><input type="number" value={mForm.weight} onChange={e => setMForm(f => ({ ...f, weight: e.target.value }))} style={IS} /></Field>
          <Field label="Height (cm)" row><input type="number" value={mForm.height} onChange={e => setMForm(f => ({ ...f, height: e.target.value }))} style={IS} /></Field>
        </div>
        <Field label="Date of Birth"><input type="date" value={mForm.dob} onChange={e => setMForm(f => ({ ...f, dob: e.target.value }))} style={IS} /></Field>
        <Field label="Fitness Goal Statement"><textarea value={mForm.fitnessGoal} onChange={e => setMForm(f => ({ ...f, fitnessGoal: e.target.value }))} rows={2} style={{ ...IS, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={BO} onClick={() => setEditMemberModal(null)}>Cancel</button>
          <button style={BP} onClick={() => saveMemberForm(editMemberModal)}>Save Changes →</button>
        </div>
      </Modal>

      {/* Add Goal */}
      <Modal open={addGoalModal} title="ADD GOAL" onClose={() => setAddGoalModal(false)}>
        <Field label="For Member">
          <select value={gForm.memberId} onChange={e => setGForm(f => ({ ...f, memberId: e.target.value }))} style={IS}>
            <option value="">Select member</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Goal Name"><input value={gForm.name} onChange={e => setGForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gym 3x/week, No chips, Sleep before midnight" style={IS} /></Field>
        <Field label="Category">
          <select value={gForm.category} onChange={e => setGForm(f => ({ ...f, category: e.target.value }))} style={IS}>
            {GOAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label={`Weekly Target (${(GOAL_CATEGORIES.find(c => c.id === gForm.category) || GOAL_CATEGORIES[0]).unit})`} row>
            <input type="number" value={gForm.weeklyTarget} onChange={e => setGForm(f => ({ ...f, weeklyTarget: e.target.value }))} placeholder={gForm.category === "junk" ? "Max allowed" : "Min target"} style={IS} min="0" />
          </Field>
          <Field label="Fine per miss (₹)" row>
            <input type="number" value={gForm.fineAmount} onChange={e => setGForm(f => ({ ...f, fineAmount: e.target.value }))} style={IS} min="0" step="100" />
          </Field>
        </div>
        <div style={{ background: "rgba(200,245,59,0.05)", border: "1px solid rgba(200,245,59,0.15)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {gForm.category === "junk" ? `💡 Each junk meal over the limit = ₹${gForm.fineAmount || 0} fine` : `💡 Miss the weekly target = ₹${gForm.fineAmount || 0} fine`}
        </div>
        <Field label="Notes (optional)"><input value={gForm.notes} onChange={e => setGForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. 2 cheat meals allowed" style={IS} /></Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={BO} onClick={() => setAddGoalModal(false)}>Cancel</button>
          <button style={BP} onClick={() => saveGoalForm(null)}>Add Goal →</button>
        </div>
      </Modal>

      {/* Edit Goal */}
      <Modal open={!!editGoalModal} title="EDIT GOAL" onClose={() => setEditGoalModal(null)}>
        <Field label="Goal Name"><input value={gForm.name} onChange={e => setGForm(f => ({ ...f, name: e.target.value }))} style={IS} /></Field>
        <Field label="Category">
          <select value={gForm.category} onChange={e => setGForm(f => ({ ...f, category: e.target.value }))} style={IS}>
            {GOAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Weekly Target" row><input type="number" value={gForm.weeklyTarget} onChange={e => setGForm(f => ({ ...f, weeklyTarget: e.target.value }))} style={IS} min="0" /></Field>
          <Field label="Fine per miss (₹)" row><input type="number" value={gForm.fineAmount} onChange={e => setGForm(f => ({ ...f, fineAmount: e.target.value }))} style={IS} min="0" step="100" /></Field>
        </div>
        <Field label="Notes"><input value={gForm.notes} onChange={e => setGForm(f => ({ ...f, notes: e.target.value }))} style={IS} /></Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={BO} onClick={() => setEditGoalModal(null)}>Cancel</button>
          <button style={BP} onClick={() => saveGoalForm(editGoalModal)}>Save Changes →</button>
        </div>
      </Modal>

      {/* Log */}
      <LogModal open={!!logModal} onClose={() => setLogModal(null)} goal={logModal?.goal} date={logModal?.date} existingLog={logModal?.log} onSave={submitLog} />

      {/* Banter */}
      <Modal open={banterModal} title="POST TO BANTER" onClose={() => setBanterModal(false)} maxWidth={400}>
        <Field label="Your Name">
          <select value={banterAuthor} onChange={e => setBanterAuthor(e.target.value)} style={IS}>
            <option value="">Pick your name</option>
            {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Message"><textarea value={banterText} onChange={e => setBanterText(e.target.value)} rows={4} placeholder="Drop a win, call someone out 🔥" style={{ ...IS, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={BO} onClick={() => setBanterModal(false)}>Cancel</button>
          <button style={BP} onClick={submitBanter}>Post 🗣️</button>
        </div>
      </Modal>

      {/* Admin PIN */}
      <Modal open={adminModal} title="ADMIN LOGIN" onClose={() => setAdminModal(false)} maxWidth={340}>
        <Field label="Enter Admin PIN">
          <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryAdmin()} placeholder="PIN" style={IS} autoFocus />
        </Field>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Default PIN: 1234 — change it in Settings after logging in</div>
        <button style={{ ...BP, width: "100%" }} onClick={tryAdmin}>Unlock →</button>
      </Modal>

      {/* Settings */}
      <Modal open={settingsModal} title="SETTINGS" onClose={() => setSettingsModal(false)}>
        {!isAdmin ? (
          <div style={{ textAlign: "center", padding: 20, color: C.muted, fontSize: 14 }}>Admin mode required</div>
        ) : (
          <>
            <Field label="Group Name"><input value={settings.groupName} onChange={e => setSettings(s => ({ ...s, groupName: e.target.value }))} style={IS} /></Field>
            <Field label="App URL (for WhatsApp share)"><input value={settings.appUrl || ""} onChange={e => setSettings(s => ({ ...s, appUrl: e.target.value }))} placeholder="fitpact-xxx.vercel.app" style={IS} /></Field>
            <Field label="Admin PIN"><input type="password" value={settings.adminPin || ""} onChange={e => setSettings(s => ({ ...s, adminPin: e.target.value }))} placeholder="Change PIN" style={IS} /></Field>
            <Field label="Challenge Start Date"><input type="date" value={settings.startDate?.split("T")[0] || ""} onChange={e => setSettings(s => ({ ...s, startDate: new Date(e.target.value).toISOString() }))} style={IS} /></Field>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button style={BO} onClick={() => setSettingsModal(false)}>Cancel</button>
              <button style={BP} onClick={async () => { await saveSettings(settings); setSettingsModal(false); showToast("Saved ✅"); }}>Save →</button>
            </div>
          </>
        )}
      </Modal>

      <Toast msg={toast} />
    </div>
  );
}
