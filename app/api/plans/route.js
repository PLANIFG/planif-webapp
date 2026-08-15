import { PLANS } from "../../../lib/stripe";

// Route publique en lecture seule — sert seulement à afficher les prix
// actuels sur la page d'abonnement, sans exposer la clé secrète Stripe.
export async function GET() {
  return Response.json({
    monthly: PLANS.monthly.amountCents,
    annual: PLANS.annual.amountCents,
  });
}
