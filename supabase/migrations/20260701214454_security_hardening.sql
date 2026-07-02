
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "DJ configs viewable by everyone" on public.dj_generation_configs;

create policy "Users can delete own playlists" on public.playlists
  for delete using (auth.uid() = user_id);

create policy "Users can delete own posts" on public.posts
  for delete using (auth.uid() = user_id);

create policy "Users can delete own stats" on public.listening_stats
  for delete using (auth.uid() = user_id);

create policy "Users can delete own preferences" on public.music_preferences
  for delete using (auth.uid() = user_id);

create policy "Users can delete own interactions" on public.dj_interactions
  for delete using (auth.uid() = user_id);