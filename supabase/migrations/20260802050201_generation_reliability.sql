update public.generation_jobs
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now())
where created_at is null or updated_at is null;

alter table public.generation_jobs
  alter column created_at type timestamptz
    using created_at at time zone 'UTC',
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at type timestamptz
    using updated_at at time zone 'UTC',
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from public.generation_jobs
    where drop_date is null
      and status in ('queued', 'generating')
    group by user_id, dj_id
    having count(*) > 1
  ) then
    raise exception
      'duplicate active manual generation jobs exist; reconcile them before applying this migration';
  end if;
end
$$;

create unique index generation_jobs_one_active_manual_per_dj_idx
  on public.generation_jobs (user_id, dj_id)
  where drop_date is null
    and status in ('queued', 'generating');

alter table public.cover_regens
  add column status text not null default 'completed',
  add column completed_at timestamptz default now(),
  add column updated_at timestamptz not null default now();

update public.cover_regens
set completed_at = created_at, updated_at = created_at;

alter table public.cover_regens
  add constraint cover_regens_status_check
    check (status in ('reserved', 'completed', 'failed')),
  add constraint cover_regens_completion_check
    check ((status = 'completed') = (completed_at is not null));

create index cover_regens_user_completed_at_idx
  on public.cover_regens (user_id, completed_at)
  where status = 'completed';

create or replace function public.generation_quota_usage(
  p_user_id uuid,
  p_at timestamptz
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select (
    (
      select count(*)
      from public.generation_jobs as gj
      where gj.user_id = p_user_id
        and gj.drop_date is null
        and gj.status <> 'failed'
        and gj.created_at > p_at - interval '24 hours'
    )
    +
    (
      select count(*)
      from public.cover_regens as cr
      where cr.user_id = p_user_id
        and (
          (
            cr.status = 'reserved'
            and cr.created_at > p_at - interval '24 hours'
          )
          or
          (
            cr.status = 'completed'
            and cr.completed_at > p_at - interval '24 hours'
          )
        )
    )
  )::integer;
$$;

create or replace function public.reserve_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_prompt text
)
returns table (outcome text, job_id uuid, daily_limit integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_job_id uuid;
  v_limit constant integer := 10;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260729,
    pg_catalog.hashtext(p_user_id::text)
  );

  update public.cover_regens as cr
  set status = 'failed', completed_at = null, updated_at = v_now
  where cr.user_id = p_user_id
    and cr.status = 'reserved'
    and cr.updated_at < v_now - interval '15 minutes';

  select gj.id
  into v_job_id
  from public.generation_jobs as gj
  where gj.user_id = p_user_id
    and gj.dj_id = p_dj_id
    and gj.drop_date is null
    and gj.status in ('queued', 'generating')
  order by gj.created_at asc
  limit 1;

  if found then
    return query select 'existing'::text, v_job_id, v_limit;
    return;
  end if;

  if public.generation_quota_usage(p_user_id, v_now) >= v_limit then
    return query select 'quota'::text, null::uuid, v_limit;
    return;
  end if;

  begin
    insert into public.generation_jobs (
      user_id, dj_id, prompt, status, created_at, updated_at
    )
    values (p_user_id, p_dj_id, p_prompt, 'queued', v_now, v_now)
    returning id into v_job_id;
  exception
    when unique_violation then
      select gj.id
      into v_job_id
      from public.generation_jobs as gj
      where gj.user_id = p_user_id
        and gj.dj_id = p_dj_id
        and gj.drop_date is null
        and gj.status in ('queued', 'generating')
      order by gj.created_at asc
      limit 1;

      if found then
        return query select 'existing'::text, v_job_id, v_limit;
        return;
      end if;
      raise;
  end;

  return query select 'created'::text, v_job_id, v_limit;
end;
$$;

create or replace function public.reserve_cover_generation(
  p_user_id uuid,
  p_track_id uuid
)
returns table (outcome text, reservation_id uuid, daily_limit integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation_id uuid;
  v_limit constant integer := 10;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260729,
    pg_catalog.hashtext(p_user_id::text)
  );

  update public.cover_regens as cr
  set status = 'failed', completed_at = null, updated_at = v_now
  where cr.user_id = p_user_id
    and cr.status = 'reserved'
    and cr.updated_at < v_now - interval '15 minutes';

  if public.generation_quota_usage(p_user_id, v_now) >= v_limit then
    return query select 'quota'::text, null::uuid, v_limit;
    return;
  end if;

  insert into public.cover_regens (
    user_id, track_id, status, completed_at, created_at, updated_at
  )
  values (p_user_id, p_track_id, 'reserved', null, v_now, v_now)
  returning id into v_reservation_id;

  return query select 'reserved'::text, v_reservation_id, v_limit;
end;
$$;

create or replace function public.finalize_generated_mix(
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
    and gj.status = 'generating';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'generation job %s is no longer active',
        p_job_id
      );
  end if;

  return query select p_track_id, p_title, p_job_id;
end;
$$;

create or replace function public.finalize_cover_regeneration(
  p_reservation_id uuid,
  p_user_id uuid,
  p_track_id uuid,
  p_album_art_url text,
  p_finished_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
  v_old_album_art_url text;
begin
  update public.cover_regens as cr
  set
    status = 'completed',
    completed_at = p_finished_at,
    updated_at = p_finished_at
  where cr.id = p_reservation_id
    and cr.user_id = p_user_id
    and cr.track_id = p_track_id
    and cr.status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'cover reservation %s is no longer active',
        p_reservation_id
      );
  end if;

  select t.album_art_url
  into v_old_album_art_url
  from public.tracks as t
  where t.id = p_track_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = pg_catalog.format('track %s does not exist', p_track_id);
  end if;

  update public.tracks as t
  set album_art_url = p_album_art_url
  where t.id = p_track_id;

  return v_old_album_art_url;
end;
$$;

create or replace function public.fail_cover_generation_reservation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_failed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.cover_regens as cr
  set status = 'failed', completed_at = null, updated_at = p_failed_at
  where cr.id = p_reservation_id
    and cr.user_id = p_user_id
    and cr.status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.generation_quota_usage(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reserve_manual_generation_job(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reserve_cover_generation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_generated_mix(
  uuid, uuid, text, text, text, text, text, text[], integer, uuid, text, text,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.finalize_cover_regeneration(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_cover_generation_reservation(
  uuid, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.generation_quota_usage(uuid, timestamptz)
  to service_role;
grant execute on function public.reserve_manual_generation_job(uuid, uuid, text)
  to service_role;
grant execute on function public.reserve_cover_generation(uuid, uuid)
  to service_role;
grant execute on function public.finalize_generated_mix(
  uuid, uuid, text, text, text, text, text, text[], integer, uuid, text, text,
  timestamptz
) to service_role;
grant execute on function public.finalize_cover_regeneration(
  uuid, uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.fail_cover_generation_reservation(
  uuid, uuid, timestamptz
) to service_role;
