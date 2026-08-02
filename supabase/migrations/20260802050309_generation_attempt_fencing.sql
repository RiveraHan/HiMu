drop function if exists public.finalize_generated_mix(
  uuid, uuid, text, text, text, text, text, text[], integer, uuid, text, text,
  timestamptz
);

create function public.finalize_generated_mix(
  p_job_id uuid,
  p_track_id uuid,
  p_title text,
  p_artist text,
  p_audio_url text,
  p_album_art_url text,
  p_genre text,
  p_mood_tags text[],
  p_duration integer,
  p_dj_id uuid,
  p_caption text,
  p_caption_audio_url text,
  p_started_at timestamptz,
  p_finished_at timestamptz
)
returns table (track_id uuid, track_title text, job_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  insert into public.tracks (
    id, title, artist, audio_url, album_art_url, genre, mood_tags, duration,
    is_ai_generated, dj_id, created_at
  )
  values (
    p_track_id, p_title, p_artist, p_audio_url, p_album_art_url, p_genre,
    p_mood_tags, p_duration, true, p_dj_id, p_finished_at
  );

  update public.generation_jobs as gj
  set
    status = 'ready',
    track_id = p_track_id,
    caption = p_caption,
    caption_audio_url = p_caption_audio_url,
    error = null,
    updated_at = p_finished_at
  where gj.id = p_job_id
    and gj.dj_id = p_dj_id
    and gj.status = 'generating'
    and gj.updated_at = p_started_at;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'generation job %s attempt is no longer active',
        p_job_id
      );
  end if;

  return query select p_track_id, p_title, p_job_id;
end;
$$;

revoke all on function public.finalize_generated_mix(
  uuid, uuid, text, text, text, text, text, text[], integer, uuid, text, text,
  timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.finalize_generated_mix(
  uuid, uuid, text, text, text, text, text, text[], integer, uuid, text, text,
  timestamptz, timestamptz
) to service_role;
