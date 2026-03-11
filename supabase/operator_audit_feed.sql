-- Read-only backend audit feed for XTATION operator actions.
-- Apply after operator_rollout.sql.

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
