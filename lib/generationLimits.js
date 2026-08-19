// lib/generationLimits.js
//
// Plafonds de générations par type de plan/statut, et fonction utilitaire
// qui vérifie ET consomme un crédit de génération de façon atomique côté
// base de données (via la fonction Postgres try_consume_generation),
// pour éviter que deux clics simultanés ne passent tous les deux si un
// seul crédit reste au compteur.

export const GENERATION_LIMITS = {
  trial: 5,
  monthly: 20,
  annual: 200,
};

// Retourne le bon plafond de générations selon le plan et le statut Stripe
// actuels de l'abonnement.
export function getGenerationLimit({ plan, status }) {
  if (status === "trialing") return GENERATION_LIMITS.trial;
  if (plan === "annual") return GENERATION_LIMITS.annual;
  if (plan === "monthly") return GENERATION_LIMITS.monthly;
  // Valeur de repli prudente si le plan n'est pas reconnu.
  return GENERATION_LIMITS.monthly;
}

// Vérifie si l'utilisatrice a encore un crédit de génération disponible,
// et le consomme immédiatement si oui — en un seul appel atomique à la
// fonction Postgres try_consume_generation(user_id), qui verrouille la
// ligne pendant l'opération.
export async function tryConsumeGeneration(db, userId) {
  const { data, error } = await db.rpc("try_consume_generation", {
    p_user_id: userId,
  });

  if (error) {
    return { allowed: false, error: true };
  }

  // La fonction Postgres retourne une seule ligne avec les colonnes
  // suivantes : allowed (boolean), generations_used, generation_limit,
  // period_end.
  const row = Array.isArray(data) ? data[0] : data;

  return {
    allowed: !!row?.allowed,
    error: false,
    generationsUsed: row?.generations_used,
    generationLimit: row?.generation_limit,
    periodEnd: row?.period_end,
  };
}
