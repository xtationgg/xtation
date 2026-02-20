-- Universal attachment metadata + thumbnail storage.
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_type text not null check (owner_type in ('inventory', 'player')),
  owner_id text not null,
  kind text not null check (kind in ('image', 'video', 'file')),
  title text null,
  notes text null,
  mime text null,
  size_bytes bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  thumb_path text not null,
  local_key text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists user_files_user_owner_idx
  on public.user_files (user_id, owner_type, owner_id);

create index if not exists user_files_user_created_idx
  on public.user_files (user_id, created_at desc);

alter table public.user_files enable row level security;

drop policy if exists "user_files_select_own" on public.user_files;
create policy "user_files_select_own"
on public.user_files for select
using (user_id = auth.uid());

drop policy if exists "user_files_insert_own" on public.user_files;
create policy "user_files_insert_own"
on public.user_files for insert
with check (user_id = auth.uid());

drop policy if exists "user_files_update_own" on public.user_files;
create policy "user_files_update_own"
on public.user_files for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_files_delete_own" on public.user_files;
create policy "user_files_delete_own"
on public.user_files for delete
using (user_id = auth.uid());

create or replace function public.set_user_files_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_files_updated_at on public.user_files;
create trigger trg_user_files_updated_at
before update on public.user_files
for each row execute function public.set_user_files_updated_at();

insert into storage.buckets (id, name, public)
values ('thumbs', 'thumbs', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "thumbs_select_own_prefix" on storage.objects;
create policy "thumbs_select_own_prefix"
on storage.objects for select
using (
  bucket_id = 'thumbs'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "thumbs_insert_own_prefix" on storage.objects;
create policy "thumbs_insert_own_prefix"
on storage.objects for insert
with check (
  bucket_id = 'thumbs'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "thumbs_update_own_prefix" on storage.objects;
create policy "thumbs_update_own_prefix"
on storage.objects for update
using (
  bucket_id = 'thumbs'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'thumbs'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "thumbs_delete_own_prefix" on storage.objects;
create policy "thumbs_delete_own_prefix"
on storage.objects for delete
using (
  bucket_id = 'thumbs'
  and auth.uid()::text = split_part(name, '/', 1)
);

