-- À exécuter dans Supabase : SQL Editor → coller → Run
-- Ajoute le suivi des abonnements (Stripe) à la table des comptes.

create table if not exists public.subscriptions (
  user_id uuid references auth.users(id) on delete cascade primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,                          -- 'monthly' ou 'annual'
  status text default 'inactive',     -- 'active', 'inactive', 'canceled', 'past_due'
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

-- Chacun peut voir son propre statut d'abonnement.
create policy "Chacun voit son propre abonnement"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Seul le serveur (via la clé service_role, jamais le navigateur) peut
-- créer ou modifier les abonnements — empêche quiconque de se donner
-- un abonnement gratuitement en modifiant les données côté client.
create policy "Le serveur gère les abonnements"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Rend un crédit quand une génération échoue côté serveur (panne Anthropic,
-- coupure, réponse vide). Appelée seulement par la route /api/generate
-- avec la clé service_role.
create or replace function public.refund_generation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update subscriptions
  set generations_used = greatest(generations_used - 1, 0)
  where user_id = p_user_id;
end;
$$;

revoke all on function public.refund_generation(uuid) from public, anon, authenticated;
grant execute on function public.refund_generation(uuid) to service_role;
