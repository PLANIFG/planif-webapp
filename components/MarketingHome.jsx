"use client";
import { useState } from "react";

export default function MarketingHome() {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .planif-accueil{
          --papier: #FBF8F2;
          --carte: #FFFFFF;
          --encre: #7C9070;
          --encre-claire: #A3B399;
          --dore: #54634A;
          --dore-fonce: #3A4633;
          font-family: 'Nunito', sans-serif;
          color: var(--dore-fonce);
          background: var(--papier);
          line-height: 1.5;
        }
        .planif-accueil *{ box-sizing: border-box; }
        .planif-accueil h1, .planif-accueil h2, .planif-accueil h3{ font-family:'Baloo 2', sans-serif; }
        .planif-accueil a{ color: inherit; }
        .planif-accueil .conteneur{ max-width: 1120px; margin: 0 auto; padding: 0 28px; }

        .planif-accueil header{
          position: sticky; top:0; z-index: 50;
          background: rgba(251,248,242,0.94);
          backdrop-filter: blur(6px);
          border-bottom: 1px solid rgba(84,99,74,0.1);
        }
        .planif-accueil .barre-nav{
          display:flex; align-items:center; justify-content:space-between;
          padding: 14px 0;
        }
        .planif-accueil .marque{ display:flex; align-items:center; gap:10px; text-decoration:none; }
        .planif-accueil .marque img{ height: 32px; width:auto; display:block; }
        .planif-accueil .nav-liens{ display:flex; align-items:center; gap: 28px; }
        .planif-accueil .nav-liens a{ font-size:14.5px; font-weight:700; text-decoration:none; color: var(--encre); }
        .planif-accueil .nav-liens a:hover{ color: var(--dore-fonce); }
        .planif-accueil .btn-nav-connexion{
          padding: 9px 18px; border-radius: 8px; background: var(--dore); color: var(--papier) !important;
          font-weight:700; font-size:14px; text-decoration:none; white-space:nowrap;
        }
        .planif-accueil .btn-nav-connexion:hover{ background: var(--dore-fonce); }
        .planif-accueil .burger{
          display:none; background:none; border:none; font-size:26px; color:var(--dore-fonce); cursor:pointer;
          padding: 4px 8px;
        }
        .planif-accueil .menu-mobile{
          display:none; flex-direction:column; gap: 2px; padding: 6px 0 16px;
          border-top: 1px solid rgba(84,99,74,0.1);
        }
        .planif-accueil .menu-mobile.ouvert{ display:flex; }
        .planif-accueil .menu-mobile a{
          padding: 12px 4px; font-size:15px; font-weight:700; color: var(--encre); text-decoration:none;
          border-bottom: 1px solid rgba(84,99,74,0.08);
        }
        .planif-accueil .menu-mobile .btn-nav-connexion{ text-align:center; margin-top: 10px; }

        .planif-accueil .hero{ padding: 72px 0 60px; text-align:center; }
        .planif-accueil .eyebrow{
          display:inline-block; font-size:12.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase;
          color: var(--papier); background: var(--encre); border:1px solid var(--encre);
          padding: 6px 14px; border-radius: 100px; margin-bottom: 22px;
        }
        .planif-accueil .hero h1{
          font-weight:700; font-size: clamp(28px, 4.4vw, 46px); line-height:1.18; color: var(--dore-fonce);
          max-width: 760px; margin: 0 auto 20px;
        }
        .planif-accueil .hero p.lead{
          font-size: 17px; color: #6b7d72; max-width: 560px; margin: 0 auto 34px;
        }
        .planif-accueil .cta-groupe{ display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom: 18px; }
        .planif-accueil .btn-primaire{
          padding: 15px 30px; border-radius: 8px; background: var(--dore); color: var(--papier);
          font-weight:800; font-size:15.5px; text-decoration:none; box-shadow: 0 14px 30px -14px rgba(58,70,51,0.5);
          border:none; cursor:pointer; display:inline-block;
        }
        .planif-accueil .btn-primaire:hover{ background: var(--dore-fonce); }
        .planif-accueil .btn-secondaire{
          padding: 15px 30px; border-radius: 8px; background: transparent; color: var(--dore-fonce);
          font-weight:700; font-size:15.5px; text-decoration:none; border: 1.5px solid rgba(84,99,74,0.3);
        }
        .planif-accueil .btn-secondaire:hover{ border-color: var(--dore); }
        .planif-accueil .note-essai{ font-size:13px; color: #8a8574; }

        .planif-accueil .apercu-visuel{
          margin: 50px auto 0; max-width: 780px; border-radius: 16px; overflow:hidden;
          box-shadow: 0 40px 70px -34px rgba(58,70,51,0.3); border: 1px solid rgba(84,99,74,0.12);
        }
        .planif-accueil .apercu-visuel .barre-fenetre{
          background: var(--encre); padding: 10px 16px; display:flex; gap:6px;
        }
        .planif-accueil .apercu-visuel .barre-fenetre span{ width:10px; height:10px; border-radius:50%; background: rgba(251,248,242,0.35); }
        .planif-accueil .apercu-visuel .corps{
          background: var(--carte); max-height: 520px; overflow: hidden; position: relative;
        }
        .planif-accueil .apercu-visuel .corps img{ width: 100%; display:block; object-fit: cover; object-position: top; }
        .planif-accueil .apercu-visuel .corps::after{
          content:""; position:absolute; left:0; right:0; bottom:0; height: 90px;
          background: linear-gradient(to bottom, rgba(255,255,255,0), var(--carte));
        }

        .planif-accueil section{ padding: 60px 0; }
        .planif-accueil .titre-section{ text-align:center; max-width: 560px; margin: 0 auto 42px; }
        .planif-accueil .titre-section h2{ font-size: clamp(23px,3vw,30px); font-weight:700; color: var(--dore-fonce); margin-bottom:12px; }
        .planif-accueil .titre-section p{ color: #6b7d72; font-size:15.5px; }

        .planif-accueil .grille-fonctions{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .planif-accueil .carte-fonction{
          background: var(--carte); border-radius: 14px; padding: 20px 20px 24px; border: 1px solid rgba(84,99,74,0.1);
        }
        .planif-accueil .carte-fonction .icone-img{
          width:100%; height:150px; border-radius:10px; overflow:hidden; margin-bottom:16px;
          border: 1px solid rgba(84,99,74,0.12); background: var(--papier);
        }
        .planif-accueil .carte-fonction .icone-img img{ width:100%; height:100%; object-fit:cover; object-position: top; display:block; }
        .planif-accueil .carte-fonction h3{ font-size:16px; font-weight:700; margin-bottom:8px; color: var(--dore-fonce); }
        .planif-accueil .carte-fonction p{ font-size:14px; color: #6b7d72; line-height:1.55; }

        .planif-accueil .bandeau-mission{
          background: var(--encre); color: var(--papier); border-radius: 20px; padding: 44px 38px;
          text-align:center;
        }
        .planif-accueil .bandeau-mission h2{ font-size: clamp(19px,2.6vw,26px); margin-bottom:14px; color: var(--papier); }
        .planif-accueil .bandeau-mission p{ color: rgba(251,248,242,0.9); max-width:600px; margin: 0 auto; font-size:15px; }
        .planif-accueil .bandeau-mission .signature{ margin-top:18px; font-weight:800; color: #F2D48A; font-size:14.5px; }

        .planif-accueil .grille-tarifs{ display:grid; grid-template-columns: 1fr 1fr; gap: 22px; max-width: 780px; margin: 0 auto; }
        .planif-accueil .carte-tarif{
          background: var(--carte); border-radius: 16px; padding: 30px 26px; border: 1.5px solid rgba(84,99,74,0.12);
          position:relative;
        }
        .planif-accueil .carte-tarif.recommande{ border-color: var(--dore); box-shadow: 0 20px 44px -24px rgba(58,70,51,0.35); }
        .planif-accueil .badge-populaire{
          position:absolute; top:-13px; right: 24px; background: var(--dore); color: var(--papier);
          font-size:11.5px; font-weight:800; padding: 5px 12px; border-radius:100px; letter-spacing:0.03em;
        }
        .planif-accueil .carte-tarif .nom-forfait{ font-size:13.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color: var(--encre); margin-bottom:10px; }
        .planif-accueil .carte-tarif .prix{ font-family:'Baloo 2',sans-serif; font-weight:700; font-size:36px; color: var(--dore-fonce); margin-bottom:2px; }
        .planif-accueil .carte-tarif .prix span{ font-family:'Nunito',sans-serif; font-size:14px; font-weight:600; color: #6b7d72; }
        .planif-accueil .carte-tarif .equiv{ font-size:13px; color: #6b7d72; margin-bottom:22px; }
        .planif-accueil .liste-tarif{ list-style:none; display:flex; flex-direction:column; gap:11px; margin-bottom:26px; padding:0; }
        .planif-accueil .liste-tarif li{ font-size:14.5px; display:flex; gap:9px; align-items:flex-start; color: var(--dore-fonce); }
        .planif-accueil .liste-tarif li .coche{ color: var(--encre); font-weight:800; }
        .planif-accueil .carte-tarif .btn-primaire, .planif-accueil .carte-tarif .btn-secondaire{ display:block; width:100%; text-align:center; padding: 13px; }
        .planif-accueil .note-essai-tarif{ text-align:center; font-size: 13px; color: #8a8574; margin-top: 20px; max-width: 480px; margin-left:auto; margin-right:auto; }

        .planif-accueil footer{ background: var(--dore-fonce); color: rgba(251,248,242,0.75); padding: 38px 0 26px; margin-top: 36px; }
        .planif-accueil .footer-haut{ display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(251,248,242,0.14); margin-bottom: 18px; }
        .planif-accueil .footer-liens{ display:flex; gap: 26px; flex-wrap:wrap; }
        .planif-accueil .footer-liens a{ font-size:13.5px; text-decoration:none; color: rgba(251,248,242,0.75); }
        .planif-accueil .footer-liens a:hover{ color: #F2D48A; }
        .planif-accueil .footer-bas{ font-size:12.5px; color: rgba(251,248,242,0.5); text-align:center; }

        @media (max-width: 900px){
          .planif-accueil .grille-fonctions{ grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px){
          .planif-accueil .nav-liens{ display:none; }
          .planif-accueil .burger{ display:block; }
          .planif-accueil .hero{ padding: 48px 0 40px; }
          .planif-accueil .grille-fonctions{ grid-template-columns: 1fr; }
          .planif-accueil .grille-tarifs{ grid-template-columns: 1fr; }
          .planif-accueil .bandeau-mission{ padding: 32px 22px; border-radius:14px; }
          .planif-accueil .footer-haut{ flex-direction:column; }
        }
      `}</style>

      <div className="planif-accueil">
        <header>
          <div className="conteneur barre-nav">
            <a href="/" className="marque">
              <img src="/planif-logo-vert-sauge.png" alt="PLANIF" />
            </a>
            <nav className="nav-liens">
              <a href="#fonctionnalites">Fonctionnalités</a>
              <a href="#tarifs">Tarifs</a>
              <a href="#apropos">À propos</a>
              <a href="/login" className="btn-nav-connexion">Connexion</a>
            </nav>
            <button
              className="burger"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOuvert((v) => !v)}
            >
              {menuOuvert ? "✕" : "☰"}
            </button>
          </div>
          <div className={`conteneur menu-mobile ${menuOuvert ? "ouvert" : ""}`}>
            <a href="#fonctionnalites" onClick={() => setMenuOuvert(false)}>Fonctionnalités</a>
            <a href="#tarifs" onClick={() => setMenuOuvert(false)}>Tarifs</a>
            <a href="#apropos" onClick={() => setMenuOuvert(false)}>À propos</a>
            <a href="/login" className="btn-nav-connexion">Connexion</a>
          </div>
        </header>

        <section className="hero">
          <div className="conteneur">
            <div className="eyebrow">Pour les éducatrices en service de garde scolaire</div>
            <h1>Vos activités, votre matériel et vos horaires, générés en quelques clics</h1>
            <p className="lead">
              Planification hebdomadaire, journées pédagogiques, après-midis de concertation et
              mercredis maternelle — un seul outil pour tout planifier.
            </p>
            <div className="cta-groupe">
              <a href="/subscribe" className="btn-primaire">Essayer PLANIF</a>
              <a href="#tarifs" className="btn-secondaire">Voir les tarifs</a>
            </div>
            <div className="note-essai">Essai gratuit de 7 jours — carte requise, aucun débit avant la fin de l'essai</div>

            <div className="apercu-visuel">
              <div className="barre-fenetre"><span></span><span></span><span></span></div>
              <div className="corps">
                <img src="/accueil/hero.jpg" alt="Aperçu d'une planification hebdomadaire générée dans PLANIF" />
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnalites">
          <div className="conteneur">
            <div className="titre-section">
              <h2>Tout ce qu'il faut, en un seul outil</h2>
              <p>Quatre modes de planification, pensés pour le quotidien du service de garde.</p>
            </div>
            <div className="grille-fonctions">
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/modes.jpg" alt="4 modes de planification dans PLANIF" /></div>
                <h3>4 modes de planification</h3>
                <p>Journée pédagogique, après-midi de concertation, mercredi maternelle et grille hebdomadaire — chacun adapté à sa réalité.</p>
              </div>
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/materiel.jpg" alt="Matériel généré automatiquement dans PLANIF" /></div>
                <h3>Matériel généré automatiquement</h3>
                <p>Bingo, cartes illustrées, quiz, collations et fiches — le matériel qui prenait des heures est prêt en un clic.</p>
              </div>
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/rotation.jpg" alt="Horaire de rotation généré dans PLANIF" /></div>
                <h3>Horaires de rotation</h3>
                <p>Les groupes et les plateaux tournent automatiquement, avec un horaire clair et imprimable pour l'équipe.</p>
              </div>
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/impression.jpg" alt="Aperçu imprimable généré par PLANIF" /></div>
                <h3>Prêt à imprimer</h3>
                <p>Fiches complètes, non remplissables à la main : le contenu est déjà là, prêt à distribuer.</p>
              </div>
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/age.jpg" alt="Groupes d'âge dans PLANIF" /></div>
                <h3>Adapté par groupe d'âge</h3>
                <p>Les activités s'ajustent selon les groupes sélectionnés, même en contexte multi-âge.</p>
              </div>
              <div className="carte-fonction">
                <div className="icone-img"><img src="/accueil/biblio.jpg" alt="Bibliothèque de planifications dans PLANIF" /></div>
                <h3>Bibliothèque personnelle</h3>
                <p>Retrouvez, rouvrez et modifiez vos planifications précédentes en un instant.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="apropos">
          <div className="conteneur">
            <div className="bandeau-mission">
              <h2>Née du manque de temps sur le terrain</h2>
              <p>PLANIF est conçu par et pour des éducatrices en milieu scolaire, pour réduire le temps consacré à préparer activités, matériel et horaires — souvent sur le temps personnel.</p>
              <div className="signature">Moins de temps à préparer, plus de temps pour les enfants.</div>
            </div>
          </div>
        </section>

        <section id="tarifs">
          <div className="conteneur">
            <div className="titre-section">
              <h2>Un tarif simple, sans surprise</h2>
              <p>Choisissez mensuel ou annuel — annulez en tout temps.</p>
            </div>
            <div className="grille-tarifs">
              <div className="carte-tarif">
                <div className="nom-forfait">Mensuel</div>
                <div className="prix">15$ <span>/ mois</span></div>
                <div className="equiv">Facturé chaque mois</div>
                <ul className="liste-tarif">
                  <li><span className="coche">✓</span> 20 générations par mois</li>
                  <li><span className="coche">✓</span> Les 4 modes de planification</li>
                  <li><span className="coche">✓</span> Matériel généré automatiquement</li>
                  <li><span className="coche">✓</span> Bibliothèque de planifications</li>
                  <li><span className="coche">✓</span> Annulable en tout temps</li>
                </ul>
                <a href="/subscribe" className="btn-secondaire">Choisir Mensuel</a>
              </div>
              <div className="carte-tarif recommande">
                <div className="badge-populaire">Économique</div>
                <div className="nom-forfait">Annuel</div>
                <div className="prix">150$ <span>/ année</span></div>
                <div className="equiv">Soit 12,50$/mois — meilleure valeur</div>
                <ul className="liste-tarif">
                  <li><span className="coche">✓</span> 200 générations par année</li>
                  <li><span className="coche">✓</span> Les 4 modes de planification</li>
                  <li><span className="coche">✓</span> Matériel généré automatiquement</li>
                  <li><span className="coche">✓</span> Bibliothèque de planifications</li>
                  <li><span className="coche">✓</span> Facturé une seule fois par année</li>
                </ul>
                <a href="/subscribe" className="btn-primaire">Choisir Annuel</a>
              </div>
            </div>
            <div className="note-essai-tarif">Essai gratuit de 7 jours (5 générations) pour essayer avant de vous engager. Une carte est requise pour démarrer l'essai, mais elle n'est débitée qu'à la fin des 7 jours si vous ne l'annulez pas.</div>
          </div>
        </section>

        <footer>
          <div className="conteneur">
            <div className="footer-haut">
              <a href="/" className="marque">
                <img src="/planif-logo-vert-sauge.png" alt="PLANIF" style={{ filter: "brightness(0) invert(1)" }} />
              </a>
              <div className="footer-liens">
                <a href="#apropos">À propos</a>
                <a href="/politique-confidentialite">Politique de confidentialité</a>
                <a href="/conditions-utilisation">Conditions d'utilisation</a>
                <a href="/login">Connexion</a>
              </div>
            </div>
            <div className="footer-bas">© 2026 PLANIF — Conçu par et pour des éducatrices en milieu scolaire.</div>
          </div>
        </footer>
      </div>
    </>
  );
}
