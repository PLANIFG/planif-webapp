"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SubscribePage() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(null); // "monthly" | "annual" | null
  const [error, setError] = useState("");
  const [prices, setPrices] = useState(null);

  useEffect(() => {
    // On ne redirige plus automatiquement vers /login si la personne n'est
    // pas connectée — les tarifs doivent rester visibles publiquement, pour
    // que les gens puissent voir le prix avant de créer un compte.
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setCheckingAuth(false);
    });
    fetch("/api/plans").then((r) => r.json()).then(setPrices).catch(() => {});
  }, []);

  const formatPrice = (cents) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  const choose = async (plan) => {
    setError("");
    // Si la personne n'est pas connectée, on l'envoie se connecter/créer un
    // compte d'abord — elle revient ensuite ici pour choisir son plan.
    if (!user) {
      window.location.href = `/login?next=/subscribe`;
      return;
    }
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: user.id, email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur inconnue");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setLoading(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FBF8F2" }}>
      <div className="w-full max-w-md text-center">
        {/* Lien de sortie — toujours accessible, pour ne jamais coincer
            une personne qui a changé d'idée sur cette page. */}
        <div className="mb-4 text-right">
          {!checkingAuth && user ? (
            <button onClick={handleSignOut} className="text-sm text-[#7A7362] hover:underline">
              Se déconnecter
            </button>
          ) : (
            <a href="/" className="text-sm text-[#7A7362] hover:underline">
              ← Retour à l'accueil
            </a>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "#2A4E3B" }}>Choisissez votre abonnement</h1>
        <p className="text-sm text-[#7A7362] mb-6">
          Accès complet à PLANIF. Essai gratuit de 7 jours (5 générations) pour essayer avant de vous engager.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="grid gap-4">
          <button
            onClick={() => choose("monthly")}
            disabled={loading !== null}
            className="bg-white border border-[#E3DACB] rounded-2xl p-5 text-left hover:border-[#3C6E52] disabled:opacity-50"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-lg" style={{ color: "#2A4E3B" }}>Mensuel{prices ? ` — ${formatPrice(prices.monthly)}/mois` : ""}</span>
              <span className="text-sm text-[#7A7362]">{loading === "monthly" ? "..." : "Choisir →"}</span>
            </div>
            <p className="text-sm text-[#7A7362] mt-1">Facturé chaque mois, annulable en tout temps. 20 générations par mois.</p>
          </button>
          <button
            onClick={() => choose("annual")}
            disabled={loading !== null}
            className="bg-white border-2 rounded-2xl p-5 text-left disabled:opacity-50"
            style={{ borderColor: "#3C6E52" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-lg" style={{ color: "#2A4E3B" }}>Annuel{prices ? ` — ${formatPrice(prices.annual)}/an` : ""}</span>
              <span className="text-sm" style={{ color: "#3C6E52" }}>{loading === "annual" ? "..." : "Choisir →"}</span>
            </div>
            <p className="text-sm text-[#7A7362] mt-1">Facturé une fois par année — meilleure valeur. 200 générations par année.</p>
          </button>
        </div>

        {!checkingAuth && !user && (
          <p className="text-xs text-[#B3A990] mt-6">
            Vous devrez créer un compte ou vous connecter pour finaliser votre abonnement.
          </p>
        )}
      </div>
    </div>
  );
}
