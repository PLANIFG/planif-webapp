"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Mot de passe mis à jour ! Vous pouvez maintenant vous connecter.");
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBF8F2", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ background: "white", borderRadius: 4, padding: "40px 32px", maxWidth: 380, width: "100%", borderTop: "3px solid #10192B", boxShadow: "0 20px 50px -22px rgba(36,56,74,0.25)" }}>
        <h2 style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 24, color: "#3C6E52", marginBottom: 20, textAlign: "center" }}>
          Nouveau mot de passe
        </h2>
        <input
          type="password"
          required
          minLength={6}
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 6, border: "1.5px solid #E4DDCC", marginBottom: 18, fontSize: 14 }}
        />
        {error && <p style={{ color: "#C4523A", fontSize: 13, marginBottom: 14 }}>{error}</p>}
        {message && <p style={{ color: "#3C6E52", fontSize: 13, marginBottom: 14 }}>{message}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 6, border: "none", background: "#10192B", color: "#FBF8F2", fontWeight: 600, fontSize: 15 }}>
          {loading ? "..." : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}
