export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/reset-password", "/commentaires"],
    },
    sitemap: "https://planif.net/sitemap.xml",
  };
}
