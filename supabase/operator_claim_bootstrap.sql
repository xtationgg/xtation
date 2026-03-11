-- XTATION operator claim bootstrap.
-- Recommended path for cloud operator access:
-- 1. Apply this file.
-- 2. In Supabase Dashboard -> Authentication -> Hooks (Beta),
--    set the Custom Access Token Hook to public.xtation_custom_access_token_hook
--    or merge public.xtation_apply_operator_claim into your existing hook.
-- 3. Seed your first operator with:
--      select public.xtation_seed_operator_role('you@example.com', 'super_admin');
-- 4. Sign out and sign back in so a fresh JWT is issued with xtation_role.

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
