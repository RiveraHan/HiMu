alter table public.djs
  add column identity_concept text
  check (
    identity_concept is null
    or (
      char_length(btrim(identity_concept)) between 10 and 240
      and identity_concept !~ '[[:cntrl:]]'
    )
  );

alter table public.generation_jobs
  add column generation_brief jsonb,
  add column source_track_id uuid references public.tracks(id) on delete set null;

alter table public.tracks
  add column source_track_id uuid references public.tracks(id) on delete set null;

create index generation_jobs_source_track_id_idx
  on public.generation_jobs (source_track_id)
  where source_track_id is not null;
create index tracks_source_track_id_idx
  on public.tracks (source_track_id)
  where source_track_id is not null;

create table public.track_private_details (
  track_id uuid primary key references public.tracks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  confirmed_lyrics text not null
    check (char_length(confirmed_lyrics) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index track_private_details_owner_id_idx
  on public.track_private_details (owner_id);

alter table public.track_private_details enable row level security;

create policy track_private_details_owner_select
on public.track_private_details
for select to authenticated
using (owner_id = (select auth.uid()));

revoke all on table public.track_private_details from public;
revoke all on table public.track_private_details from anon;
grant select on table public.track_private_details to authenticated;
grant all on table public.track_private_details to service_role;

create table public.creative_draft_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'dj-identity',
      'track-brief',
      'track-title',
      'lyrics',
      'creative-direction'
    )
  ),
  created_at timestamptz not null default now()
);

create index creative_draft_events_user_created_idx
  on public.creative_draft_events (user_id, created_at desc);

alter table public.creative_draft_events enable row level security;
revoke all on table public.creative_draft_events from public;
revoke all on table public.creative_draft_events from anon, authenticated;
grant select, insert, delete on table public.creative_draft_events to service_role;

create function public.prevent_accepted_brief_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.generation_brief is not null and (
    new.generation_brief is distinct from old.generation_brief
    or new.source_track_id is distinct from old.source_track_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'accepted_generation_brief_is_immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_accepted_brief_mutation()
  from public, anon, authenticated;

create trigger generation_jobs_prevent_accepted_brief_mutation
before update of generation_brief, source_track_id on public.generation_jobs
for each row execute function public.prevent_accepted_brief_mutation();

drop function if exists public.reserve_manual_generation_job(uuid, uuid, text);
drop function if exists public.reserve_manual_generation_job(uuid, uuid, text, boolean);

create function public.reserve_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_generation_brief jsonb,
  p_is_public boolean,
  p_source_track_id uuid
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
  queued_at timestamptz,
  is_public boolean,
  generation_brief jsonb,
  source_track_id uuid
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
  v_job_brief jsonb;
  v_job_source_track_id uuid;
  v_limit constant integer := 3;
begin
  if p_is_public is null then
    raise exception using errcode = '22004', message = 'p_is_public must not be null';
  end if;
  if p_generation_brief is null
    or pg_catalog.jsonb_typeof(p_generation_brief) <> 'object'
    or p_generation_brief->>'version' <> '1'
  then
    raise exception using errcode = '22023', message = 'invalid_generation_brief';
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

  select
    gj.id,
    gj.updated_at,
    gj.is_public,
    gj.generation_brief,
    gj.source_track_id
  into
    v_job_id,
    v_job_updated_at,
    v_job_is_public,
    v_job_brief,
    v_job_source_track_id
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
      v_job_is_public,
      v_job_brief,
      v_job_source_track_id;
    return;
  end if;

  if public.generation_quota_usage(p_user_id, v_now) >= v_limit then
    return query select
      'quota'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::boolean,
      null::jsonb,
      null::uuid;
    return;
  end if;

  begin
    insert into public.generation_jobs as gj (
      user_id,
      dj_id,
      prompt,
      generation_brief,
      source_track_id,
      status,
      is_public,
      created_at,
      updated_at
    ) values (
      p_user_id,
      p_dj_id,
      nullif(p_generation_brief->>'lyrics', ''),
      p_generation_brief,
      p_source_track_id,
      'queued',
      p_is_public,
      v_now,
      v_now
    )
    returning
      gj.id,
      gj.updated_at,
      gj.is_public,
      gj.generation_brief,
      gj.source_track_id
    into
      v_job_id,
      v_job_updated_at,
      v_job_is_public,
      v_job_brief,
      v_job_source_track_id;
  exception
    when unique_violation then
      select
        gj.id,
        gj.updated_at,
        gj.is_public,
        gj.generation_brief,
        gj.source_track_id
      into
        v_job_id,
        v_job_updated_at,
        v_job_is_public,
        v_job_brief,
        v_job_source_track_id
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
          v_job_is_public,
          v_job_brief,
          v_job_source_track_id;
        return;
      end if;
      raise;
  end;

  return query select
    'created'::text,
    v_job_id,
    v_limit,
    v_job_updated_at,
    v_job_is_public,
    v_job_brief,
    v_job_source_track_id;
end;
$$;

revoke all on function public.reserve_manual_generation_job(uuid, uuid, jsonb, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_manual_generation_job(uuid, uuid, jsonb, boolean, uuid)
  to service_role;

create function public.retry_legacy_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_job_id uuid
)
returns table (
  job_id uuid,
  queued_at timestamptz,
  is_public boolean,
  prompt text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260729,
    pg_catalog.hashtext(p_user_id::text)
  );

  if exists (
    select 1
    from public.generation_jobs as active
    where active.user_id = p_user_id
      and active.dj_id = p_dj_id
      and active.drop_date is null
      and active.status in ('queued', 'generating')
  ) then
    return;
  end if;

  return query
  update public.generation_jobs as gj
  set
    status = 'queued',
    error = null,
    updated_at = v_now
  where gj.id = p_job_id
    and gj.user_id = p_user_id
    and gj.dj_id = p_dj_id
    and gj.drop_date is null
    and gj.generation_brief is null
    and gj.status = 'failed'
  returning gj.id, gj.updated_at, gj.is_public, gj.prompt;
end;
$$;

revoke all on function public.retry_legacy_manual_generation_job(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_legacy_manual_generation_job(uuid, uuid, uuid)
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
      message = pg_catalog.format('generation job %s attempt is no longer active', p_job_id);
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
    source_track_id,
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
    gj.source_track_id,
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
      message = pg_catalog.format('generation job %s attempt is no longer active', p_job_id);
  end if;

  insert into public.track_private_details (
    track_id,
    owner_id,
    confirmed_lyrics,
    created_at
  )
  select
    p_track_id,
    gj.user_id,
    gj.generation_brief->>'lyrics',
    p_finished_at
  from public.generation_jobs as gj
  where gj.id = p_job_id
    and nullif(btrim(gj.generation_brief->>'lyrics'), '') is not null;

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
      message = pg_catalog.format('generation job %s attempt is no longer active', p_job_id);
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
