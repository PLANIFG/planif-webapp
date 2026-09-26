import "./globals.css";

const DESCRIPTION =
  "PLANIF génère en quelques clics vos activités de journée pédagogique, d'après-midi de concertation et de service de garde : horaire, rotations, liste de matériel et fiches prêtes à imprimer. Conçu par une éducatrice, pour les éducatrices en milieu scolaire.";

export const metadata = {
  metadataBase: new URL("https://planif.net"),
  title: {
    default: "PLANIF – Activités de journée pédagogique et service de garde en quelques clics",
    template: "%s | PLANIF",
  },
  description: DESCRIPTION,
  applicationName: "PLANIF",
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: "https://planif.net",
    siteName: "PLANIF",
    title: "PLANIF – Activités de journée pédagogique et service de garde en quelques clics",
    description: DESCRIPTION,
    images: [{ url: "/logo-planif-vert.png", width: 801, height: 246, alt: "PLANIF" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr-CA">
      <body>{children}</body>
    </html>
  );
}
