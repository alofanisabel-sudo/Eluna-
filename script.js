// ─────────────────────────────────────────────
// Étape 2 : Eluna répond vraiment maintenant.
// Chaque message est envoyé à une fonction Netlify
// (netlify/functions/eluna-chat.js) qui elle-même
// appelle l'API Claude — la clé API reste cachée
// côté serveur, jamais visible dans le navigateur.
//
// Note : pour l'instant, l'historique de conversation
// vit uniquement dans la page (variable "history").
// Si tu recharges la page, Eluna "oublie" tout —
// c'est normal, la vraie mémoire (Firebase) arrive
// à l'étape suivante.
// ─────────────────────────────────────────────

const chat = document.getElementById('chat');
const form = document.getElementById('composer-form');
const input = document.getElementById('input');

// Historique de la conversation en cours (perdu au rechargement)
const history = [];

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
  } catch (err) {
    bubble.textContent = "Un problème de connexion m'empêche de répondre là. Vérifie ta connexion et réessaie.";
    console.error(err);
  }

  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

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
