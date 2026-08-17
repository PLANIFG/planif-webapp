import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe, PLANS } from "../../../lib/stripe";

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
      subscription_data: { metadata: { userId, plan } },
      success_url: `${siteUrl}/?abonnement=succes`,
      cancel_url: `${siteUrl}/subscribe?abonnement=annule`,
    });

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: e.message || "Erreur Stripe." }, { status: 500 });
  }
}
