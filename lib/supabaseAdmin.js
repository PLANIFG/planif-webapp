import { createClient } from "@supabase/supabase-js";

// Ce client utilise la clé "service_role" (secrète) — elle peut modifier
// n'importe quelle donnée, en contournant les protections RLS. C'est
// pourquoi elle n'est utilisée QUE dans des routes serveur (/app/api),
// jamais dans un composant "use client". Ne jamais préfixer cette
// variable d'environnement par NEXT_PUBLIC_.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
