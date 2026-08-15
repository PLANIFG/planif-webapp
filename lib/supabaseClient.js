"use client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// La clé "anon" est publique par design (visible côté navigateur) — c'est
// normal et sécuritaire tant que les règles de sécurité (RLS) sont
// activées dans Supabase (voir supabase/schema.sql). C'est très
// différent de la clé Anthropic, qui elle doit rester secrète.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
