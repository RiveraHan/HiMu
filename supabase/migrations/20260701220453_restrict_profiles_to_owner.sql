
drop policy if exists "Profiles viewable by everyone" on public.profiles;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create view public.public_profiles as
  select id, username, display_name, avatar_url, bio from public.profiles;
grant select on public.public_profiles to anon, authenticated;