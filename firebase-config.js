// ─────────────────────────────────────────────
// Ce fichier connecte l'app au projet Firebase "Eluna".
// C'est le SEUL fichier à modifier si un jour la config
// Firebase change (nouvelle clé, nouveau projet, etc.)
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt9ptZMqluzDGGTZfAGr8YmOToFQZbbcc",
  authDomain: "eluna-sieg.firebaseapp.com",
  projectId: "eluna-sieg",
  storageBucket: "eluna-sieg.firebasestorage.app",
  messagingSenderId: "169583194548",
  appId: "1:169583194548:web:50c1dbc8156a2d8dcb02e1",
  measurementId: "G-2GFPQT6EWN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc, setDoc };
