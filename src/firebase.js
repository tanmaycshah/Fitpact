import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCvTMLGczD4pMnexUFrmNKjt9LM7mFy8T0",
  authDomain: "fitpact-ss.firebaseapp.com",
  projectId: "fitpact-ss",
  storageBucket: "fitpact-ss.firebasestorage.app",
  messagingSenderId: "437083739617",
  appId: "1:437083739617:web:dc0998684bd654163ceea0",
  measurementId: "G-738Z4LKX54"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

// Stay logged in permanently on phone
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Offline cache so refresh never loses data
enableIndexedDbPersistence(db).catch(err => {
  if (err.code !== "failed-precondition" && err.code !== "unimplemented") console.error(err);
});
