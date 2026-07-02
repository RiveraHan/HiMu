
drop view if exists public.public_profiles;

-- Table mirror of public.profiles for RLS purposes
create table public.public_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  bio text
);


insert into public.public_profiles (id, username, display_name, avatar_url, bio)
select id, username, display_name, avatar_url, bio from public.profiles;


alter table public.public_profiles enable row level security;

create policy "public_profiles_select_authenticated"
  on public.public_profiles for select
  to authenticated
  using (true);

-- Revoke all default privileges
revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

-- Create a trigger to sync public_profiles with profiles
create or replace function public.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.public_profiles (id, username, display_name, avatar_url, bio)
  values (new.id, new.username, new.display_name, new.avatar_url, new.bio)
  on conflict (id) do update
    set username     = excluded.username,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        bio          = excluded.bio;
  return new;
end;
$$;

create trigger sync_public_profile
  after insert or update of username, display_name, avatar_url, bio
  on public.profiles
  for each row execute function public.sync_public_profile();
