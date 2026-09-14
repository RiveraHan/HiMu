alter table public.music_preferences
  add column atmosphere text not null default 'balanced'
  check (atmosphere in ('calm', 'balanced', 'intense'));
