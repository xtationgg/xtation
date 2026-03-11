-- Account-level XTATION platform profile.
-- Apply in Supabase SQL editor after auth is enabled.

create extension if not exists pgcrypto;

create table if not exists public.user_station_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  release_channel text not null default 'stable' check (release_channel in ('internal', 'beta', 'stable')),
  plan text not null default 'free' check (plan in ('free', 'trial', 'pro', 'team')),
  trial_ends_at timestamptz null,
  beta_cohort text null,
  feature_flags jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_station_profiles_release_channel_idx
  on public.user_station_profiles (release_channel);

create index if not exists user_station_profiles_plan_idx
  on public.user_station_profiles (plan);

alter table public.user_station_profiles enable row level security;

drop policy if exists "user_station_profiles_select_own" on public.user_station_profiles;
create policy "user_station_profiles_select_own"
on public.user_station_profiles for select
using (user_id = auth.uid());

drop policy if exists "user_station_profiles_insert_own" on public.user_station_profiles;
create policy "user_station_profiles_insert_own"
on public.user_station_profiles for insert
with check (user_id = auth.uid());

drop policy if exists "user_station_profiles_update_own" on public.user_station_profiles;
create policy "user_station_profiles_update_own"
on public.user_station_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_station_profiles_delete_own" on public.user_station_profiles;
create policy "user_station_profiles_delete_own"
on public.user_station_profiles for delete
using (user_id = auth.uid());

create or replace function public.set_user_station_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_station_profiles_updated_at on public.user_station_profiles;
create trigger trg_user_station_profiles_updated_at
before update on public.user_station_profiles
for each row execute function public.set_user_station_profiles_updated_at();
