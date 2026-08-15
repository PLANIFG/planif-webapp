"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PlanifApp from "../components/PlanifApp";

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [subActive, setSubActive] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      if (sub?.status === "active" || sub?.status === "past_due") {
        setSubActive(true);
      } else {
        window.location.href = "/subscribe";
        return;
      }
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) window.location.href = "/login";
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

  if (!session || !subActive) return null; // redirection en cours

  return <PlanifApp />;
}
