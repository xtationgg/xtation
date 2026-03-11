-- Audited operator rollout actions for XTATION cloud account support.
-- Apply after platform_profiles.sql and operator_lookup.sql.

create extension if not exists pgcrypto;

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
