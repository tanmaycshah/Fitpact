import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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
export const analytics = getAnalytics(app);
