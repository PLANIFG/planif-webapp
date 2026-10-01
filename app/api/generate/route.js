import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { tryConsumeGeneration, refundGeneration, STREAM_ERROR_MARKER } from "../../../lib/generationLimits";

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

  // Lire la requête AVANT de consommer un crédit : une requête mal formée
  // ne doit rien coûter.
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

  // Étape 2 — vérifier ET réserver une génération AVANT l'appel coûteux à Anthropic.
  // Atomique côté DB : deux clics simultanés ne peuvent pas tous les deux passer
  // si un seul crédit reste au compteur.
  const db = supabaseAdmin();
  const quota = await tryConsumeGeneration(db, user.id);
  if (!quota.allowed) {
    let message;
    if (quota.error) {
      message = "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant.";
    } else if ((quota.generationsUsed ?? 0) < (quota.generationLimit ?? 0)) {
      // Refusé alors qu'il reste des crédits : l'abonnement n'est pas
      // complété (aucune carte entrée) ou n'est plus actif.
      message = "Ton abonnement n'est pas actif. Complète ton abonnement pour générer des activités.";
    } else {
      // On valide que la date est réelle (ni vide, ni 1970-01-01, l'artefact
      // classique d'une date "zéro" en JavaScript) avant de l'afficher.
      const parsedDate = quota.periodEnd ? new Date(quota.periodEnd) : null;
      const hasValidDate = parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getTime() > 0;
      const renouvellement = hasValidDate
        ? `Ton quota sera renouvelé le ${parsedDate.toLocaleDateString("fr-CA")}.`
        : "Ton quota sera renouvelé au prochain cycle de facturation.";
      message = `Tu as atteint ta limite de ${quota.generationLimit} générations pour ce cycle. ${renouvellement}`;
    }
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

  // Étape 3 — appel à Anthropic EN STREAMING. Netlify coupe une réponse
  // normale après ~26 s, mais laisse jusqu'à 60 s à une réponse en streaming.
  // Les grilles de la semaine prennent souvent plus de 26 s : sans streaming,
  // la personne recevait une réponse vide ET perdait un crédit.
  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    await refundGeneration(db, user.id);
    return Response.json({ error: e.message || "Erreur réseau vers Anthropic." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Échec côté Anthropic (surcharge, panne…) : la personne n'y est pour
    // rien, on lui rend son crédit.
    await refundGeneration(db, user.id);
    let message = `Erreur API Anthropic (${upstream.status})`;
    try {
      const data = await upstream.json();
      message = data?.error?.message || message;
    } catch (_) {}
    return Response.json({ error: message }, { status: upstream.status || 502 });
  }

  // On relaie seulement le texte généré au navigateur, au fur et à mesure.
  // En cas d'erreur en cours de route, on rend le crédit et on ajoute un
  // marqueur d'erreur que le client reconnaît (STREAM_ERROR_MARKER).
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = "";
      let gotText = false;
      let finished = false;
      let failure = null;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            let evt;
            try {
              evt = JSON.parse(line.slice(5).trim());
            } catch (_) {
              continue;
            }
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              gotText = true;
              controller.enqueue(encoder.encode(evt.delta.text));
            } else if (evt.type === "message_stop") {
              finished = true;
            } else if (evt.type === "error") {
              failure = evt.error?.message || "Erreur Anthropic pendant la génération.";
            }
          }
        }
      } catch (e) {
        failure = e.message || "Connexion interrompue pendant la génération.";
      }
      if (!failure && !finished) failure = "La génération a été interrompue avant la fin.";
      if (failure) {
        await refundGeneration(db, user.id);
        controller.enqueue(encoder.encode(`${STREAM_ERROR_MARKER}${failure}`));
      } else if (!gotText) {
        await refundGeneration(db, user.id);
        controller.enqueue(encoder.encode(`${STREAM_ERROR_MARKER}Réponse vide de l'IA.`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Generations-Used": String(quota.generationsUsed ?? ""),
      "X-Generation-Limit": String(quota.generationLimit ?? ""),
    },
  });
}
