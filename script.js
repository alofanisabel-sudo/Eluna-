// ─────────────────────────────────────────────
// Étape 4 : la voix.
// - Micro : appui pour parler, appui pour arrêter — le texte
//   reconnu est ajouté dans la zone de saisie (rien n'est envoyé
//   automatiquement, tu gardes le contrôle avant d'envoyer).
// - Écoute : chaque réponse d'Eluna a un petit bouton 🔊 pour
//   l'entendre à voix haute, seulement si tu le demandes.
// ─────────────────────────────────────────────

import { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc, setDoc }
  from './firebase-config.js';

const chat = document.getElementById('chat');
const form = document.getElementById('composer-form');
const input = document.getElementById('input');
const micBtn = document.getElementById('mic-btn');

let history = [];
let userId = null;
let ready = false;

const WELCOME = "Je suis là. À quoi tu penses aujourd'hui ?";

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

// ── Affichage des messages ──────────────────────

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  msg.appendChild(bubble);

  if (sender === 'eluna') {
    const listenBtn = document.createElement('button');
    listenBtn.type = 'button';
    listenBtn.className = 'listen-btn';
    listenBtn.setAttribute('aria-label', 'Écouter ce message');
    listenBtn.textContent = '🔊';
    listenBtn.addEventListener('click', () => speakText(bubble.textContent));
    msg.appendChild(listenBtn);
  }

  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function renderHistory() {
  chat.innerHTML = '';
  if (history.length === 0) {
    addMessage(WELCOME, 'eluna');
    return;
  }
  history.forEach((m) => {
    addMessage(m.content, m.role === 'user' ? 'user' : 'eluna');
  });
}

// ── Mémoire Firebase ─────────────────────────────

async function saveHistory() {
  if (!userId) return;
  try {
    await setDoc(doc(db, 'conversations', userId), { messages: history });
  } catch (err) {
    console.error('Erreur de sauvegarde Firestore :', err);
  }
}

async function loadHistory() {
  try {
    const snap = await getDoc(doc(db, 'conversations', userId));
    if (snap.exists()) {
      history = snap.data().messages || [];
    }
  } catch (err) {
    console.error('Erreur de chargement Firestore :', err);
  }
  renderHistory();
  ready = true;
}

// ── Discussion avec Eluna ────────────────────────

async function askEluna(userText) {
  history.push({ role: 'user', content: userText });

  const bubble = addMessage('...', 'eluna');

  try {
    const response = await fetch('/.netlify/functions/eluna-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });

    if (!response.ok) {
      throw new Error('Réponse serveur invalide');
    }

    const data = await response.json();
    const reply = data.reply || "Je n'ai pas réussi à réfléchir à ça, réessaie.";

    bubble.textContent = reply;
    history.push({ role: 'assistant', content: reply });

    await saveHistory();
  } catch (err) {
    bubble.textContent = "Un problème de connexion m'empêche de répondre là. Vérifie ta connexion et réessaie.";
    console.error(err);
  }

  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!ready) return;

  const text = input.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  input.value = '';
  input.style.height = 'auto';

  askEluna(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ── Voix : synthèse (Eluna qui parle) ────────────

function speakText(text) {
  if (!window.speechSynthesis) {
    alert("La synthèse vocale n'est pas disponible sur ce navigateur.");
    return;
  }
  window.speechSynthesis.cancel(); // arrête toute lecture en cours avant d'en lancer une nouvelle
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  const voices = window.speechSynthesis.getVoices();
  const frVoice = voices.find((v) => v.lang && v.lang.startsWith('fr'));
  if (frVoice) utterance.voice = frVoice;
  window.speechSynthesis.speak(utterance);
}

// ── Voix : reconnaissance (toi qui parles) ───────

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = input.value ? input.value + ' ' + transcript : transcript;
    input.dispatchEvent(new Event('input'));
  };

  recognition.onend = () => {
    recording = false;
    micBtn.classList.remove('recording');
  };

  recognition.onerror = (err) => {
    console.error('Erreur reconnaissance vocale :', err);
    recording = false;
    micBtn.classList.remove('recording');
  };
} else {
  micBtn.style.display = 'none'; // navigateur non compatible, on cache le bouton plutôt que de le laisser planté
}

micBtn.addEventListener('click', () => {
  if (!recognition) return;

  if (recording) {
    recognition.stop();
  } else {
    recording = true;
    micBtn.classList.add('recording');
    recognition.start();
  }
});

// ── Connexion et chargement de la mémoire ────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    loadHistory();
  }
});
signInAnonymously(auth).catch((err) => {
  console.error('Erreur de connexion Firebase :', err);
  addMessage("Je n'arrive pas à me connecter à ta mémoire pour l'instant.", 'eluna');
});
