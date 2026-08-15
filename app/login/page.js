"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Compte créé ! Vérifiez votre courriel pour confirmer, puis connectez-vous.");
      }
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FBF8F2" }}>
      <div className="w-full max-w-sm bg-white border border-[#E3DACB] rounded-2xl p-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: "#2A4E3B" }}>
          {mode === "login" ? "Connexion à PLANIF" : "Créer un compte PLANIF"}
        </h1>
        <p className="text-sm text-[#7A7362] mb-4">
          {mode === "login" ? "Votre outil de planification d'activités éducatives." : "Vos données seront sauvegardées pour vous seule."}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Courriel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#DCD3C2] rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[#DCD3C2] rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-[#3C6E52]">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: "#3C6E52" }}
          >
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}
          className="w-full text-center text-sm text-[#3C6E52] mt-4 underline"
        >
          {mode === "login" ? "Pas encore de compte ? Créez-en un" : "Déjà un compte ? Connectez-vous"}
        </button>
      </div>
    </div>
  );
}
