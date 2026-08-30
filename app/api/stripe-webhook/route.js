import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getGenerationLimit } from "../../../lib/generationLimits";

// Stripe envoie ici automatiquement les événements (paiement réussi,
// annulation, échec de carte, etc.) — c'est ce qui garde Supabase à jour
// sans que personne n'ait à intervenir manuellement.
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
          const newPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
          const newPeriodStart = new Date(sub.current_period_start * 1000).toISOString();
          // On vérifie si on entre dans un NOUVEAU cycle de facturation avant
          // de remettre le compteur de générations à 0 — sinon un événement
          // "updated" sans changement de cycle (ex. mise à jour de carte)
          // effacerait injustement les générations déjà utilisées ce mois-ci.
          const { data: existing } = await db
            .from("subscriptions")
            .select("period_end")
            .eq("user_id", userId)
            .single();
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
