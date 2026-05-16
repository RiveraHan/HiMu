-- HiMu database schema
-- Created: 2026-05-16

-- ===========================
-- PROFILE (extends auth.users)
-- ===========================

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'premium')),
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================
-- DJs / AI AGENTS
-- ===========================

create table if not exists public.djs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  character text,
  voice_style text,
  avatar_url text,
  genre_specialties text[],
  mood_tags text[],
  is_premium boolean default false,
  personality_traits jsonb default '{}',
  created_at timestamptz default now()
);

-- ===========================
-- CREATORS (Human artists)
-- ===========================

create table if not exists public.creators (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  bio text,
  avatar_url text,
  verified boolean default false,
  social_links jsonb default '{}',
  follower_count integer default 0,
  created_at timestamptz default now()
);

-- Junction: users following creators
create table if not exists public.follows (
  user_id uuid references public.profiles(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, creator_id)
);

-- ===========================
-- TRACKS
-- ===========================

create table if not exists public.tracks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  artist text not null,
  album text,
  album_art_url text,
  audio_url text,
  duration integer, -- in seconds
  bpm integer,
  key text,
  genre text,
  mood_tags text[],
  energy_level integer check (energy_level between 1 and 10),
  is_ai_generated boolean default false,
  dj_id uuid references public.djs(id),
  creator_id uuid references public.creators(id),
  created_at timestamptz default now()
);

-- ===========================
-- PLAYLISTS
-- ===========================

create table if not exists public.playlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  is_public boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid references public.playlists(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete cascade,
  position integer not null,
  added_at timestamptz default now(),
  primary key (playlist_id, track_id)
);

-- ===========================
-- LIVE SESSIONS
-- ===========================

create table if not exists public.live_sessions (
  id uuid default gen_random_uuid() primary key,
  dj_id uuid references public.djs(id),
  host_id uuid references public.profiles(id),
  title text not null,
  description text,
  status text default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  stream_url text,
  listener_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.session_listeners (
  session_id uuid references public.live_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (session_id, user_id)
);

-- ===========================
-- COMMUNITIES
-- ===========================

create table if not exists public.communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  cover_image text,
  member_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('member', 'moderator', 'admin')),
  joined_at timestamptz default now(),
  primary key (community_id, user_id)
);

create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  media_url text,
  created_at timestamptz default now()
);

-- ===========================
-- DJ INTERACTIONS
-- ===========================

create table if not exists public.dj_interactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  dj_id uuid references public.djs(id) on delete cascade,
  message text not null,
  response text,
  type text default 'chat' check (type in ('chat', 'request', 'feedback')),
  created_at timestamptz default now()
);

-- ===========================
-- LISTENING STATS
-- ===========================
create table if not exists public.listening_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  minutes_listened integer default 0,
  tracks_played integer default 0,
  top_genre text,
  unique (user_id, date)
);

-- ===========================
-- MUSIC PREFERENCES
-- ===========================
create table if not exists public.music_preferences (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  genres text[],
  moods text[],
  bpm_range jsonb default '{"min": 60, "max": 180}',
  focus_modes jsonb default '{"work": false, "sleep": false, "exercise": false, "relax": false}',
  updated_at timestamptz default now()
);

-- TRIGGERS CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- DJ Music Generation Configuration (maps each DJ to their AI music provider settings)
create table if not exists public.dj_generation_configs (
  dj_id uuid references public.djs(id) on delete cascade primary key,
  provider text not null check (provider in ('minimax', 'elevenlabs')),
  model text not null, -- 'music-2.6-free', 'music-2.6', 'eleven-music', etc.
  base_prompt text not null,
  default_lyrics text,
  is_instrumental boolean default true,
  voice_id text, -- for ElevenLabs TTS/voice (null for MiniMax instrumental)
  temperature numeric(3,2) default 0.70 check (temperature >= 0 and temperature <= 2),
  max_duration integer default 120 check (max_duration > 0 and max_duration <= 480), -- seconds, max 8 min
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================
-- RLS POLICIES
-- ===========================

-- Profiles
alter table public.profiles enable row level security;
create policy "Profiles viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- DJs
alter table public.djs enable row level security;
create policy "DJs viewable by everyone" on public.djs for select using (true);

-- Creators
alter table public.creators enable row level security;
create policy "Creators viewable by everyone" on public.creators for select using (true);

-- Follows
alter table public.follows enable row level security;
create policy "Users can view own follows" on public.follows for select using (auth.uid() = user_id);
create policy "Users can follow creators" on public.follows for insert with check (auth.uid() = user_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = user_id);

-- Tracks
alter table public.tracks enable row level security;
create policy "Tracks viewable by everyone" on public.tracks for select using (true);

-- Playlists
alter table public.playlists enable row level security;
create policy "Playlists viewable if public or own" on public.playlists for select using (is_public or auth.uid() = user_id);
create policy "Users can create own playlists" on public.playlists for insert with check (auth.uid() = user_id);
create policy "Users can update own playlists" on public.playlists for update using (auth.uid() = user_id);

-- Communities
alter table public.communities enable row level security;
create policy "Communities viewable by everyone" on public.communities for select using (true);

-- Posts
alter table public.posts enable row level security;
create policy "Posts viewable by everyone" on public.posts for select using (true);
create policy "Users can create posts" on public.posts for insert with check (auth.uid() = user_id);

-- DJ Interactions
alter table public.dj_interactions enable row level security;
create policy "Users can view own interactions" on public.dj_interactions for select using (auth.uid() = user_id);
create policy "Users can create interactions" on public.dj_interactions for insert with check (auth.uid() = user_id);

-- Live Sessions
alter table public.live_sessions enable row level security;
create policy "Live sessions viewable by everyone" on public.live_sessions for select using (true);
create policy "Hosts can create sessions" on public.live_sessions for insert with check (auth.uid() = host_id);
create policy "Hosts can update sessions" on public.live_sessions for update using (auth.uid() = host_id);

-- Session Listeners
alter table public.session_listeners enable row level security;
create policy "Listeners viewable by everyone" on public.session_listeners for select using (true);
create policy "Users can join sessions" on public.session_listeners for insert with check (auth.uid() = user_id);
create policy "Users can leave sessions" on public.session_listeners for delete using (auth.uid() = user_id);

-- Playlist Tracks
alter table public.playlist_tracks enable row level security;
create policy "Playlist tracks viewable if public" on public.playlist_tracks for select
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and (p.is_public or p.user_id = auth.uid())
  ));
create policy "Users can add tracks to own playlists" on public.playlist_tracks for insert
  with check (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));
create policy "Users can remove tracks from own playlists" on public.playlist_tracks for delete
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  ));

-- Community Members
alter table public.community_members enable row level security;
create policy "Members viewable by everyone" on public.community_members for select using (true);
create policy "Users can join communities" on public.community_members for insert with check (auth.uid() = user_id);
create policy "Users can leave communities" on public.community_members for delete using (auth.uid() = user_id);

-- Listening Stats
alter table public.listening_stats enable row level security;
create policy "Users can view own stats" on public.listening_stats for select using (auth.uid() = user_id);
create policy "Users can create own stats" on public.listening_stats for insert with check (auth.uid() = user_id);
create policy "Users can update own stats" on public.listening_stats for update using (auth.uid() = user_id);

-- Music Preferences
alter table public.music_preferences enable row level security;
create policy "Users can view own preferences" on public.music_preferences for select using (auth.uid() = user_id);
create policy "Users can update own preferences" on public.music_preferences for update using (auth.uid() = user_id);
create policy "Users can create own preferences" on public.music_preferences for insert with check (auth.uid() = user_id);

-- DJ Generation Configs (publicly readable, only app/internal updates)
alter table public.dj_generation_configs enable row level security;
create policy "DJ configs viewable by everyone" on public.dj_generation_configs for select using (true);

-- ===========================
-- INDEXES
-- ===========================
create index idx_tracks_genre on public.tracks(genre);
create index idx_tracks_mood on public.tracks using gin(mood_tags);
create index idx_tracks_dj on public.tracks(dj_id);
create index idx_tracks_creator on public.tracks(creator_id);
create index idx_playlist_tracks_playlist on public.playlist_tracks(playlist_id);
create index idx_sessions_status on public.live_sessions(status);
create index idx_posts_community on public.posts(community_id);
create index idx_stats_user_date on public.listening_stats(user_id, date);
create index idx_creators_slug on public.creators(slug);
create index idx_follows_user on public.follows(user_id);
create index idx_follows_creator on public.follows(creator_id);

-- ===========================
-- SAMPLE DATA (optional, for development)
-- ===========================

insert into public.djs (name, slug, character, voice_style, genre_specialties, mood_tags, is_premium)
values 
  ('Nova', 'nova', 'Curiosa, observadora, con un toque de melancolía poética', 'Femenina suave', '{"Ambient","Lo-Fi","Indie"}', '{"Relax","Focus","Dreamy"}', false),
  ('Axon', 'axon', 'Energético, analítico, siempre buscando el drop perfecto', 'Masculina profunda', '{"Techno","House","Electro"}', '{"Energize","Workout","Party"}', true),
  ('Sage', 'sage', 'Sabia, tranquila, conexión con la naturaleza', 'Andrógina etérea', '{"Classical","Nature Sounds","Meditation"}', '{"Sleep","Meditate","Nature"}', true);

insert into public.dj_generation_configs (dj_id, provider, model, base_prompt, is_instrumental, temperature, max_duration)
values 
  ((select id from public.djs where slug = 'nova'), 'minimax', 'music-2.6-free', 'Lo-fi ambient, soft piano, gentle pads, melancholic, poetic atmosphere, quiet luxury', true, 0.60, 120),
  ((select id from public.djs where slug = 'axon'), 'minimax', 'music-2.6-free', 'Techno house, driving bassline, energetic drop, 128 BPM, club atmosphere', true, 1.20, 180),
  ((select id from public.djs where slug = 'sage'), 'minimax', 'music-2.6-free', 'Classical meditation, nature sounds, ethereal strings, forest ambiance, calming', true, 0.50, 300);

insert into public.creators (name, slug, bio, verified)
values 
  ('Luna Voss', 'luna-voss', 'Productora electrónica de Berlín. Fusionando melodías etéreas con beats analógicos.', true),
  ('Marcus Chen', 'marcus-chen', 'Compositor de música de cámara neo-clásica. Piano y cuerdas.', false);

insert into public.tracks (title, artist, album, album_art_url, audio_url, duration, bpm, genre, mood_tags, energy_level, is_ai_generated, dj_id)
select 
  'Midnight Drift ' || i,
  'Nova',
  'Ethereal Sessions',
  'https://picsum.photos/400/400?random=' || i,
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-' || (i % 16 + 1) || '.mp3',
  180 + (i * 30),
  80 + i * 5,
  'Ambient',
  '{"Relax","Focus"}',
  3,
  true,
  (select id from public.djs where slug = 'nova')
from generate_series(1, 10) as i;

insert into public.tracks (title, artist, album, album_art_url, audio_url, duration, bpm, genre, mood_tags, energy_level, is_ai_generated, creator_id)
values 
  ('Neon Rain', 'Luna Voss', 'Digital Dreams', 'https://picsum.photos/400/400?random=100', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 245, 128, 'Electronica', '{"Energize","Focus"}', 7, false, (select id from public.creators where slug = 'luna-voss')),
  ('Glass Cathedral', 'Marcus Chen', 'Stillness', 'https://picsum.photos/400/400?random=101', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 312, 72, 'Neo-Classical', '{"Sleep","Relax"}', 2, false, (select id from public.creators where slug = 'marcus-chen'));
