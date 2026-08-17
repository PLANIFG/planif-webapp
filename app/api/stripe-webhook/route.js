import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

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
        let status = "canceled";
        if (sub.status === "active") status = "active";
        else if (sub.status === "trialing") status = "trialing";
        else if (sub.status === "past_due") status = "past_due";
        if (userId) {
          await db.from("subscriptions").upsert({
            user_id: userId,
            stripe_subscription_id: sub.id,
            status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          });
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
