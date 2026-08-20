export default function ConditionsUtilisation() {
  return (
    <div style={{ minHeight: "100vh", background: "#FBF8F2", padding: "48px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "white", borderRadius: 4, padding: "40px 32px", borderTop: "3px solid #10192B", boxShadow: "0 20px 50px -22px rgba(36,56,74,0.25)" }}>
        <h1 style={{ fontFamily: "Baloo 2, sans-serif", color: "#3C6E52", fontSize: 28, marginBottom: 8 }}>
          Conditions d'utilisation
        </h1>
        <p style={{ color: "#7A7362", fontSize: 13, marginBottom: 32 }}>
          Dernière mise à jour : {new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <Section title="1. Acceptation des conditions">
          <p>
            En créant un compte et en utilisant PLANIF, vous acceptez les présentes conditions
            d'utilisation. Si vous n'êtes pas d'accord, veuillez ne pas utiliser le service.
          </p>
        </Section>

        <Section title="2. Description du service">
          <p>
            PLANIF est un outil web destiné aux éducatrices en milieu scolaire pour générer,
            organiser et imprimer des planifications d'activités éducatives, à l'aide
            notamment de l'intelligence artificielle.
          </p>
        </Section>

        <Section title="3. Abonnement et paiement">
          <ul style={listStyle}>
            <li>L'accès complet à PLANIF nécessite un abonnement payant, facturé mensuellement ou annuellement selon le forfait choisi</li>
            <li>Les paiements sont traités par Stripe; nous ne stockons aucune information de carte de crédit</li>
            <li>Vous pouvez annuler votre abonnement en tout temps depuis la section « Gérer mon abonnement » de l'application. L'accès reste actif jusqu'à la fin de la période déjà payée</li>
            <li>Sauf indication contraire, les paiements déjà effectués ne sont pas remboursables</li>
          </ul>
        </Section>

        <Section title="4. Contenu généré par intelligence artificielle">
          <p>
            Les idées d'activités, amorces et autres contenus générés par PLANIF proviennent
            d'un système d'intelligence artificielle. Bien que nous visions un contenu
            pertinent et sécuritaire, vous demeurez responsable de réviser et d'adapter ce
            contenu avant de l'utiliser auprès des enfants, notamment pour toute question de
            sécurité, d'allergie ou de convenance à un groupe précis.
          </p>
        </Section>

        <Section title="5. Utilisation acceptable">
          <p>Vous vous engagez à ne pas :</p>
          <ul style={listStyle}>
            <li>Utiliser PLANIF à des fins illégales ou non autorisées</li>
            <li>Tenter d'accéder aux comptes d'autres utilisatrices</li>
            <li>Revendre ou redistribuer l'accès à votre compte</li>
            <li>Perturber le fonctionnement du service (surcharge, piratage, etc.)</li>
          </ul>
        </Section>

        <Section title="6. Propriété du contenu">
          <p>
            Les planifications que vous créez et enregistrez vous appartiennent. Vous pouvez
            les imprimer, les modifier et les utiliser librement dans le cadre de votre travail.
          </p>
        </Section>

        <Section title="7. Disponibilité du service">
          <p>
            Nous faisons de notre mieux pour maintenir PLANIF disponible et fonctionnel, mais
            ne garantissons pas un accès ininterrompu. Le service peut être temporairement
            interrompu pour maintenance ou en raison de facteurs hors de notre contrôle.
          </p>
        </Section>

        <Section title="8. Limitation de responsabilité">
          <p>
            PLANIF est fourni « tel quel ». Dans la mesure permise par la loi, nous ne sommes
            pas responsables des dommages indirects découlant de l'utilisation du service, y
            compris ceux liés au contenu généré par intelligence artificielle.
          </p>
        </Section>

        <Section title="9. Résiliation">
          <p>
            Nous nous réservons le droit de suspendre ou fermer un compte en cas de non-respect
            des présentes conditions.
          </p>
        </Section>

        <Section title="10. Modifications">
          <p>
            Ces conditions peuvent être mises à jour occasionnellement. La poursuite de
            l'utilisation de PLANIF après une modification vaut acceptation des nouvelles
            conditions.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Pour toute question concernant ces conditions, écrivez à{" "}
            <a href="mailto:Planif.net@gmail.com" style={{ color: "inherit" }}>Planif.net@gmail.com</a>.
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
