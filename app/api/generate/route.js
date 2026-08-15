// Cette route tourne côté serveur (jamais dans le navigateur). C'est ici,
// et seulement ici, que la vraie clé API Anthropic est utilisée — elle
// n'est jamais envoyée au client, contrairement à l'artefact Claude
// original où l'appel se faisait directement depuis le navigateur.

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Clé API Anthropic manquante sur le serveur (variable ANTHROPIC_API_KEY)." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { prompt, maxTokens = 3000 } = body || {};
  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "Le champ 'prompt' est requis." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data?.error?.message || `Erreur API Anthropic (${response.status})` },
        { status: response.status }
      );
    }

    const text = (data.content || []).map((b) => b.text || "").join("\n");
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e.message || "Erreur réseau vers Anthropic." }, { status: 502 });
  }
}
