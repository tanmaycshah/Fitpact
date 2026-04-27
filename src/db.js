import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, updateDoc,
  deleteDoc, getDoc, query, orderBy, serverTimestamp
} from "firebase/firestore";

// ── COLLECTIONS ──────────────────────────────────────────────────────────────
const COL = {
  members:  "members",
  goals:    "goals",
  logs:     "logs",      // daily logs: logs/{memberId_YYYY-MM-DD_goalId}
  banter:   "banter",
  settings: "settings",
};

// ── SETTINGS ─────────────────────────────────────────────────────────────────
export function listenSettings(cb) {
  return onSnapshot(doc(db, COL.settings, "main"), snap => {
    cb(snap.exists() ? snap.data() : null);
  });
}

export async function saveSettings(data) {
  await setDoc(doc(db, COL.settings, "main"), data, { merge: true });
}

// ── MEMBERS ──────────────────────────────────────────────────────────────────
export function listenMembers(cb) {
  return onSnapshot(
    query(collection(db, COL.members), orderBy("createdAt", "asc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function saveMember(id, data) {
  await setDoc(doc(db, COL.members, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteMember(id) {
  await deleteDoc(doc(db, COL.members, id));
}

// ── GOALS ─────────────────────────────────────────────────────────────────────
export function listenGoals(cb) {
  return onSnapshot(
    query(collection(db, COL.goals), orderBy("createdAt", "asc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function saveGoal(id, data) {
  await setDoc(doc(db, COL.goals, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteGoal(id) {
  await deleteDoc(doc(db, COL.goals, id));
}

// ── DAILY LOGS ────────────────────────────────────────────────────────────────
// logId format: memberId__goalId__YYYY-MM-DD
export function listenLogs(cb) {
  return onSnapshot(collection(db, COL.logs), snap => {
    const logs = {};
    snap.docs.forEach(d => { logs[d.id] = d.data(); });
    cb(logs);
  });
}

export async function saveLog(memberId, goalId, date, data) {
  const id = `${memberId}__${goalId}__${date}`;
  await setDoc(doc(db, COL.logs, id), {
    memberId, goalId, date, ...data, updatedAt: serverTimestamp()
  }, { merge: true });
}

// ── BANTER ────────────────────────────────────────────────────────────────────
export function listenBanter(cb) {
  return onSnapshot(
    query(collection(db, COL.banter), orderBy("createdAt", "desc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function postBanter(data) {
  const id = `banter_${Date.now()}`;
  await setDoc(doc(db, COL.banter, id), { ...data, createdAt: serverTimestamp() });
}
