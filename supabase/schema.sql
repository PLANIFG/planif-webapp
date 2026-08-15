-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run
-- Les comptes utilisateurs (connexion/mot de passe) sont gérés
-- automatiquement par Supabase Auth — ceci ne fait que créer la table
-- qui stocke les données propres à chaque personne (lieux, groupes,
-- préférences), reliée à son compte.

create table if not exists public.user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  lieux jsonb default '[]'::jsonb,
  groupes jsonb default '[]'::jsonb,
  educatrice text default '',
  theme_par_defaut text default '',
  updated_at timestamptz default now()
);

-- Sécurité : chaque personne ne peut lire/modifier QUE ses propres données.
alter table public.user_settings enable row level security;

create policy "Chacun voit ses propres réglages"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Chacun modifie ses propres réglages"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Chacun met à jour ses propres réglages"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- Optionnel (phase 2) : sauvegarder des journées/semaines planifiées
-- complètes, pas seulement les réglages.
create table if not exists public.saved_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  titre text,
  mode text,
  contenu jsonb,
  created_at timestamptz default now()
);

alter table public.saved_plans enable row level security;

create policy "Chacun voit ses propres plans"
  on public.saved_plans for select
  using (auth.uid() = user_id);

create policy "Chacun crée ses propres plans"
  on public.saved_plans for insert
  with check (auth.uid() = user_id);

create policy "Chacun modifie ses propres plans"
  on public.saved_plans for update
  using (auth.uid() = user_id);

create policy "Chacun supprime ses propres plans"
  on public.saved_plans for delete
  using (auth.uid() = user_id);
