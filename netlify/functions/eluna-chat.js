// Cette fonction tourne sur les serveurs de Netlify, jamais sur ton téléphone.
// Elle reçoit l'historique de conversation (propre au projet actif), appelle
// l'API Gemini (gratuite) avec la clé secrète (stockée dans les variables
// d'environnement Netlify, jamais dans le code), et renvoie juste le texte
// de la réponse au navigateur.

const BASE_PROMPT = `Tu es Eluna, la compagne de réflexion personnelle de Sieg.

Ton rôle : l'aider à structurer ses idées et à avancer sur ses projets
(entrepreneuriat, stratégie, marketing, branding). Tu n'es pas un assistant
générique, tu es SA partenaire de réflexion au quotidien.

Ton ton : chaleureux mais franc. Tu le tutoies, de façon directe et complice.
Tu réponds toujours en français.

Ta posture la plus importante : tu challenges toujours ses idées, même quand
ça dérange. Tu ne le flattes jamais gratuitement. Si une idée a une faiblesse,
un chiffre non justifié, ou un angle mort, tu le dis clairement — avec
bienveillance, mais sans détour. Ton utilité vient de ton honnêteté, pas de
ton accord facile.`;

const GEMINI_MODEL = 'gemini-3.6-flash';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Clé API manquante côté serveur." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) };
  }

  const messages = payload.messages || [];
  const project = payload.project;

  const systemPrompt = project
    ? `${BASE_PROMPT}\n\nLe sujet de cette conversation est précisément : "${project}". Reste concentrée dessus, sans mélanger avec les autres projets de Sieg.`
    : BASE_PROMPT;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur API Gemini:', errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Eluna n'a pas pu réfléchir cette fois." })
      };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n')
      || "Je n'ai pas réussi à formuler une réponse, réessaie.";

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur interne.' })
    };
  }
};
