"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PlanifApp from "../components/PlanifApp";
import MarketingHome from "../components/MarketingHome";

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [subActive, setSubActive] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) {
        // Personne non connectée : on montre la page d'accueil publique
        // (description, fonctionnalités, tarifs) plutôt que de rediriger
        // tout de suite vers /login — les infos utiles doivent être
        // visibles avant la connexion.
        setChecking(false);
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      // "trialing" doit être autorisé — sinon toute personne en plein essai
      // gratuit de 7 jours (le statut normal juste après un paiement) se
      // faisait renvoyer vers la page d'abonnement au lieu d'entrer dans l'app.
      if (sub?.status === "active" || sub?.status === "past_due" || sub?.status === "trialing") {
        setSubActive(true);
      } else {
        window.location.href = "/subscribe";
        return;
      }
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF8F2" }}>
        <p className="text-sm text-[#7A7362]">Chargement…</p>
      </div>
    );
  }

  // Personne non connectée : page d'accueil publique (marketing).
  if (!session) return <MarketingHome />;

  // Connectée et abonnée : l'app complète.
  if (subActive) return <PlanifApp />;

  return null; // redirection vers /subscribe en cours
}
