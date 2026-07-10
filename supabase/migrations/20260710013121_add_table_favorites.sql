create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  track_id text not null,
  title text not null,
  artist text not null,
  audio_url text not null,
  album_art_url text,
  duration integer,
  genre text,
  created_at timestamptz default now()
);

create unique index favorites_user_track_idx on public.favorites (user_id, track_id);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create policy "Users can view own favorites" on public.favorites
  for select using (auth.uid() = user_id);
create policy "Users can add own favorites" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "Users can remove own favorites" on public.favorites
  for delete using (auth.uid() = user_id);
