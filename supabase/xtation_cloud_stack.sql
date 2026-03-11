-- XTATION cloud/operator stack
-- Preferred one-shot apply order for Supabase SQL editor.
--
-- Includes:
-- 1. user_station_profiles
-- 2. operator JWT claim bootstrap
-- 3. operator lookup
-- 4. operator diagnostics
-- 5. operator rollout
-- 6. operator audit feed

-- ============================================================================
-- platform_profiles.sql
-- ============================================================================

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

-- ============================================================================
-- operator_claim_bootstrap.sql
-- ============================================================================

create table if not exists public.xtation_operator_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'ops_admin', 'support_admin', 'beta_manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xtation_operator_assignments_role_idx
  on public.xtation_operator_assignments (role);

alter table public.xtation_operator_assignments enable row level security;

drop policy if exists "xtation_operator_assignments_block_direct" on public.xtation_operator_assignments;
create policy "xtation_operator_assignments_block_direct"
on public.xtation_operator_assignments
for all
using (false)
with check (false);

create or replace function public.set_xtation_operator_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_xtation_operator_assignments_updated_at on public.xtation_operator_assignments;
create trigger trg_xtation_operator_assignments_updated_at
before update on public.xtation_operator_assignments
for each row execute function public.set_xtation_operator_assignments_updated_at();

create or replace function public.xtation_apply_operator_claim(
  claims jsonb,
  claim_user_id uuid
)
returns jsonb
language plpgsql
stable
as $$
declare
  next_claims jsonb := coalesce(claims, '{}'::jsonb);
  operator_role text;
begin
  select role
  into operator_role
  from public.xtation_operator_assignments
  where user_id = claim_user_id;

  if operator_role is not null then
    next_claims := jsonb_set(next_claims, '{xtation_role}', to_jsonb(operator_role));
  else
    next_claims := jsonb_set(next_claims, '{xtation_role}', 'null'::jsonb);
  end if;

  return next_claims;
end;
$$;

create or replace function public.xtation_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  hook_user_id uuid;
begin
  hook_user_id := (event->>'user_id')::uuid;
  claims := public.xtation_apply_operator_claim(event->'claims', hook_user_id);
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;

grant execute on function public.xtation_apply_operator_claim(jsonb, uuid) to supabase_auth_admin;
grant execute on function public.xtation_custom_access_token_hook(jsonb) to supabase_auth_admin;

revoke execute on function public.xtation_apply_operator_claim(jsonb, uuid) from authenticated, anon, public;
revoke execute on function public.xtation_custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.xtation_operator_assignments to supabase_auth_admin;
revoke all on public.xtation_operator_assignments from authenticated, anon, public;

create or replace function public.xtation_seed_operator_role(
  target_email text,
  next_role text default 'super_admin'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if next_role not in ('super_admin', 'ops_admin', 'support_admin', 'beta_manager') then
    raise exception 'Invalid XTATION operator role';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(trim(target_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No auth user found for %', target_email;
  end if;

  insert into public.xtation_operator_assignments (user_id, role)
  values (target_user_id, next_role)
  on conflict (user_id) do update
    set role = excluded.role,
        updated_at = now();

  return target_user_id;
end;
$$;

revoke all on function public.xtation_seed_operator_role(text, text) from public;

-- ============================================================================
-- operator_lookup.sql
-- ============================================================================

create or replace function public.xtation_operator_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'xtation_role', ''),
    nullif(auth.jwt() ->> 'xtation_role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'xtation_role', ''),
    ''
  );
$$;

grant execute on function public.xtation_operator_role() to authenticated;

create or replace function public.xtation_has_operator_access()
returns boolean
language sql
stable
as $$
  select public.xtation_operator_role() in ('super_admin', 'ops_admin', 'support_admin', 'beta_manager');
$$;

grant execute on function public.xtation_has_operator_access() to authenticated;

create or replace function public.xtation_search_station_profiles(
  search_term text default null,
  result_limit integer default 20
)
returns table (
  user_id uuid,
  email text,
  release_channel text,
  plan text,
  trial_ends_at timestamptz,
  beta_cohort text,
  feature_flags jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_search text := nullif(trim(search_term), '');
  safe_limit integer := greatest(1, least(coalesce(result_limit, 20), 50));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.xtation_has_operator_access() then
    raise exception 'Operator access required';
  end if;

  return query
  select
    profile.user_id,
    users.email,
    profile.release_channel,
    profile.plan,
    profile.trial_ends_at,
    profile.beta_cohort,
    profile.feature_flags,
    profile.updated_at
  from public.user_station_profiles profile
  join auth.users users on users.id = profile.user_id
  where
    normalized_search is null
    or profile.user_id::text ilike '%' || normalized_search || '%'
    or coalesce(users.email, '') ilike '%' || normalized_search || '%'
    or coalesce(profile.beta_cohort, '') ilike '%' || normalized_search || '%'
  order by profile.updated_at desc nulls last, profile.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.xtation_search_station_profiles(text, integer) from public;
grant execute on function public.xtation_search_station_profiles(text, integer) to authenticated;

-- ============================================================================
-- operator_diagnostics.sql
-- ============================================================================

create or replace function public.xtation_operator_diagnostics()
returns table (
  operator_user_id uuid,
  operator_email text,
  role_claim text,
  assignment_role text,
  has_operator_access boolean,
  has_platform_profiles_table boolean,
  has_operator_assignments_table boolean,
  has_lookup_rpc boolean,
  has_rollout_rpc boolean,
  has_audit_rpc boolean,
  has_hook_function boolean,
  current_profile_exists boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  has_assignments_table boolean := to_regclass('public.xtation_operator_assignments') is not null;
  has_profiles_table boolean := to_regclass('public.user_station_profiles') is not null;
  current_assignment_role text := null;
  current_profile_present boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if has_assignments_table then
    select role
    into current_assignment_role
    from public.xtation_operator_assignments
    where user_id = current_user_id;
  end if;

  if has_profiles_table then
    select exists(
      select 1
      from public.user_station_profiles
      where user_id = current_user_id
    )
    into current_profile_present;
  end if;

  return query
  select
    current_user_id as operator_user_id,
    users.email as operator_email,
    nullif(public.xtation_operator_role(), '') as role_claim,
    current_assignment_role as assignment_role,
    public.xtation_has_operator_access() as has_operator_access,
    has_profiles_table as has_platform_profiles_table,
    has_assignments_table as has_operator_assignments_table,
    to_regprocedure('public.xtation_search_station_profiles(text,integer)') is not null as has_lookup_rpc,
    to_regprocedure('public.xtation_apply_station_rollout(uuid,text,text,integer,boolean,text,boolean,jsonb)') is not null as has_rollout_rpc,
    to_regprocedure('public.xtation_recent_operator_audit(uuid,integer)') is not null as has_audit_rpc,
    to_regprocedure('public.xtation_custom_access_token_hook(jsonb)') is not null as has_hook_function,
    current_profile_present as current_profile_exists
  from auth.users users
  where users.id = current_user_id;
end;
$$;

revoke all on function public.xtation_operator_diagnostics() from public;
grant execute on function public.xtation_operator_diagnostics() to authenticated;

-- ============================================================================
-- operator_rollout.sql
-- ============================================================================

create table if not exists public.xtation_operator_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  actor_role text null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  summary text not null,
  patch jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists xtation_operator_audit_log_target_idx
  on public.xtation_operator_audit_log (target_user_id, created_at desc);

create index if not exists xtation_operator_audit_log_actor_idx
  on public.xtation_operator_audit_log (actor_user_id, created_at desc);

alter table public.xtation_operator_audit_log enable row level security;

drop policy if exists "xtation_operator_audit_log_block_direct" on public.xtation_operator_audit_log;
create policy "xtation_operator_audit_log_block_direct"
on public.xtation_operator_audit_log
for all
using (false)
with check (false);

create or replace function public.xtation_apply_station_rollout(
  target_user_id uuid,
  next_release_channel text default null,
  next_plan text default null,
  next_trial_days integer default null,
  clear_trial boolean default false,
  next_beta_cohort text default null,
  clear_beta_cohort boolean default false,
  feature_flags_patch jsonb default null
)
returns table (
  user_id uuid,
  email text,
  release_channel text,
  plan text,
  trial_ends_at timestamptz,
  beta_cohort text,
  feature_flags jsonb,
  updated_at timestamptz,
  audit_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text := public.xtation_operator_role();
  actor_email text := nullif(auth.jwt() ->> 'email', '');
  current_profile public.user_station_profiles%rowtype;
  effective_release_channel text;
  effective_plan text;
  effective_trial_ends_at timestamptz;
  effective_beta_cohort text;
  effective_feature_flags jsonb;
  applied_patch jsonb := '{}'::jsonb;
  new_audit_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.xtation_has_operator_access() then
    raise exception 'Operator access required';
  end if;

  if target_user_id is null then
    raise exception 'Target user id is required';
  end if;

  if next_release_channel is not null and next_release_channel not in ('internal', 'beta', 'stable') then
    raise exception 'Invalid release channel';
  end if;

  if next_plan is not null and next_plan not in ('free', 'trial', 'pro', 'team') then
    raise exception 'Invalid plan';
  end if;

  if next_trial_days is not null and next_trial_days < 1 then
    raise exception 'Trial days must be positive';
  end if;

  if feature_flags_patch is not null and jsonb_typeof(feature_flags_patch) <> 'object' then
    raise exception 'Feature flag patch must be a JSON object';
  end if;

  insert into public.user_station_profiles (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  select *
  into current_profile
  from public.user_station_profiles
  where public.user_station_profiles.user_id = target_user_id
  for update;

  effective_release_channel := coalesce(next_release_channel, current_profile.release_channel);
  if next_release_channel is null and next_beta_cohort is not null and nullif(trim(next_beta_cohort), '') is not null then
    effective_release_channel := 'beta';
  end if;

  effective_plan := current_profile.plan;
  if next_trial_days is not null then
    effective_plan := 'trial';
  elsif next_plan is not null then
    effective_plan := next_plan;
  end if;

  effective_trial_ends_at := current_profile.trial_ends_at;
  if clear_trial then
    effective_trial_ends_at := null;
    if next_plan is null and current_profile.plan = 'trial' then
      effective_plan := 'free';
    end if;
  elsif next_trial_days is not null then
    effective_trial_ends_at := now() + make_interval(days => next_trial_days);
  elsif next_plan is not null and next_plan <> 'trial' then
    effective_trial_ends_at := null;
  end if;

  effective_beta_cohort := current_profile.beta_cohort;
  if clear_beta_cohort then
    effective_beta_cohort := null;
  elsif next_beta_cohort is not null then
    effective_beta_cohort := nullif(trim(next_beta_cohort), '');
  end if;

  effective_feature_flags := current_profile.feature_flags;
  if feature_flags_patch is not null then
    effective_feature_flags := coalesce(current_profile.feature_flags, '{}'::jsonb) || feature_flags_patch;
  end if;

  update public.user_station_profiles
  set
    release_channel = effective_release_channel,
    plan = effective_plan,
    trial_ends_at = effective_trial_ends_at,
    beta_cohort = effective_beta_cohort,
    feature_flags = effective_feature_flags
  where public.user_station_profiles.user_id = target_user_id
  returning * into current_profile;

  applied_patch := jsonb_strip_nulls(
    jsonb_build_object(
      'release_channel', next_release_channel,
      'plan', next_plan,
      'trial_days', next_trial_days,
      'clear_trial', case when clear_trial then true else null end,
      'beta_cohort', case when next_beta_cohort is not null then nullif(trim(next_beta_cohort), '') else null end,
      'clear_beta_cohort', case when clear_beta_cohort then true else null end,
      'feature_flags_patch', feature_flags_patch
    )
  );

  insert into public.xtation_operator_audit_log (
    id,
    actor_user_id,
    actor_email,
    actor_role,
    target_user_id,
    action,
    summary,
    patch
  )
  values (
    new_audit_id,
    auth.uid(),
    actor_email,
    actor_role,
    target_user_id,
    'station_rollout_update',
    format(
      'Station rollout updated for %s (%s / %s)',
      target_user_id::text,
      current_profile.release_channel,
      current_profile.plan
    ),
    applied_patch
  );

  return query
  select
    current_profile.user_id,
    users.email,
    current_profile.release_channel,
    current_profile.plan,
    current_profile.trial_ends_at,
    current_profile.beta_cohort,
    current_profile.feature_flags,
    current_profile.updated_at,
    new_audit_id
  from auth.users users
  where users.id = current_profile.user_id;
end;
$$;

revoke all on function public.xtation_apply_station_rollout(uuid, text, text, integer, boolean, text, boolean, jsonb) from public;
grant execute on function public.xtation_apply_station_rollout(uuid, text, text, integer, boolean, text, boolean, jsonb) to authenticated;

-- ============================================================================
-- operator_audit_feed.sql
-- ============================================================================

create or replace function public.xtation_recent_operator_audit(
  p_target_user_id uuid default null,
  result_limit integer default 20
)
returns table (
  audit_id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  target_user_id uuid,
  target_email text,
  action text,
  summary text,
  patch jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(result_limit, 20), 50));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.xtation_has_operator_access() then
    raise exception 'Operator access required';
  end if;

  return query
  select
    audit.id as audit_id,
    audit.actor_user_id,
    audit.actor_email,
    audit.actor_role,
    audit.target_user_id,
    target_users.email as target_email,
    audit.action,
    audit.summary,
    audit.patch,
    audit.created_at
  from public.xtation_operator_audit_log audit
  join auth.users target_users on target_users.id = audit.target_user_id
  where p_target_user_id is null or audit.target_user_id = p_target_user_id
  order by audit.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.xtation_recent_operator_audit(uuid, integer) from public;
grant execute on function public.xtation_recent_operator_audit(uuid, integer) to authenticated;
