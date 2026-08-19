import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe, PLANS } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { GENERATION_LIMITS } from "../../../lib/generationLimits";

const TRIAL_DAYS = 7;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { plan } = body || {};
  if (!PLANS[plan]) {
    return Response.json({ error: "Plan invalide." }, { status: 400 });
  }
  // On ne fait plus confiance au userId/email envoyés par le client —
  // on lit la vraie session connectée depuis les cookies, côté serveur.
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Vous devez être connectée pour vous abonner." }, { status: 401 });
  }
  const userId = user.id;
  const email = user.email;
  const { amountCents, interval, label } = PLANS[plan];
  const siteUrl = process.env.SITE_URL || request.headers.get("origin");

  const trialEnd = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: `PLANIF — Abonnement ${label}` },
            unit_amount: amountCents,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      metadata: { userId, plan },
      subscription_data: {
        trial_end: trialEnd,
        metadata: { userId, plan },
      },
      // Empêche de démarrer l'essai sans carte valide enregistrée —
      // sans ça, Stripe permettrait un essai "gratuit" sans moyen de paiement
      // et donc sans conséquence pour la personne qui annule avant la fin.
      payment_method_collection: "always",
      success_url: `${siteUrl}/?abonnement=succes`,
      cancel_url: `${siteUrl}/subscribe?abonnement=annule`,
    });

    // Pré-initialise la ligne côté Supabase avec le plafond d'essai (5).
    // Le webhook Stripe (customer.subscription.updated / invoice.payment_succeeded)
    // viendra ajuster le plafond au vrai plan (20 ou 200) une fois l'essai terminé
    // et le premier paiement confirmé.
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        status: "trialing",
        plan,
        generation_limit: GENERATION_LIMITS.trial,
        generations_used: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(trialEnd * 1000).toISOString(),
      },
      { onConflict: "user_id" }
    );

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: e.message || "Erreur Stripe." }, { status: 500 });
  }
}
