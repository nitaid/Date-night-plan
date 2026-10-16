-- Streak Club schema
-- Run once in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- Members of the club. A row exists only after joining with the invite code.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  emoji        text not null default '😎',
  timezone     text not null default 'Asia/Jerusalem',
  report_token uuid not null unique default gen_random_uuid(),
  joined_at    timestamptz not null default now()
);

-- Every reset ("I opened the app"). At most one per user per local day.
create table public.resets (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  day         date not null,
  source      text not null check (source in ('shortcut', 'manual')),
  unique (user_id, day)
);
create index resets_user_day_idx on public.resets (user_id, day);

-- Private settings (invite code). Not readable by clients.
create table public.club_settings (
  id          boolean primary key default true check (id),
  invite_code text not null
);
insert into public.club_settings (invite_code) values ('CHANGE-ME');

alter table public.profiles      enable row level security;
alter table public.resets        enable row level security;
alter table public.club_settings enable row level security;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- Members see each other; nobody outside the club sees anything.
create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member());
create policy "members read resets" on public.resets
  for select to authenticated using (public.is_member());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- report_token is secret: column-level grants keep it out of plain selects.
-- Its owner reads it via my_report_token().
revoke all on public.profiles, public.resets, public.club_settings from anon, authenticated;
grant select (id, display_name, emoji, timezone, joined_at) on public.profiles to authenticated;
grant update (display_name, emoji, timezone) on public.profiles to authenticated;
grant select on public.resets to authenticated;

-- Join the club with the shared invite code.
create or replace function public.join_club(p_name text, p_code text, p_emoji text default '😎')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from club_settings where invite_code = p_code) then
    raise exception 'wrong invite code';
  end if;
  insert into profiles (id, display_name, emoji)
  values (auth.uid(), trim(p_name), coalesce(nullif(p_emoji, ''), '😎'))
  on conflict (id) do update set display_name = excluded.display_name, emoji = excluded.emoji;
end $$;

-- Internal: record a reset for a user, deduped per local day.
create or replace function public._record_reset(p_user uuid, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare tz text;
begin
  select timezone into tz from profiles where id = p_user;
  if tz is null then raise exception 'unknown user'; end if;
  insert into resets (user_id, day, source)
  values (p_user, (now() at time zone tz)::date, p_source)
  on conflict (user_id, day) do nothing;
end $$;
revoke all on function public._record_reset(uuid, text) from public, anon, authenticated;

-- Called by the iPhone Shortcut (via /api/report/<token>). Token = identity.
create or replace function public.report_open(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from profiles where report_token = p_token;
  if uid is null then return false; end if;
  perform _record_reset(uid, 'shortcut');
  return true;
end $$;
grant execute on function public.report_open(uuid) to anon, authenticated;

-- "I slipped" button.
create or replace function public.report_self()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _record_reset(auth.uid(), 'manual');
end $$;
grant execute on function public.report_self() to authenticated;

create or replace function public.my_report_token()
returns uuid language sql stable security definer set search_path = public as $$
  select report_token from profiles where id = auth.uid();
$$;
grant execute on function public.my_report_token() to authenticated;

create or replace function public.rotate_report_token()
returns uuid language sql security definer set search_path = public as $$
  update profiles set report_token = gen_random_uuid() where id = auth.uid() returning report_token;
$$;
grant execute on function public.rotate_report_token() to authenticated;

-- Today's date in a member's timezone, so streak math matches the server.
create or replace function public.today_for(p_tz text)
returns date language sql stable as $$ select (now() at time zone p_tz)::date; $$;
