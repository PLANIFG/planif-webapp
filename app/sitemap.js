const BASE = "https://planif.net";

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/politique-confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/conditions-utilisation`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
