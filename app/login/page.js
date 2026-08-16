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
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .planif-login-root{
          --papier: #FBF8F2;
          --carte: #FFFFFF;
          --encre: #3C6E52;
          --encre-claire: #6B9179;
          --dore: #10192B;
          --dore-fonce: #060B15;
          --jaune: #E3A63E;
          font-family: 'Nunito', sans-serif;
          color: var(--encre);
          display:flex;
          min-height:100vh;
        }
        .planif-login-root *{ box-sizing: border-box; }
        .panneau-marque{
          flex: 1 1 46%;
          background: var(--encre);
          background-image:
            linear-gradient(var(--encre), var(--encre)),
            repeating-linear-gradient(180deg, transparent 0px, transparent 43px, rgba(246,241,231,0.06) 44px);
          color: var(--papier);
          display:flex;
          flex-direction:column;
          justify-content: space-between;
          padding: 48px;
          position: relative;
        }
        .contenu-marque{
          max-width: 420px;
          margin-top: 40px;
        }
        .contenu-marque h1{
          font-family:'Baloo 2', sans-serif;
          font-weight:700;
          font-size: clamp(28px, 3.4vw, 38px);
          line-height: 1.22;
          margin-bottom: 18px;
        }
        .contenu-marque p{
          font-size: 15px;
          line-height: 1.6;
          color: rgba(246,241,231,0.75);
          max-width: 340px;
        }
        .beneficies{
          display:flex;
          flex-direction:column;
          gap: 14px;
          margin-top: 32px;
        }
        .beneficies .item{
          display:flex;
          align-items:center;
          gap: 12px;
          font-size: 14px;
          color: rgba(246,241,231,0.9);
        }
        .beneficies .puce{
          font-family:'Baloo 2', sans-serif;
          color: var(--jaune);
          font-weight:600;
        }
        .panneau-form{
          flex: 1 1 54%;
          background: var(--papier);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 40px;
        }
        .carte{
          width: 100%;
          max-width: 380px;
          background: var(--carte);
          border-radius: 4px;
          padding: 44px 38px;
          box-shadow: 0 20px 50px -22px rgba(36,56,74,0.25);
          border: 1px solid rgba(36,56,74,0.08);
          border-top: 3px solid var(--dore);
        }
        .carte h2{
          font-family:'Baloo 2', sans-serif;
          font-weight:500;
          font-size: 26px;
          color: var(--encre);
          margin-bottom: 6px;
          text-align: center;
        }
        .ligne-decor{
          height: 3px;
          width: 48px;
          background: linear-gradient(90deg, var(--jaune), var(--dore));
          border-radius: 100px;
          margin: 0 auto 28px;
        }
        .carte .sous-titre{
          font-size: 14px;
          color: #7A7166;
          margin-bottom: 18px;
          text-align: center;
        }
        .champ{
          margin-bottom: 18px;
        }
        .champ label{
          display:block;
          font-size: 12.5px;
          font-weight:600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--encre-claire);
          margin-bottom: 7px;
        }
        .champ input{
          width:100%;
          padding: 12px 14px;
          border-radius: 6px;
          border: 1.5px solid #E4DDCC;
          background: #FFFFFF;
          font-family:'Nunito', sans-serif;
          font-size: 14px;
          color: var(--encre);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .champ input:focus{
          border-color: var(--dore);
        }
        .ligne-oubli{
          display:flex;
          justify-content:flex-end;
          margin-bottom: 24px;
        }
        .ligne-oubli button{
          font-size: 12.5px;
          color: var(--encre-claire);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-family: 'Nunito', sans-serif;
        }
        .ligne-oubli button:hover{ text-decoration: underline; }
        .btn-connexion{
          width:100%;
          padding: 14px;
          border-radius: 6px;
          border:none;
          background: var(--dore);
          color: var(--papier);
          font-family:'Nunito', sans-serif;
          font-weight:600;
          font-size: 15px;
          cursor:pointer;
          transition: background 0.15s ease;
        }
        .btn-connexion:hover{ background: var(--dore-fonce); }
        .btn-connexion:disabled{ opacity: 0.6; cursor: default; }
        .creer-compte{
          text-align:center;
          margin-top: 22px;
          font-size: 13.5px;
          color: #7A7166;
        }
        .creer-compte button{
          color: var(--dore);
          font-weight: 600;
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13.5px;
          font-family: 'Nunito', sans-serif;
          padding: 0;
        }
        .creer-compte button:hover{ text-decoration: underline; }
        .msg-erreur{
          font-size: 13px;
          color: #C4523A;
          margin-bottom: 16px;
          text-align: center;
        }
        .msg-succes{
          font-size: 13px;
          color: var(--encre);
          margin-bottom: 16px;
          text-align: center;
        }
        @media (max-width: 820px){
          .planif-login-root{ flex-direction: column; }
          .panneau-marque{ padding: 32px 28px; background-image: linear-gradient(var(--encre), var(--encre)); }
          .contenu-marque p{ max-width: 100%; }
          .beneficies{ margin-top: 22px; }
          .panneau-form{ padding: 32px 20px 48px; }
        }
      `}</style>

      <div className="planif-login-root">
        <div className="panneau-marque">
          <div className="contenu-marque">
            <h1>Planificateur d&apos;activités</h1>
            <p>Simple, rapide et efficace.</p>

            <div className="beneficies">
              <div className="item"><span className="puce">—</span> Activités, matériel et horaires créés en quelques clics</div>
              <div className="item"><span className="puce">—</span> Contenu pédagogique prêt à utiliser</div>
              <div className="item"><span className="puce">—</span> Plus de temps pour les enfants, moins de temps de préparation</div>
            </div>
          </div>
        </div>

        <div className="panneau-form">
          <div className="carte">
            <h2>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
            <div className="sous-titre">
              {mode === "login"
                ? "Votre outil de planification d'activités éducatives."
                : "Vos données seront sauvegardées pour vous seule."}
            </div>
            <div className="ligne-decor" />

            <form onSubmit={handleSubmit}>
              <div className="champ">
                <label>Courriel</label>
                <input
                  type="email"
                  required
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="champ">
                <label>Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === "login" && (
                <div className="ligne-oubli">
                  <button type="button">Mot de passe oublié ?</button>
                </div>
              )}

              {error && <p className="msg-erreur">{error}</p>}
              {message && <p className="msg-succes">{message}</p>}

              <button type="submit" className="btn-connexion" disabled={loading}>
                {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
              </button>
            </form>

            <div className="creer-compte">
              {mode === "login" ? (
                <>Pas encore de compte ?{" "}
                  <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>
                    Créez-en un
                  </button>
                </>
              ) : (
                <>Déjà un compte ?{" "}
                  <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>
                    Connectez-vous
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
