// ─────────────────────────────────────────────
// Étape 5 : la mémoire est maintenant découpée par projet.
// Chaque projet (KAGIS, P-O-N, Général...) a sa propre
// conversation, stockée séparément dans Firestore, sous :
//   users/{toi}/projects/{projet}
// Ça évite que tout se mélange, et ça garde chaque
// conversation légère (donc rapide et peu coûteuse à envoyer
// à Gemini), au lieu d'un seul historique qui grossirait à
// l'infini.
// ─────────────────────────────────────────────

import {
  auth, db, signInAnonymously, onAuthStateChanged,
  doc, getDoc, setDoc, collection, getDocs
} from './firebase-config.js';

const chat = document.getElementById('chat');
const form = document.getElementById('composer-form');
const input = document.getElementById('input');
const micBtn = document.getElementById('mic-btn');
const projectSelect = document.getElementById('project-select');
const addProjectBtn = document.getElementById('add-project-btn');
const newProjectRow = document.getElementById('new-project-row');
const newProjectInput = document.getElementById('new-project-input');
const confirmProjectBtn = document.getElementById('confirm-project-btn');

let history = [];
let userId = null;
let ready = false;
let activeProjectId = null;
let activeProjectName = null;
const LAST_PROJECT_KEY = 'eluna-active-project';

const WELCOME = "Je suis là. À quoi tu penses aujourd'hui ?";

// Transforme un nom de projet en identifiant simple pour Firestore
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'projet';
}

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

// ── Gestion des projets ──────────────────────────

function projectDocRef(projectId) {
  return doc(db, 'users', userId, 'projects', projectId);
}

async function loadProjectList() {
  const snap = await getDocs(collection(db, 'users', userId, 'projects'));
  const projects = [];
  snap.forEach((d) => projects.push({ id: d.id, name: d.data().name || d.id }));
  return projects;
}

function fillProjectSelect(projects) {
  projectSelect.innerHTML = '';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    projectSelect.appendChild(opt);
  });
}

async function switchToProject(projectId, projectName) {
  activeProjectId = projectId;
  activeProjectName = projectName;
  localStorage.setItem(LAST_PROJECT_KEY, projectId);
  projectSelect.value = projectId;

  const snap = await getDoc(projectDocRef(projectId));
  history = snap.exists() ? (snap.data().messages || []) : [];
  renderHistory();
}

async function initProjects() {
  let projects = await loadProjectList();

  if (projects.length === 0) {
    // Premier lancement : on crée un projet "Général" par défaut
    await setDoc(projectDocRef('general'), { name: 'Général', messages: [] });
    projects = [{ id: 'general', name: 'Général' }];
  }

  fillProjectSelect(projects);

  const lastId = localStorage.getItem(LAST_PROJECT_KEY);
  const match = projects.find((p) => p.id === lastId);
  const target = match || projects[0];

  await switchToProject(target.id, target.name);
  ready = true;
}

projectSelect.addEventListener('change', async () => {
  const selected = projectSelect.options[projectSelect.selectedIndex];
  ready = false;
  await switchToProject(selected.value, selected.textContent);
  ready = true;
});

addProjectBtn.addEventListener('click', () => {
  newProjectRow.classList.toggle('hidden');
  if (!newProjectRow.classList.contains('hidden')) {
    newProjectInput.focus();
  }
});

confirmProjectBtn.addEventListener('click', createNewProject);
newProjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createNewProject();
  }
});

async function createNewProject() {
  const name = newProjectInput.value.trim();
  if (!name) return;

  let id = slugify(name);
  // Évite d'écraser un projet existant portant un nom proche
  const existing = await getDoc(projectDocRef(id));
  if (existing.exists()) {
    id = id + '-' + Date.now().toString().slice(-4);
  }

  await setDoc(projectDocRef(id), { name, messages: [] });

  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = name;
  projectSelect.appendChild(opt);

  newProjectInput.value = '';
  newProjectRow.classList.add('hidden');

  ready = false;
  await switchToProject(id, name);
  ready = true;
}

// ── Mémoire Firebase ─────────────────────────────

async function saveHistory() {
  if (!userId || !activeProjectId) return;
  try {
    await setDoc(projectDocRef(activeProjectId), { name: activeProjectName, messages: history });
  } catch (err) {
    console.error('Erreur de sauvegarde Firestore :', err);
  }
}

// ── Discussion avec Eluna ────────────────────────

async function askEluna(userText) {
  history.push({ role: 'user', content: userText });

  const bubble = addMessage('...', 'eluna');

  try {
    const response = await fetch('/.netlify/functions/eluna-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, project: activeProjectName })
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
  window.speechSynthesis.cancel();
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
  micBtn.style.display = 'none';
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

// ── Connexion et chargement des projets ──────────

onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    initProjects();
  }
});
signInAnonymously(auth).catch((err) => {
  console.error('Erreur de connexion Firebase :', err);
  addMessage("Je n'arrive pas à me connecter à ta mémoire pour l'instant.", 'eluna');
});
