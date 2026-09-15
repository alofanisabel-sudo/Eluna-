// ─────────────────────────────────────────────
// Étape 3 : Eluna se souvient maintenant vraiment.
// À l'ouverture, on se connecte anonymement à Firebase,
// on récupère l'historique déjà sauvegardé (s'il existe),
// puis on continue la conversation. Chaque échange est
// ensuite réenregistré dans Firestore.
// ─────────────────────────────────────────────

import { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc, setDoc }
  from './firebase-config.js';

const chat = document.getElementById('chat');
const form = document.getElementById('composer-form');
const input = document.getElementById('input');

let history = [];
let userId = null;
let ready = false; // devient vrai une fois la mémoire chargée

// Message d'accueil par défaut, affiché seulement si aucun historique n'existe
const WELCOME = "Je suis là. À quoi tu penses aujourd'hui ?";

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
});

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  msg.appendChild(bubble);
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;

  return bubble;
}

// Réaffiche tous les messages sauvegardés au chargement de la page
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

// Sauvegarde l'historique complet dans Firestore, sous le document de cet utilisateur
async function saveHistory() {
  if (!userId) return;
  try {
    await setDoc(doc(db, 'conversations', userId), { messages: history });
  } catch (err) {
    console.error('Erreur de sauvegarde Firestore :', err);
  }
}

// Charge l'historique existant depuis Firestore, s'il y en a un
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

  if (!ready) return; // mémoire pas encore chargée, on ignore l'envoi

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

// Connexion anonyme au démarrage, puis chargement de la mémoire existante
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
