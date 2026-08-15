import { stripe, PLANS } from "../../../lib/stripe";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { plan, userId, email } = body || {};
  if (!PLANS[plan]) {
    return Response.json({ error: "Plan invalide." }, { status: 400 });
  }
  if (!userId || !email) {
    return Response.json({ error: "Utilisateur requis." }, { status: 400 });
  }

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
