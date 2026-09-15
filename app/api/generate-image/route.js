import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Génère une image via l'API OpenAI (modèle gpt-image-1-mini, qualité
// standard) à partir d'une description. La clé API reste entièrement
// côté serveur (process.env.OPENAI_API_KEY) — jamais envoyée au
// navigateur. Retourne l'image encodée en base64, prête à afficher
// directement (data:image/png;base64,...), sans dépendre d'une URL
// externe qui pourrait expirer.
export async function POST(request) {
  // Exige une session connectée, comme les autres routes de génération —
  // évite que quelqu'un consomme des crédits d'image sans être une
  // utilisatrice authentifiée de l'app.
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Vous devez être connectée." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { prompt } = body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Description d'image manquante." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt: prompt.trim(),
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data?.error?.message || "Erreur OpenAI." }, { status: response.status });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return Response.json({ error: "Aucune image reçue d'OpenAI." }, { status: 502 });
    }

    return Response.json({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    return Response.json({ error: e.message || "Erreur réseau." }, { status: 500 });
  }
}
