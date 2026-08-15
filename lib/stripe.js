import Stripe from "stripe";

// Utilisé uniquement dans les routes /app/api — jamais envoyé au navigateur.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Prix ajustables sans toucher au code : changez ces variables dans
// Netlify (Environment variables), puis redéployez. Montants en cents.
export const PLANS = {
  monthly: {
    amountCents: parseInt(process.env.STRIPE_MONTHLY_PRICE_CENTS || "999", 10),
    interval: "month",
    label: "Mensuel",
  },
  annual: {
    amountCents: parseInt(process.env.STRIPE_ANNUAL_PRICE_CENTS || "8900", 10),
    interval: "year",
    label: "Annuel",
  },
};
