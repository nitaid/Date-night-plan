-- Date Night — shared state for a couple.
-- Paste this whole file into the Supabase SQL editor and run it once.

create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.couple_state (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_state enable row level security;

-- Am I in this couple? Security definer so the policy itself does not recurse
-- through couple_members' own RLS.
create or replace function public.is_member(p_couple uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple and user_id = auth.uid()
  );
$$;

drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples
  for select to authenticated using (public.is_member(id));

drop policy if exists members_select on public.couple_members;
create policy members_select on public.couple_members
  for select to authenticated using (user_id = auth.uid() or public.is_member(couple_id));

drop policy if exists members_delete on public.couple_members;
create policy members_delete on public.couple_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists state_select on public.couple_state;
create policy state_select on public.couple_state
  for select to authenticated using (public.is_member(couple_id));

drop policy if exists state_insert on public.couple_state;
create policy state_insert on public.couple_state
  for insert to authenticated with check (public.is_member(couple_id));

drop policy if exists state_update on public.couple_state;
create policy state_update on public.couple_state
  for update to authenticated using (public.is_member(couple_id)) with check (public.is_member(couple_id));

-- Membership is only ever granted through these two functions, so nobody can
-- add themselves to a couple by writing to couple_members directly.

create or replace function public.create_couple()
returns table (couple_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Reuse the couple this user already belongs to rather than orphaning it.
  select cm.couple_id into v_id from public.couple_members cm where cm.user_id = auth.uid() limit 1;
  if v_id is not null then
    return query select c.id, c.invite_code from public.couples c where c.id = v_id;
    return;
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.couples c where c.invite_code = v_code);
  end loop;

  insert into public.couples (invite_code) values (v_code) returning id into v_id;
  insert into public.couple_members (couple_id, user_id) values (v_id, auth.uid());
  insert into public.couple_state (couple_id, state, updated_by) values (v_id, '{}'::jsonb, auth.uid());

  return query select v_id, v_code;
end;
$$;

create or replace function public.join_couple(p_code text)
returns table (couple_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select c.id into v_id from public.couples c where c.invite_code = upper(trim(p_code));
  if v_id is null then
    raise exception 'invalid invite code';
  end if;

  select count(*) into v_count from public.couple_members cm where cm.couple_id = v_id;
  if v_count >= 2 and not exists (
    select 1 from public.couple_members cm where cm.couple_id = v_id and cm.user_id = auth.uid()
  ) then
    raise exception 'this couple already has two members';
  end if;

  -- Leaving any previous couple keeps one account in exactly one couple.
  delete from public.couple_members cm where cm.user_id = auth.uid() and cm.couple_id <> v_id;
  insert into public.couple_members (couple_id, user_id)
    values (v_id, auth.uid())
    on conflict do nothing;

  return query select c.id, c.invite_code from public.couples c where c.id = v_id;
end;
$$;

grant execute on function public.create_couple() to authenticated;
grant execute on function public.join_couple(text) to authenticated;

-- Live updates between the two devices.
do $$
begin
  alter publication supabase_realtime add table public.couple_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
