revoke execute on function public.sync_public_profile() from public, anon, authenticated;

update public.djs set
  genre_specialties = array['Techno','House','Deep House'],
  mood_tags = array['Energetic','Workout','Party']
where slug = 'axon' and owner_id is null;

update public.djs set genre_specialties = array['Classical','Ambient','Piano']
where slug = 'sage' and owner_id is null;

update public.tracks set mood_tags = array_replace(mood_tags, 'Energize', 'Energetic')
where 'Energize' = any(mood_tags);