alter table public.tracks
  add column owner_id uuid references auth.users(id) on delete cascade,
  add column is_public boolean not null default false;

alter table public.generation_jobs
  add column is_public boolean not null default false;

update public.tracks as t
set owner_id = gj.user_id, is_public = false
from public.generation_jobs as gj
where gj.track_id = t.id;

update public.tracks as t
set owner_id = d.owner_id, is_public = false
from public.djs as d
where t.dj_id = d.id
  and d.owner_id is not null
  and t.owner_id is null;

update public.tracks
set is_public = true
where owner_id is null;

create index tracks_owner_id_idx on public.tracks (owner_id);
create index tracks_is_public_idx on public.tracks (is_public)
  where is_public;

alter table public.tracks enable row level security;
drop policy if exists "tracks_select_visible" on public.tracks;
create policy "tracks_select_visible" on public.tracks for select
to anon, authenticated
using (is_public or owner_id = (select auth.uid()));

create function public.enforce_one_owned_dj()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    20260802,
    pg_catalog.hashtext(new.owner_id::text)
  );

  if exists (
    select 1
    from public.djs as d
    where d.owner_id = new.owner_id
      and d.id is distinct from new.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'dj_quota_reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_one_owned_dj()
  from public, anon, authenticated;

create trigger djs_enforce_one_owned_dj
before insert or update of owner_id on public.djs
for each row execute function public.enforce_one_owned_dj();

create function public.reserve_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_prompt text,
  p_is_public boolean
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
  queued_at timestamptz,
  is_public boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_job_id uuid;
  v_job_updated_at timestamptz;
  v_job_is_public boolean;
  v_limit constant integer := 3;
begin
  if p_is_public is null then
    raise exception using
      errcode = '22004',
      message = 'p_is_public must not be null';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    20260729,
    pg_catalog.hashtext(p_user_id::text)
  );

  update public.cover_regens as cr
  set status = 'failed', completed_at = null, updated_at = v_now
  where cr.user_id = p_user_id
    and cr.status = 'reserved'
    and cr.updated_at < v_now - interval '15 minutes';

  select gj.id, gj.updated_at, gj.is_public
  into v_job_id, v_job_updated_at, v_job_is_public
  from public.generation_jobs as gj
  where gj.user_id = p_user_id
    and gj.dj_id = p_dj_id
    and gj.drop_date is null
    and gj.status in ('queued', 'generating')
  order by gj.created_at asc
  limit 1;

  if found then
    return query select
      'existing'::text,
      v_job_id,
      v_limit,
      v_job_updated_at,
      v_job_is_public;
    return;
  end if;

  if public.generation_quota_usage(p_user_id, v_now) >= v_limit then
    return query select
      'quota'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::boolean;
    return;
  end if;

  begin
    insert into public.generation_jobs as gj (
      user_id,
      dj_id,
      prompt,
      status,
      is_public,
      created_at,
      updated_at
    )
    values (
      p_user_id,
      p_dj_id,
      p_prompt,
      'queued',
      p_is_public,
      v_now,
      v_now
    )
    returning gj.id, gj.updated_at, gj.is_public
    into v_job_id, v_job_updated_at, v_job_is_public;
  exception
    when unique_violation then
      select gj.id, gj.updated_at, gj.is_public
      into v_job_id, v_job_updated_at, v_job_is_public
      from public.generation_jobs as gj
      where gj.user_id = p_user_id
        and gj.dj_id = p_dj_id
        and gj.drop_date is null
        and gj.status in ('queued', 'generating')
      order by gj.created_at asc
      limit 1;

      if found then
        return query select
          'existing'::text,
          v_job_id,
          v_limit,
          v_job_updated_at,
          v_job_is_public;
        return;
      end if;
      raise;
  end;

  return query select
    'created'::text,
    v_job_id,
    v_limit,
    v_job_updated_at,
    v_job_is_public;
end;
$$;

revoke all on function public.reserve_manual_generation_job(
  uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.reserve_manual_generation_job(
  uuid, uuid, text, boolean
) to service_role;

create or replace function public.reserve_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_prompt text
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
  queued_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    reservation.outcome,
    reservation.job_id,
    reservation.daily_limit,
    reservation.queued_at
  from public.reserve_manual_generation_job(
    p_user_id,
    p_dj_id,
    p_prompt,
    false
  ) as reservation;
$$;

revoke all on function public.reserve_manual_generation_job(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_manual_generation_job(uuid, uuid, text)
  to service_role;

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
  v_limit constant integer := 3;
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

revoke all on function public.reserve_cover_generation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_cover_generation(uuid, uuid)
  to service_role;

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
  p_started_at timestamptz,
  p_finished_at timestamptz
)
returns table (track_id uuid, track_title text, job_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted integer;
  v_updated integer;
begin
  perform gj.id
  from public.generation_jobs as gj
  where gj.id = p_job_id
    and gj.dj_id = p_dj_id
    and gj.status = 'generating'
    and gj.updated_at = p_started_at
  for update;

  if not found then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'generation job %s attempt is no longer active',
        p_job_id
      );
  end if;

  insert into public.tracks (
    id,
    title,
    artist,
    audio_url,
    album_art_url,
    genre,
    mood_tags,
    duration,
    is_ai_generated,
    dj_id,
    owner_id,
    is_public,
    created_at
  )
  select
    p_track_id,
    p_title,
    p_artist,
    p_audio_url,
    p_album_art_url,
    p_genre,
    p_mood_tags,
    p_duration,
    true,
    p_dj_id,
    gj.user_id,
    gj.is_public,
    p_finished_at
  from public.generation_jobs as gj
  where gj.id = p_job_id
    and gj.dj_id = p_dj_id
    and gj.status = 'generating'
    and gj.updated_at = p_started_at;

  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then
    raise exception using
      errcode = '55000',
      message = pg_catalog.format(
        'generation job %s attempt is no longer active',
        p_job_id
      );
  end if;

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
