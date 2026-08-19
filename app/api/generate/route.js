import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { tryConsumeGeneration } from "../../../lib/generationLimits";

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

  // Étape 1 — identifier la personne connectée. Sans ça, impossible de savoir
  // à quel compte imputer le quota, et n'importe qui pourrait appeler cette
  // route directement (même sans être abonnée) puisqu'elle n'était pas protégée.
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json(
      { error: "Vous devez être connectée pour générer du contenu." },
      { status: 401 }
    );
  }

  // Étape 2 — vérifier ET réserver une génération AVANT l'appel coûteux à Anthropic.
  // Atomique côté DB : deux clics simultanés ne peuvent pas tous les deux passer
  // si un seul crédit reste au compteur.
  const db = supabaseAdmin();
  const quota = await tryConsumeGeneration(db, user.id);

  if (!quota.allowed) {
    const message = quota.error
      ? "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant."
      : `Tu as atteint ta limite de ${quota.generationLimit} générations pour ce cycle. ` +
        `Ton quota sera renouvelé le ${new Date(quota.periodEnd).toLocaleDateString("fr-CA")}.`;

    return Response.json(
      {
        error: message,
        generationsUsed: quota.generationsUsed,
        generationLimit: quota.generationLimit,
        periodEnd: quota.periodEnd,
      },
      { status: 429 } // 429 = Too Many Requests, code standard pour un quota dépassé
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
    return Response.json({
      text,
      quotaInfo: {
        generationsUsed: quota.generationsUsed,
        generationLimit: quota.generationLimit,
      },
    });
  } catch (e) {
    // Note : le quota a déjà été décompté même si l'appel Anthropic échoue ici
    // (ex. panne réseau). C'est voulu — ça évite qu'une personne mal intentionnée
    // multiplie les appels qui échouent volontairement pour contourner le compteur.
    return Response.json({ error: e.message || "Erreur réseau vers Anthropic." }, { status: 502 });
  }
}
