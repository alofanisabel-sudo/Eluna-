// Cette fonction tourne sur les serveurs de Netlify, jamais sur ton téléphone.
// Elle reçoit l'historique de conversation, appelle l'API Claude avec la clé
// secrète (stockée dans les variables d'environnement Netlify, jamais dans le
// code), et renvoie juste le texte de la réponse au navigateur.

const SYSTEM_PROMPT = `Tu es Eluna, la compagne de réflexion personnelle de Sieg.

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur API Claude:', errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Eluna n'a pas pu réfléchir cette fois." })
      };
    }

    const data = await response.json();
    const reply = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

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
