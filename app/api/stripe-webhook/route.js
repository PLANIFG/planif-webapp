import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getGenerationLimit } from "../../../lib/generationLimits";

// Stripe envoie ici automatiquement les événements (paiement réussi,
// annulation, échec de carte, etc.) — c'est ce qui garde Supabase à jour
// sans que personne n'ait à intervenir manuellement.

// Depuis la version "Basil" de l'API Stripe (31 mars 2025), les champs
// current_period_start/current_period_end n'existent plus directement sur
// l'objet Subscription — ils sont maintenant sur chaque "item" de
// l'abonnement (sub.items.data[0]). On lit donc à partir de là, avec un
// repli sur l'ancien emplacement au cas où le compte serait encore sur une
// version d'API plus ancienne.
function getPeriodBounds(sub) {
  const item = sub.items?.data?.[0];
  const start = item?.current_period_start ?? sub.current_period_start;
  const end = item?.current_period_end ?? sub.current_period_end;
  return { start, end };
}

export async function POST(request) {
  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return Response.json({ error: `Signature webhook invalide : ${err.message}` }, { status: 400 });
  }

  const db = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId) {
          // Note : le plafond d'essai (5) et les dates ont déjà été pré-initialisés
          // par la route /api/checkout au moment de créer la session. On ne les
          // touche pas ici pour ne pas écraser un essai déjà en cours.
          await db.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan,
            status: "trialing",
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;
        let status = "canceled";
        if (sub.status === "active") status = "active";
        else if (sub.status === "trialing") status = "trialing";
        else if (sub.status === "past_due") status = "past_due";
        if (userId) {
          const { start: periodStartRaw, end: periodEndRaw } = getPeriodBounds(sub);
          // Si Stripe ne fournit ni l'un ni l'autre emplacement (cas limite),
          // on garde les anciennes valeurs plutôt que de planter ou d'écrire
          // une date invalide.
          const { data: existing } = await db
            .from("subscriptions")
            .select("period_end")
            .eq("user_id", userId)
            .maybeSingle();

          const newPeriodEnd = periodEndRaw ? new Date(periodEndRaw * 1000).toISOString() : existing?.period_end || null;
          const newPeriodStart = periodStartRaw ? new Date(periodStartRaw * 1000).toISOString() : null;

          // On vérifie si on entre dans un NOUVEAU cycle de facturation avant
          // de remettre le compteur de générations à 0 — sinon un événement
          // "updated" sans changement de cycle (ex. mise à jour de carte)
          // effacerait injustement les générations déjà utilisées ce mois-ci.
          const isNewCycle = !existing || existing.period_end !== newPeriodEnd;
          const updatePayload = {
            user_id: userId,
            stripe_subscription_id: sub.id,
            status,
            plan,
            current_period_end: newPeriodEnd,
            period_start: newPeriodStart,
            period_end: newPeriodEnd,
            generation_limit: getGenerationLimit({ plan, status }),
            updated_at: new Date().toISOString(),
          };
          if (isNewCycle) {
            updatePayload.generations_used = 0;
          }
          await db.from("subscriptions").upsert(updatePayload);
        }
        break;
      }
      default:
        break; // autres événements ignorés
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  return Response.json({ received: true });
}
