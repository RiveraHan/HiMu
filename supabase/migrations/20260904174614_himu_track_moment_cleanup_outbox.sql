-- A copied Moment object is public before publication finalizes. Keep any
-- compensation target separate from the current publication row so a later
-- claim can never overwrite an unresolved, operation-owned cleanup target.
create table public.track_moment_cleanup_outbox (
  track_id uuid not null references public.tracks(id) on delete cascade,
  operation_token uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_object_key text not null,
  cleanup_state text not null default 'pending' check (cleanup_state = 'pending'),
  cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (track_id, operation_token),
  constraint track_moment_cleanup_key_format
    check (public_object_key ~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'),
  constraint track_moment_cleanup_key_operation
    check (pg_catalog.strpos(
      public_object_key,
      '.moment-' || operation_token::text || '.mp3'
    ) > 0)
);

alter table public.track_moment_cleanup_outbox enable row level security;
revoke all on table public.track_moment_cleanup_outbox from public;
revoke all on table public.track_moment_cleanup_outbox from anon, authenticated;
grant select, insert, update, delete on table public.track_moment_cleanup_outbox
to service_role;

create function public.queue_track_moment_cleanup(
  p_track_id uuid,
  p_user_id uuid,
  p_operation_token uuid,
  p_public_object_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_existing_key text;
begin
  if p_track_id is null or p_user_id is null or p_operation_token is null
    or p_public_object_key is null
    or p_public_object_key !~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
    or pg_catalog.strpos(
      p_public_object_key,
      '.moment-' || p_operation_token::text || '.mp3'
    ) = 0
  then
    return false;
  end if;

  select track.* into v_track
  from public.tracks as track
  where track.id = p_track_id
  for update;

  if not found or v_track.owner_id is distinct from p_user_id
    or v_track.is_ai_generated is distinct from true
    or not exists (
      select 1 from public.generation_jobs as job
      where job.track_id = p_track_id
        and job.user_id = p_user_id
        and job.status = 'ready'
    )
  then
    return false;
  end if;

  -- If this exact operation is already the durable public winner, its object
  -- is no longer compensation. A different winner is safe: operation keys
  -- are unique, so retaining this old key cannot target that winner.
  if v_track.is_public
    and pg_catalog.right(
      v_track.audio_url,
      pg_catalog.length(p_public_object_key) + 1
    ) = '/' || p_public_object_key
  then
    return false;
  end if;

  insert into public.track_moment_cleanup_outbox (
    track_id, operation_token, owner_id, public_object_key
  ) values (
    p_track_id, p_operation_token, p_user_id, p_public_object_key
  ) on conflict (track_id, operation_token) do nothing;

  select cleanup.public_object_key into v_existing_key
  from public.track_moment_cleanup_outbox as cleanup
  where cleanup.track_id = p_track_id
    and cleanup.operation_token = p_operation_token;

  -- A token names one immutable operation. Never replace its target, even
  -- under a retry or stale transition.
  return v_existing_key is not distinct from p_public_object_key;
end;
$$;

create function public.list_track_moment_cleanup(
  p_track_id uuid,
  p_user_id uuid
)
returns table (operation_token uuid, public_object_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select cleanup.operation_token, cleanup.public_object_key
  from public.track_moment_cleanup_outbox as cleanup
  join public.tracks as track on track.id = cleanup.track_id
  where cleanup.track_id = p_track_id
    and cleanup.owner_id = p_user_id
    and track.owner_id = p_user_id
  order by cleanup.created_at asc;
end;
$$;

create function public.acknowledge_track_moment_cleanup(
  p_track_id uuid,
  p_user_id uuid,
  p_operation_token uuid,
  p_public_object_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.track_moment_cleanup_outbox as cleanup
  using public.tracks as track
  where cleanup.track_id = p_track_id
    and cleanup.operation_token = p_operation_token
    and cleanup.owner_id = p_user_id
    and cleanup.public_object_key = p_public_object_key
    and track.id = cleanup.track_id
    and track.owner_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

-- Replacing the original function keeps its signature/grants intact while
-- making the state transition and its exact cleanup target one transaction.
create or replace function public.abort_track_moment_publish(
  p_track_id uuid,
  p_user_id uuid,
  p_operation_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.track_moment_publications%rowtype;
  v_public_object_key text;
  v_updated integer;
begin
  select publication.* into v_publication
  from public.track_moment_publications as publication
  where publication.track_id = p_track_id
  for update;

  if not found
    or v_publication.owner_id is distinct from p_user_id
    or v_publication.state <> 'publishing'
    or v_publication.operation_token is distinct from p_operation_token
    or not exists (
      select 1 from public.tracks as track
      where track.id = v_publication.track_id
        and track.owner_id = p_user_id
        and track.is_public = false
        and track.audio_url = v_publication.private_audio_ref
    )
  then
    return false;
  end if;

  v_public_object_key := pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(
      v_publication.private_audio_ref,
      '^r2-private://',
      ''
    ),
    '\.mp3$',
    '.moment-' || p_operation_token::text || '.mp3'
  );

  if v_public_object_key !~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
    or pg_catalog.strpos(
      v_public_object_key,
      '.moment-' || p_operation_token::text || '.mp3'
    ) = 0
  then
    return false;
  end if;

  insert into public.track_moment_cleanup_outbox (
    track_id, operation_token, owner_id, public_object_key
  ) values (
    p_track_id, p_operation_token, p_user_id, v_public_object_key
  ) on conflict (track_id, operation_token) do nothing;

  update public.track_moment_publications as publication
  set
    state = 'private',
    operation_token = null,
    public_audio_url = null,
    public_object_key = null,
    updated_at = pg_catalog.clock_timestamp()
  where publication.track_id = p_track_id
    and publication.owner_id = p_user_id
    and publication.state = 'publishing'
    and publication.operation_token = p_operation_token;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.queue_track_moment_cleanup(uuid,uuid,uuid,text)
from public, anon, authenticated;
revoke all on function public.list_track_moment_cleanup(uuid,uuid)
from public, anon, authenticated;
revoke all on function public.acknowledge_track_moment_cleanup(uuid,uuid,uuid,text)
from public, anon, authenticated;

grant execute on function public.queue_track_moment_cleanup(uuid,uuid,uuid,text)
to service_role;
grant execute on function public.list_track_moment_cleanup(uuid,uuid)
to service_role;
grant execute on function public.acknowledge_track_moment_cleanup(uuid,uuid,uuid,text)
to service_role;
