-- Operator-only cloud lookup for XTATION support/admin workflows.
-- Requires a signed-in JWT with an XTATION operator role claim.
--
-- Recommended claim:
--   app_metadata.xtation_role = 'super_admin' | 'ops_admin' | 'support_admin' | 'beta_manager'
--
-- Apply after platform_profiles.sql.

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
