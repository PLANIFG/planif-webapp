"use client";
import { useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const feuilles = useMemo(() => {
    const couleurs = [
      { fond: "#D8935B", nervure: "#B5763C" },
      { fond: "#C4713B", nervure: "#8F5426" },
      { fond: "#E6B85C", nervure: "#B5883A" },
      { fond: "#A3644A", nervure: "#7A4732" },
    ];
    const n = 9;
    return Array.from({ length: n }).map((_, i) => {
      const c = couleurs[Math.floor(Math.random() * couleurs.length)];
      return {
        id: i,
        fond: c.fond,
        nervure: c.nervure,
        taille: 14 + Math.round(Math.random() * 8),
        gauche: Math.round((i / n) * 100 + Math.random() * 8),
        duree: (6 + Math.random() * 4).toFixed(1),
        delai: (Math.random() * 6).toFixed(1),
        balanceDuree: (2 + Math.random() * 1.5).toFixed(1),
      };
    });
  }, []);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage("Un lien de réinitialisation a été envoyé à votre courriel.");
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

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
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .planif-login-root{
          --papier: #FBF8F2;
          --carte: #FFFFFF;
          --encre: #7C9070;
          --encre-claire: #A3B399;
          --dore: #54634A;
          --dore-fonce: #3A4633;
          font-family: 'Nunito', sans-serif;
          color: var(--encre);
          display:flex;
          flex-direction: column;
          min-height:100vh;
          position: relative;
        }
        .planif-login-root *{ box-sizing: border-box; }
        .panneau-marque{
          background: var(--encre);
          background-image:
            linear-gradient(var(--encre), var(--encre)),
            repeating-linear-gradient(180deg, transparent 0px, transparent 43px, rgba(246,241,231,0.06) 44px);
          color: var(--papier);
          display:flex;
          flex-direction:column;
          align-items: center;
          text-align: center;
          padding: 40px 28px 44px;
          position: relative;
          overflow: hidden;
        }
        .feuilles-automne{
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .feuille{
          position: absolute;
          top: -24px;
          animation: tomber linear infinite, balancer ease-in-out infinite;
        }
        @keyframes tomber{
          0% { transform: translateY(-24px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.85; }
          100% { transform: translateY(260px) rotate(360deg); opacity: 0; }
        }
        @keyframes balancer{
          0%, 100% { margin-left: 0; }
          50% { margin-left: 18px; }
        }
        .contenu-marque{
          max-width: 460px;
          position: relative;
        }
        .contenu-marque h1{
          font-family:'Baloo 2', sans-serif;
          font-weight:700;
          font-size: clamp(26px, 5vw, 34px);
          line-height: 1.2;
        }
        .beneficies{
          display:inline-flex;
          flex-direction:column;
          gap: 14px;
          margin-top: 28px;
          text-align: left;
        }
        .beneficies .item{
          font-size: 14px;
          line-height: 1.45;
          color: rgba(246,241,231,0.92);
          max-width: 340px;
        }
        .panneau-form{
          flex: 1;
          background: var(--papier);
          display:flex;
          align-items:flex-start;
          justify-content:center;
          padding: 32px 20px 130px;
        }
        .carte{
          width: 100%;
          max-width: 380px;
          background: var(--carte);
          border-radius: 4px;
          padding: 40px 32px;
          box-shadow: 0 20px 50px -22px rgba(36,56,74,0.25);
          border: 1px solid rgba(36,56,74,0.08);
          border-top: 3px solid var(--dore);
          margin-top: -28px;
        }
        .titre-connexion{
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .titre-connexion h2{
          font-family:'Baloo 2', sans-serif;
          font-weight:500;
          font-size: 26px;
          color: var(--encre);
        }
        .titre-connexion .logo-titre{
          height: 30px;
          width: auto;
        }
        .carte .sous-titre{
          font-size: 14px;
          color: #7A7166;
          margin-bottom: 28px;
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
        .ligne-oubli button:disabled{ opacity: 0.5; cursor: default; }
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
        .logo-bas-wrap{
          position: fixed;
          left: 8px;
          bottom: calc(45px + env(safe-area-inset-bottom));
          width: 60px;
          height: 130px;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          overflow: visible;
          z-index: 2147483647;
          pointer-events: none;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
        }
        .logo-bas-wrap img{
          height: 34px;
          width: 111px;
          object-fit: contain;
          display:block;
          transform: rotate(90deg);
          transform-origin: center center;
        }
      `}</style>

      <div className="planif-login-root">
        <div className="panneau-marque">
          <div className="feuilles-automne" aria-hidden="true">
            {feuilles.map((f) => (
              <svg
                key={f.id}
                className="feuille"
                width={f.taille}
                height={f.taille}
                viewBox="0 0 16 16"
                style={{
                  left: `${f.gauche}%`,
                  animationDuration: `${f.duree}s, ${f.balanceDuree}s`,
                  animationDelay: `${f.delai}s, ${f.delai}s`,
                }}
              >
                <path d="M8 1c3 2 6 5 6 8a6 6 0 0 1-12 0c0-3 3-6 6-8z" fill={f.fond} />
                <path
                  d="M8 2.5v10.5M8 6l-3 1.5M8 6l3 1.5M8 9l-2.5 1.5M8 9l2.5 1.5"
                  stroke={f.nervure}
                  strokeWidth="0.6"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.6"
                />
              </svg>
            ))}
          </div>

          <div className="contenu-marque">
            <h1>Planificateur d&apos;activités</h1>

            <div className="beneficies">
              <div className="item">Conception d&apos;activités complètes</div>
              <div className="item">Horaire et liste de matériel créés en quelques clics</div>
              <div className="item">Contenu pédagogique prêt à imprimer</div>
              <div className="item">Un outil simple et efficace pour rentabiliser votre temps</div>
            </div>
          </div>
        </div>

        <div className="panneau-form">
          <div className="carte">
            <div className="titre-connexion">
              <h2>Connexion à</h2>
              <img src="/planif-logo-vert-sauge.png" alt="PLANIF" className="logo-titre" />
            </div>
            <div className="sous-titre">
              {mode === "login"
                ? "Votre allié pour des journées éducatives bien pensées."
                : "Vos données seront sauvegardées pour vous seule."}
            </div>

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
                  <button type="button" onClick={handleForgotPassword} disabled={loading || !email}>
                    Mot de passe oublié ?
                  </button>
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

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#B3A990" }}>
              <a href="/a-propos" style={{ color: "#B3A990", textDecoration: "underline", margin: "0 6px" }}>À propos</a>
              ·
              <a href="/politique-confidentialite" style={{ color: "#B3A990", textDecoration: "underline", margin: "0 6px" }}>Politique de confidentialité</a>
              ·
              <a href="/conditions-utilisation" style={{ color: "#B3A990", textDecoration: "underline", margin: "0 6px" }}>Conditions d'utilisation</a>
            </div>
          </div>
        </div>

        <div className="logo-bas-wrap">
          <img src="/planif-logo-vert-sauge.png" alt="PLANIF" />
        </div>
      </div>
    </>
  );
}
