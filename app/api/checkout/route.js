import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe, PLANS } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { GENERATION_LIMITS } from "../../../lib/generationLimits";

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

  const db = supabaseAdmin();

  // Réutilise le client Stripe existant s'il y en a déjà un pour cette
  // personne (ex. essai précédent, tentative annulée) — sans ça, Stripe
  // crée un NOUVEAU client à chaque session de paiement lancée avec
  // seulement customer_email, ce qui peut mener à des abonnements en
  // double pour la même personne.
  const { data: existingSub } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = existingSub?.stripe_customer_id || null;

  if (customerId) {
    // Vérifie que ce client existe toujours bien côté Stripe (au cas où
    // il aurait été supprimé manuellement) avant de le réutiliser.
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      if (existingCustomer?.deleted) customerId = null;
    } catch (e) {
      customerId = null;
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  // Pré-initialise la ligne subscriptions avec le plafond d'essai (5),
  // pour qu'un quota existe déjà dès la création de la session Stripe —
  // avant même que le webhook checkout.session.completed ne se déclenche.
  const now = new Date();
  const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.from("subscriptions").upsert({
    user_id: userId,
    plan,
    status: "trialing",
    stripe_customer_id: customerId,
    generation_limit: GENERATION_LIMITS.trial,
    generations_used: 0,
    period_start: now.toISOString(),
    period_end: trialEndDate.toISOString(),
    updated_at: now.toISOString(),
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      // Permet à l'utilisatrice d'entrer un code promo (ex. RENTREE50)
      // directement sur la page de paiement Stripe.
      allow_promotion_codes: true,
      // Exige une carte bancaire dès l'inscription à l'essai gratuit,
      // pour décourager la création de comptes multiples juste pour
      // profiter de l'essai à répétition.
      payment_method_collection: "always",
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
        metadata: { userId, plan },
        trial_period_days: 7,
      },
      success_url: `${siteUrl}/?abonnement=succes`,
      cancel_url: `${siteUrl}/subscribe?abonnement=annule`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: e.message || "Erreur Stripe." }, { status: 500 });
  }
}
