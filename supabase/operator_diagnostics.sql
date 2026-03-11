-- Signed-in cloud readiness diagnostics for XTATION operator setup.
-- Apply after operator_lookup.sql.

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
