create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Content plan',
  join_code text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create policy "Members can read workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

create policy "Members can update workspaces"
on public.workspaces
for update
to authenticated
using (public.is_workspace_member(id))
with check (public.is_workspace_member(id));

create policy "Signed in users can create workspaces"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Members can read their membership"
on public.workspace_members
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.add_owner_to_workspace_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists add_owner_membership on public.workspaces;
create trigger add_owner_membership
after insert on public.workspaces
for each row execute function public.add_owner_to_workspace_members();

create or replace function public.join_workspace(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_workspace_id uuid;
begin
  select id
  into found_workspace_id
  from public.workspaces
  where join_code = upper(trim(p_join_code));

  if found_workspace_id is null then
    raise exception 'Workspace code not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (found_workspace_id, auth.uid(), 'editor')
  on conflict (workspace_id, user_id) do nothing;

  return found_workspace_id;
end;
$$;

grant execute on function public.join_workspace(text) to authenticated;
