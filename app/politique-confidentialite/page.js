export default function PolitiqueConfidentialite() {
  return (
    <div style={{ minHeight: "100vh", background: "#FBF8F2", padding: "48px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "white", borderRadius: 4, padding: "40px 32px", borderTop: "3px solid #10192B", boxShadow: "0 20px 50px -22px rgba(36,56,74,0.25)" }}>
        <h1 style={{ fontFamily: "Baloo 2, sans-serif", color: "#3C6E52", fontSize: 28, marginBottom: 8 }}>
          Politique de confidentialité
        </h1>
        <p style={{ color: "#7A7362", fontSize: 13, marginBottom: 32 }}>
          Dernière mise à jour : {new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <Section title="1. Qui sommes-nous">
          <p>
            PLANIF est un outil de planification d'activités éducatives, exploité actuellement
            par une personne physique (entreprise individuelle non enregistrée). Pour toute
            question concernant vos renseignements personnels, écrivez à{" "}
            <a href="mailto:Planif.net@gmail.com" style={{ color: "inherit" }}>Planif.net@gmail.com</a>.
          </p>
        </Section>

        <Section title="2. Renseignements que nous recueillons">
          <ul style={listStyle}>
            <li>Votre adresse courriel et mot de passe, pour créer et sécuriser votre compte</li>
            <li>Les lieux, groupes, thèmes et planifications que vous entrez ou générez dans l'application, afin de les sauvegarder pour vous</li>
            <li>Les renseignements de paiement (traités entièrement par Stripe — nous ne voyons ni ne stockons jamais votre numéro de carte)</li>
          </ul>
        </Section>

        <Section title="3. Comment nous utilisons ces renseignements">
          <p>Nous utilisons vos renseignements uniquement pour :</p>
          <ul style={listStyle}>
            <li>Vous donner accès à votre compte et à vos planifications sauvegardées</li>
            <li>Traiter votre abonnement et vos paiements</li>
            <li>Générer du contenu pédagogique à partir de vos demandes (voir section 4)</li>
            <li>Vous contacter au sujet de votre compte, si nécessaire</li>
          </ul>
          <p>Nous ne vendons ni ne louons vos renseignements personnels à qui que ce soit.</p>
        </Section>

        <Section title="4. Fournisseurs de services tiers">
          <p>Pour faire fonctionner PLANIF, certains renseignements transitent par ces fournisseurs :</p>
          <ul style={listStyle}>
            <li><strong>Supabase</strong> — hébergement de la base de données et authentification des comptes</li>
            <li><strong>Netlify</strong> — hébergement du site web</li>
            <li><strong>Stripe</strong> — traitement sécurisé des paiements et abonnements</li>
            <li><strong>Anthropic (Claude)</strong> — génère les idées d'activités et le contenu pédagogique à partir des informations que vous fournissez (thème, âge, lieux). Ces demandes sont envoyées à Anthropic pour traitement, selon leur propre politique de confidentialité.</li>
          </ul>
        </Section>

        <Section title="5. Conservation des renseignements">
          <p>
            Vos renseignements sont conservés tant que votre compte est actif. Vous pouvez
            demander la suppression complète de votre compte et de vos données en tout temps
            en nous écrivant à <a href="mailto:Planif.net@gmail.com" style={{ color: "inherit" }}>Planif.net@gmail.com</a>.
          </p>
        </Section>

        <Section title="6. Vos droits">
          <p>
            Conformément à la Loi sur la protection des renseignements personnels dans le
            secteur privé (Loi 25, Québec), vous avez le droit de consulter, corriger ou faire
            supprimer vos renseignements personnels, et de retirer votre consentement à leur
            utilisation en tout temps.
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Nous prenons des mesures raisonnables pour protéger vos renseignements (connexions
            chiffrées, mots de passe protégés, accès restreint à la base de données). Aucun
            système n'est toutefois garanti à 100 % à l'abri des incidents de sécurité.
          </p>
        </Section>

        <Section title="8. Modifications">
          <p>
            Cette politique peut être mise à jour occasionnellement. La date de dernière
            mise à jour est indiquée en haut de cette page.
          </p>
        </Section>

        <p style={{ marginTop: 40, fontSize: 12, color: "#B3A990" }}>
          Ce document est fourni à titre informatif et ne constitue pas un avis juridique.
        </p>
      </div>
    </div>
  );
}

const listStyle = { paddingLeft: 20, marginTop: 8, marginBottom: 12, lineHeight: 1.7 };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: "Baloo 2, sans-serif", color: "#2A4E3B", fontSize: 18, marginBottom: 10 }}>{title}</h2>
      <div style={{ color: "#2B2A26", fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
