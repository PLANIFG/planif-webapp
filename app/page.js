"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PlanifApp from "../components/PlanifApp";
import MarketingHome from "../components/MarketingHome";

// Si un cookie de connexion Supabase existe, on masque la page d'accueil
// publique dès le chargement (avant même que le JavaScript démarre) et on
// affiche « Chargement… » : les personnes connectées ne voient donc pas la
// page d'accueil clignoter avant d'entrer dans l'app. Google et les
// visiteuses, eux, reçoivent directement la page d'accueil complète.
const SESSION_SCRIPT = `try{if(/(^|;\\s*)sb-[^=]*-auth-token/.test(document.cookie)){document.documentElement.classList.add('planif-session')}}catch(e){}`;
const SESSION_CSS = `.pl-boot{display:none}.planif-session .pl-boot{display:flex}.planif-session .pl-accueil{display:none}`;

export default function Home() {
  const [subActive, setSubActive] = useState(false);

  useEffect(() => {
    const showHome = () => document.documentElement.classList.remove("planif-session");

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data?.session) {
        // Personne non connectée : page d'accueil publique.
        showHome();
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      // "trialing" doit être autorisé — sinon toute personne en plein essai
      // gratuit de 7 jours se ferait renvoyer vers la page d'abonnement.
      if (sub?.status === "active" || sub?.status === "past_due" || sub?.status === "trialing") {
        setSubActive(true);
      } else {
        window.location.href = "/subscribe";
      }
    }).catch(showHome); // session illisible ou expirée : page d'accueil

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSubActive(false);
        showHome();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Connectée et abonnée : l'app complète.
  if (subActive) return <PlanifApp />;

  // Tout le monde d'autre (et Google) : la page d'accueil publique,
  // présente dès le HTML initial pour être bien lue par les moteurs de recherche.
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SESSION_SCRIPT }} />
      <style dangerouslySetInnerHTML={{ __html: SESSION_CSS }} />
      <div className="pl-boot min-h-screen items-center justify-center" style={{ background: "#FBF8F2" }}>
        <p className="text-sm text-[#7A7362]">Chargement…</p>
      </div>
      <div className="pl-accueil">
        <MarketingHome />
      </div>
    </>
  );
}
