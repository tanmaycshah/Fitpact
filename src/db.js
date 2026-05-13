import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, updateDoc,
  deleteDoc, query, orderBy, serverTimestamp, getDoc
} from "firebase/firestore";

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export function listenSettings(cb) {
  return onSnapshot(doc(db, "settings", "main"), s => cb(s.exists() ? s.data() : null));
}
export async function saveSettings(data) {
  await setDoc(doc(db, "settings", "main"), data, { merge: true });
}

// ── USERS ─────────────────────────────────────────────────────────────────────
export function listenUsers(cb) {
  return onSnapshot(collection(db, "users"), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function getUser(uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function saveUser(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}
export async function approveUser(uid, memberId) {
  await setDoc(doc(db, "users", uid), { isPending: false, memberId, approvedAt: serverTimestamp() }, { merge: true });
}
export async function makeAdmin(uid, isAdmin) {
  await updateDoc(doc(db, "users", uid), { isAdmin });
}

// ── MEMBERS ───────────────────────────────────────────────────────────────────
export function listenMembers(cb) {
  return onSnapshot(query(collection(db, "members"), orderBy("createdAt", "asc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function saveMember(id, data) {
  await setDoc(doc(db, "members", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteMember(id) { await deleteDoc(doc(db, "members", id)); }

// ── GOALS ─────────────────────────────────────────────────────────────────────
export function listenGoals(cb) {
  return onSnapshot(query(collection(db, "goals"), orderBy("createdAt", "asc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function saveGoal(id, data) {
  await setDoc(doc(db, "goals", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteGoal(id) { await deleteDoc(doc(db, "goals", id)); }

// ── HOBBIES ───────────────────────────────────────────────────────────────────
export function listenHobbies(cb) {
  return onSnapshot(query(collection(db, "hobbies"), orderBy("createdAt", "asc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function saveHobby(id, data) {
  await setDoc(doc(db, "hobbies", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteHobby(id) { await deleteDoc(doc(db, "hobbies", id)); }

// ── DAY LOGS ──────────────────────────────────────────────────────────────────
export function listenDayLogs(cb) {
  return onSnapshot(collection(db, "dayLogs"), snap => {
    const logs = {};
    snap.docs.forEach(d => { logs[d.id] = d.data(); });
    cb(logs);
  });
}

// ── WEEK LOGS ─────────────────────────────────────────────────────────────────
export function listenWeekLogs(cb) {
  return onSnapshot(collection(db, "weekLogs"), s => {
    const logs = {};
    s.docs.forEach(d => { logs[d.id] = d.data(); });
    cb(logs);
  });
}
export async function saveWeekLog(memberId, goalId, weekKey, data) {
  const id = `${memberId}__${goalId}__${weekKey}`;
  await setDoc(doc(db, "weekLogs", id), { memberId, goalId, weekKey, ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ── HOBBY LOGS ────────────────────────────────────────────────────────────────
export function listenHobbyLogs(cb) {
  return onSnapshot(collection(db, "hobbyLogs"), s => {
    const logs = {};
    s.docs.forEach(d => { logs[d.id] = d.data(); });
    cb(logs);
  });
}
export async function saveHobbyLog(memberId, hobbyId, weekKey, data) {
  const id = `${memberId}__${hobbyId}__${weekKey}`;
  await setDoc(doc(db, "hobbyLogs", id), { memberId, hobbyId, weekKey, ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ── FINES ─────────────────────────────────────────────────────────────────────
export function listenFines(cb) {
  return onSnapshot(collection(db, "fines"), s => {
    const fines = {};
    s.docs.forEach(d => { fines[d.id] = d.data(); });
    cb(fines);
  });
}
export async function saveFine(memberId, weekKey, goalId, data) {
  const id = `${memberId}__${weekKey}__${goalId}`;
  await setDoc(doc(db, "fines", id), { memberId, weekKey, goalId, ...data, updatedAt: serverTimestamp() }, { merge: true });
}
export async function adminOverrideFine(memberId, weekKey, goalId, reason, adminName, customAmount) {
  const id = `${memberId}__${weekKey}__${goalId}`;
  await setDoc(doc(db, "fines", id), {
    memberId, weekKey, goalId,
    overridden: true, overrideReason: reason,
    overriddenBy: adminName, overriddenAt: serverTimestamp(),
    customAmount: customAmount != null ? customAmount : 0,
    amount: customAmount != null ? customAmount : 0,
  }, { merge: true });
}

// ── FINE PAYMENTS ─────────────────────────────────────────────────────────────
export function listenFinePayments(cb) {
  return onSnapshot(collection(db, "finePayments"), s => {
    const payments = {};
    s.docs.forEach(d => { payments[d.id] = d.data(); });
    cb(payments);
  });
}
export async function markFinePaid(memberId, weekKey, paidBy) {
  const id = `${memberId}__${weekKey}`;
  await setDoc(doc(db, "finePayments", id), { memberId, weekKey, paid: true, paidAt: serverTimestamp(), markedBy: paidBy }, { merge: true });
}
export async function markFineUnpaid(memberId, weekKey) {
  await setDoc(doc(db, "finePayments", `${memberId}__${weekKey}`), { paid: false }, { merge: true });
}

// ── WEEK NOTES ────────────────────────────────────────────────────────────────
export function listenWeekNotes(cb) {
  return onSnapshot(collection(db, "weekNotes"), s => {
    const notes = {};
    s.docs.forEach(d => { notes[d.id] = d.data(); });
    cb(notes);
  });
}
export async function saveWeekNote(memberId, weekKey, text) {
  const id = `${memberId}__${weekKey}`;
  await setDoc(doc(db, "weekNotes", id), { memberId, weekKey, text, updatedAt: serverTimestamp() }, { merge: true });
}

// ── ACTIVITY FEED ─────────────────────────────────────────────────────────────
export function listenActivity(cb) {
  return onSnapshot(query(collection(db, "activity"), orderBy("createdAt", "desc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function postActivity(data) {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await setDoc(doc(db, "activity", id), { ...data, createdAt: serverTimestamp() });
}

// ── BANTER ────────────────────────────────────────────────────────────────────
export function listenBanter(cb) {
  return onSnapshot(query(collection(db, "banter"), orderBy("createdAt", "desc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function postBanter(data) {
  await setDoc(doc(db, "banter", `b_${Date.now()}`), { ...data, createdAt: serverTimestamp() });
}

// ── MONTHS ────────────────────────────────────────────────────────────────────
export function listenMonths(cb) {
  return onSnapshot(query(collection(db, "months"), orderBy("startDate", "desc")), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function saveMonth(id, data) {
  await setDoc(doc(db, "months", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
