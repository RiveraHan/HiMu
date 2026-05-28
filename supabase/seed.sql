-- HiMu seed data
-- Runs after migrations on `supabase db reset`
-- DJs, creators, tracks, and dj_generation_configs are in the initial migration.
-- This file seeds: avatar URLs, playlists, playlist_tracks, communities, live_sessions.

-- ===========================
-- DJ & CREATOR AVATARS (dicebear placeholders)
-- ===========================

UPDATE public.djs SET avatar_url = 'https://api.dicebear.com/9.x/personas/png?seed=nova&size=128&backgroundColor=b6e3f4' WHERE slug = 'nova';
UPDATE public.djs SET avatar_url = 'https://api.dicebear.com/9.x/personas/png?seed=axon&size=128&backgroundColor=c0aede' WHERE slug = 'axon';
UPDATE public.djs SET avatar_url = 'https://api.dicebear.com/9.x/personas/png?seed=sage&size=128&backgroundColor=d1d4f9' WHERE slug = 'sage';

UPDATE public.creators SET avatar_url = 'https://api.dicebear.com/9.x/avataaars/png?seed=luna&size=128' WHERE slug = 'luna-voss';
UPDATE public.creators SET avatar_url = 'https://api.dicebear.com/9.x/avataaars/png?seed=marcus&size=128' WHERE slug = 'marcus-chen';

-- ===========================
-- PLAYLISTS (public, no user_id)
-- ===========================

INSERT INTO public.playlists (id, name, description, cover_url, is_public) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Late Night Drive', 'Ambient tracks for midnight cruising', 'https://picsum.photos/400/400?random=50', true),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Focus Flow', 'Lo-fi and ambient for deep work', 'https://picsum.photos/400/400?random=51', true),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Discovery Mix', 'Fresh picks across all genres', 'https://picsum.photos/400/400?random=52', true),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Chill Vibes', 'Relaxation and meditation', 'https://picsum.photos/400/400?random=53', true)
ON CONFLICT DO NOTHING;

-- ===========================
-- PLAYLIST TRACKS
-- ===========================

INSERT INTO public.playlist_tracks (playlist_id, track_id, position)
SELECT 'a1b2c3d4-0001-4000-8000-000000000001', id, row_number() OVER ()
FROM public.tracks WHERE title IN ('Midnight Drift 1', 'Midnight Drift 2', 'Midnight Drift 3', 'Midnight Drift 4', 'Glass Cathedral')
ON CONFLICT DO NOTHING;

INSERT INTO public.playlist_tracks (playlist_id, track_id, position)
SELECT 'a1b2c3d4-0002-4000-8000-000000000002', id, row_number() OVER ()
FROM public.tracks WHERE title IN ('Midnight Drift 5', 'Midnight Drift 6', 'Midnight Drift 7', 'Neon Rain')
ON CONFLICT DO NOTHING;

INSERT INTO public.playlist_tracks (playlist_id, track_id, position)
SELECT 'a1b2c3d4-0003-4000-8000-000000000003', id, row_number() OVER ()
FROM public.tracks WHERE title IN ('Midnight Drift 8', 'Midnight Drift 9', 'Midnight Drift 10', 'Neon Rain', 'Glass Cathedral', 'Midnight Drift 1')
ON CONFLICT DO NOTHING;

INSERT INTO public.playlist_tracks (playlist_id, track_id, position)
SELECT 'a1b2c3d4-0004-4000-8000-000000000004', id, row_number() OVER ()
FROM public.tracks WHERE title IN ('Glass Cathedral', 'Midnight Drift 3', 'Midnight Drift 4')
ON CONFLICT DO NOTHING;

-- ===========================
-- COMMUNITIES
-- ===========================

INSERT INTO public.communities (id, name, slug, description, cover_image, member_count) VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'Ambient Explorers', 'ambient-explorers', 'Discovering the depths of ambient and atmospheric music', 'https://picsum.photos/800/400?random=60', 128),
  ('b1b2c3d4-0002-4000-8000-000000000002', 'Beat Lab', 'beat-lab', 'Producers sharing beats, techniques, and collabs', 'https://picsum.photos/800/400?random=61', 256),
  ('b1b2c3d4-0003-4000-8000-000000000003', 'Classical Lounge', 'classical-lounge', 'Neo-classical, modern classical, and orchestral vibes', 'https://picsum.photos/800/400?random=62', 89)
ON CONFLICT DO NOTHING;

-- ===========================
-- LIVE SESSION (one active for Nova)
-- ===========================

INSERT INTO public.live_sessions (id, dj_id, title, description, status, started_at, listener_count)
SELECT
  'c1b2c3d4-0001-4000-8000-000000000001',
  id,
  'Midnight Ambient Session',
  'Late night ambient and lo-fi vibes with Nova',
  'live',
  now() - interval '45 minutes',
  23
FROM public.djs WHERE slug = 'nova'
ON CONFLICT DO NOTHING;
