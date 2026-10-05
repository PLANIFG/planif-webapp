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

-- Extras gratuits générés automatiquement (bingo, quiz, cartes, collation,
-- matériel, fiches de transition) : compteur quotidien séparé des crédits.
alter table public.subscriptions
  add column if not exists extras_used integer not null default 0,
  add column if not exists extras_day date;

create or replace function public.try_consume_extra(p_user_id uuid, p_daily_limit integer default 50)
returns table(allowed boolean, extras_used integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status text;
  v_sub_id text;
  v_used integer;
  v_day date;
  v_today date := (now() at time zone 'America/Toronto')::date;
begin
  select s.status, s.stripe_subscription_id, s.extras_used, s.extras_day
  into v_status, v_sub_id, v_used, v_day
  from subscriptions s
  where s.user_id = p_user_id
  for update;

  if not found or v_sub_id is null or v_status not in ('active', 'trialing') then
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  if v_day is distinct from v_today then
    v_used := 0;
  end if;

  if v_used >= p_daily_limit then
    return query select false, v_used;
    return;
  end if;

  update subscriptions s
  set extras_used = v_used + 1, extras_day = v_today
  where s.user_id = p_user_id;

  return query select true, v_used + 1;
end;
$$;

revoke all on function public.try_consume_extra(uuid, integer) from public, anon, authenticated;
grant execute on function public.try_consume_extra(uuid, integer) to service_role;
