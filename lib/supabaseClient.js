"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// createClientComponentClient (plutôt que createClient de base) synchronise
// la session à la fois dans le navigateur ET dans un cookie — nécessaire
// pour que nos routes serveur (/api/generate, /api/checkout, etc.), qui
// lisent la session via createRouteHandlerClient, puissent la reconnaître.
export const supabase = createClientComponentClient();
