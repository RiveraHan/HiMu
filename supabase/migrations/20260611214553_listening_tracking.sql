-- Function to record listening stats for the current user
create or replace function public.record_listening_stats(
p_minutes int,
p_tracks int,
p_top_genre text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    insert into public.listening_stats (user_id, date, minutes_listened, tracks_played, top_genre)
    values (auth.uid(), current_date, p_minutes, p_tracks, p_top_genre)
    on conflict (user_id, date) do update set
    minutes_listened = coalesce(listening_stats.minutes_listened, 0) + excluded.minutes_listened,
    tracks_played = coalesce(listening_stats.tracks_played, 0) + excluded.tracks_played,
    top_genre = coalesce(excluded.top_genre, listening_stats.top_genre);
end;
$$;
