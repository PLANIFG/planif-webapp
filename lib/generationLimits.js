// lib/generationLimits.js
// Centralise les plafonds de génération par type de plan.
// Ajuste les valeurs ici si tes prix/plafonds changent — un seul endroit à modifier.

export const GENERATION_LIMITS = {
  trial: 5,
  monthly: 20,
  annual: 200,
};

/**
 * Détermine le plafond applicable à partir de l'identifiant de prix Stripe
 * et du statut de l'abonnement.
 */
export function getGenerationLimit({ stripePriceId, status }) {
  if (status === "trialing") return GENERATION_LIMITS.trial;

  if (stripePriceId === process.env.STRIPE_ANNUAL_PRICE_ID) {
    return GENERATION_LIMITS.annual;
  }
  // Défaut : mensuel (couvre aussi le cas où le price id mensuel est utilisé)
  return GENERATION_LIMITS.monthly;
}

/**
 * Appelle la fonction Postgres try_consume_generation, qui vérifie ET
 * incrémente le compteur de façon atomique (verrou de ligne côté DB).
 * Retourne { allowed, generationsUsed, generationLimit, periodEnd }.
 *
 * À appeler AVANT chaque appel à l'API Anthropic dans tes routes de génération.
 */
export async function tryConsumeGeneration(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .rpc("try_consume_generation", { p_user_id: userId })
    .single();

  if (error) {
    console.error("Erreur vérification quota génération:", error);
    // Fail-closed : en cas d'erreur inattendue, on bloque plutôt que de laisser
    // passer une génération non comptabilisée (protège tes coûts API).
    return { allowed: false, error: true };
  }

  return {
    allowed: data.allowed,
    generationsUsed: data.generations_used,
    generationLimit: data.generation_limit,
    periodEnd: data.period_end,
  };
}
