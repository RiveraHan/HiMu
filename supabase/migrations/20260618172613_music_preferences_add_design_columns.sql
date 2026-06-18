
alter table public.music_preferences 
add column if not exists vibe_mapping jsonb 
default '{"organic_electronic":0.5,"melancholic_euphoric":0.5}'::jsonb,
add column if not exists ai_frequency text 
default 'optimal' check (ai_frequency in ('low','optimal','high')),
add column if not exists discovery_depth boolean default false;