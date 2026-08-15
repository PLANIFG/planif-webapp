import "./globals.css";

export const metadata = {
  title: "PLANIF — Planificateur d'activités éducatives",
  description: "Planification d'activités pour éducatrices en milieu scolaire",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
