// app/api/generate/route.js
// EXEMPLE D'INTÉGRATION — à répéter dans CHACUNE de tes routes qui appellent
// l'API Anthropic (hebdomadaire, journée pédagogique, concertation, mercredi
// maternelle). Le principe est le même partout : vérifier/consommer le quota
// AVANT l'appel à askClaude, jamais après.

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { tryConsumeGeneration } from "../../../lib/generationLimits";
// import { askClaude } from "@/lib/askClaude"; // ton helper existant

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Étape 1 — vérifie ET réserve une génération avant tout appel coûteux à l'API.
  // Atomique côté DB : deux clics simultanés ne peuvent pas tous les deux passer
  // si un seul crédit reste au compteur.
  const db = supabaseAdmin();
  const quota = await tryConsumeGeneration(db, session.user.id);

  if (!quota.allowed) {
    const message = quota.error
      ? "Impossible de vérifier ton quota pour le moment. Réessaie dans un instant."
      : `Tu as atteint ta limite de ${quota.generationLimit} générations pour ce cycle. ` +
        `Ton quota sera renouvelé le ${new Date(quota.periodEnd).toLocaleDateString("fr-CA")}.`;

    return NextResponse.json(
      {
        error: message,
        generationsUsed: quota.generationsUsed,
        generationLimit: quota.generationLimit,
      },
      { status: 429 } // 429 = Too Many Requests, code standard pour un quota dépassé
    );
  }

  // Étape 2 — le quota est réservé, on peut appeler l'API Anthropic normalement.
  try {
    const body = await request.json();
    // const result = await askClaude(buildBatchPrompt(body));
    // return NextResponse.json(result);

    return NextResponse.json({
      // ... ta réponse habituelle
      quotaInfo: {
        generationsUsed: quota.generationsUsed,
        generationLimit: quota.generationLimit,
      },
    });
  } catch (error) {
    // Note : le quota a déjà été décompté même si la génération échoue ensuite.
    // C'est un choix voulu (protège contre l'abus par appels répétés qui échouent
    // volontairement) — mais si tu préfères rembourser en cas d'erreur serveur,
    // ajoute ici un appel qui décrémente generations_used de 1.
    console.error("Erreur génération:", error);
    return NextResponse.json({ error: "Erreur de génération" }, { status: 500 });
  }
}
