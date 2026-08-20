"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function FeedbackPage() {
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [tachesEssayees, setTachesEssayees] = useState("");
  const [ceQuiAFonctionne, setCeQuiAFonctionne] = useState("");
  const [bugs, setBugs] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [note, setNote] = useState(0);
  const [achterait, setAchterait] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: err } = await supabase.from("feedback").insert({
        nom: nom || null,
        courriel: courriel || null,
        taches_essayees: tachesEssayees || null,
        ce_qui_a_bien_fonctionne: ceQuiAFonctionne || null,
        bugs_rencontres: bugs || null,
        suggestions: suggestions || null,
        note_globale: note || null,
        achterait_abonnement: achterait || null,
      });
      if (err) throw err;
      setSubmitted(true);
    } catch (err) {
      setError("Une erreur est survenue. Réessaie, ou écris-moi directement à Planif.net@gmail.com.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Merci beaucoup ! 🙏</h1>
          <p style={{ color: "#7A7362", fontSize: 15, lineHeight: 1.7 }}>
            Ton commentaire a bien été enregistré. Il m'aide énormément à améliorer PLANIF.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Ton avis sur PLANIF</h1>
        <p style={{ color: "#7A7362", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
          Merci de tester l'application ! Prends quelques minutes pour me dire ce qui a bien
          fonctionné, ce qui a moins bien été, et tes idées d'amélioration. Tout commentaire,
          même bref, m'aide beaucoup.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Ton nom (optionnel)</label>
            <input style={inputStyle} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Marie" />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Ton courriel (optionnel — si tu veux que je te réponde)</label>
            <input style={inputStyle} type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="nom@exemple.com" />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Qu'as-tu essayé dans l'application ?</label>
            <textarea style={textareaStyle} rows={2} value={tachesEssayees} onChange={(e) => setTachesEssayees(e.target.value)} placeholder="Ex. générer une semaine complète, imprimer une fiche, m'abonner..." />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Qu'est-ce qui a bien fonctionné ?</label>
            <textarea style={textareaStyle} rows={3} value={ceQuiAFonctionne} onChange={(e) => setCeQuiAFonctionne(e.target.value)} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>As-tu rencontré des bugs ou des problèmes ?</label>
            <textarea style={textareaStyle} rows={3} value={bugs} onChange={(e) => setBugs(e.target.value)} placeholder="Décris ce qui s'est passé, et sur quel appareil (téléphone/ordinateur) si possible." />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Suggestions ou idées d'amélioration ?</label>
            <textarea style={textareaStyle} rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Note globale sur 5</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNote(n)}
                  style={{
                    width: 42, height: 42, borderRadius: 8, border: "1.5px solid #E4DDCC",
                    background: note >= n ? "#3C6E52" : "white",
                    color: note >= n ? "white" : "#3C6E52",
                    fontWeight: 700, fontSize: 16, cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Achèterais-tu un abonnement à PLANIF ?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Oui", "Peut-être", "Non"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAchterait(opt)}
                  style={{
                    padding: "8px 16px", borderRadius: 999, border: "1.5px solid #E4DDCC",
                    background: achterait === opt ? "#3C6E52" : "white",
                    color: achterait === opt ? "white" : "#3C6E52",
                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: "#C4523A", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={submitStyle}>
            {submitting ? "Envoi en cours…" : "Envoyer mon commentaire"}
          </button>
        </form>
      </div>
    </div>
  );
}

const wrapStyle = { minHeight: "100vh", background: "#FBF8F2", padding: "40px 20px" };
const cardStyle = { maxWidth: 560, margin: "0 auto", background: "white", borderRadius: 4, padding: "36px 28px", borderTop: "3px solid #10192B", boxShadow: "0 20px 50px -22px rgba(36,56,74,0.25)" };
const titleStyle = { fontFamily: "Baloo 2, sans-serif", color: "#3C6E52", fontSize: 26, marginBottom: 8 };
const fieldStyle = { marginBottom: 20 };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#3C6E52", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1.5px solid #E4DDCC", fontSize: 14, fontFamily: "Nunito, sans-serif" };
const textareaStyle = { ...inputStyle, resize: "vertical" };
const submitStyle = { width: "100%", padding: 14, borderRadius: 6, border: "none", background: "#10192B", color: "#FBF8F2", fontWeight: 600, fontSize: 15, cursor: "pointer" };
