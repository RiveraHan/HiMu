create table public.track_experience_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  surprised boolean,
  would_share boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id),
  constraint track_experience_feedback_has_answer
    check (surprised is not null or would_share is not null)
);

create function public.maintain_track_experience_feedback()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.track_id is distinct from old.track_id
  then
    raise exception using
      errcode = '55000',
      message = 'feedback_identity_immutable';
  end if;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.greatest(
    pg_catalog.clock_timestamp(),
    old.updated_at
  );
  return new;
end;
$$;

revoke all on function public.maintain_track_experience_feedback()
from public, anon, authenticated;

create trigger track_experience_feedback_maintain
before update on public.track_experience_feedback
for each row execute function public.maintain_track_experience_feedback();

alter table public.track_experience_feedback enable row level security;

create policy track_experience_feedback_owner_select
on public.track_experience_feedback
for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.tracks as track
    where track.id = track_experience_feedback.track_id
      and track.owner_id = (select auth.uid())
  )
);

create policy track_experience_feedback_owner_insert
on public.track_experience_feedback
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.tracks as track
    where track.id = track_experience_feedback.track_id
      and track.owner_id = (select auth.uid())
  )
);

create policy track_experience_feedback_owner_update
on public.track_experience_feedback
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.tracks as track
    where track.id = track_experience_feedback.track_id
      and track.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.tracks as track
    where track.id = track_experience_feedback.track_id
      and track.owner_id = (select auth.uid())
  )
);

revoke all on table public.track_experience_feedback from public;
revoke all on table public.track_experience_feedback from anon, authenticated;
grant select, insert, update on table public.track_experience_feedback
to authenticated;
grant select, insert, update, delete on table public.track_experience_feedback
to service_role;

-- Server-only state preserves the private source and serializes external R2 work.
-- Each claim gets a unique public object key, so a stale operation can compensate
-- only the object it created and can never delete a concurrent winner's object.
create table public.track_moment_publications (
  track_id uuid primary key references public.tracks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  private_audio_ref text not null,
  public_audio_url text,
  public_object_key text,
  state text not null check (state in ('private', 'publishing', 'public')),
  operation_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_moment_private_audio_ref
    check (private_audio_ref ~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'),
  constraint track_moment_public_pair
    check ((public_audio_url is null) = (public_object_key is null)),
  constraint track_moment_public_reference
    check (
      public_audio_url is null
      or (
        public_audio_url ~ '^https://'
        and public_audio_url = btrim(public_audio_url)
        and public_audio_url !~ '[[:cntrl:]]'
        and public_object_key ~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
      )
    ),
  constraint track_moment_public_state
    check (state <> 'public' or public_audio_url is not null),
  constraint track_moment_operation_state
    check (
      (state = 'publishing' and operation_token is not null)
      or (state <> 'publishing' and operation_token is null)
    )
);

alter table public.track_moment_publications enable row level security;
revoke all on table public.track_moment_publications from public;
revoke all on table public.track_moment_publications from anon, authenticated;
grant select, insert, update, delete on table public.track_moment_publications
to service_role;

create function public.claim_track_moment_publish(
  p_track_id uuid,
  p_user_id uuid,
  p_operation_token uuid,
  p_private_audio_ref text
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_publication public.track_moment_publications%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_track_id is null or p_user_id is null or p_operation_token is null then
    return query select 'invalid'::text;
    return;
  end if;

  select track.* into v_track
  from public.tracks as track
  where track.id = p_track_id
  for update;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;
  if v_track.owner_id is distinct from p_user_id then
    return query select 'not_owner'::text;
    return;
  end if;
  if v_track.is_ai_generated is distinct from true
    or not exists (
      select 1 from public.generation_jobs as job
      where job.track_id = p_track_id
        and job.user_id = p_user_id
        and job.status = 'ready'
    )
  then
    return query select 'ineligible'::text;
    return;
  end if;
  if v_track.is_public then
    return query select 'already_public'::text;
    return;
  end if;
  if v_track.audio_url is distinct from p_private_audio_ref
    or p_private_audio_ref !~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
  then
    return query select 'invalid_media'::text;
    return;
  end if;

  select publication.* into v_publication
  from public.track_moment_publications as publication
  where publication.track_id = p_track_id
  for update;

  if found and v_publication.state = 'publishing'
    and v_publication.updated_at >= v_now - interval '5 minutes'
  then
    return query select 'busy'::text;
    return;
  end if;
  if found and v_publication.state = 'public' then
    return query select 'invalid_state'::text;
    return;
  end if;

  insert into public.track_moment_publications (
    track_id, owner_id, private_audio_ref, state, operation_token,
    public_audio_url, public_object_key, updated_at
  ) values (
    p_track_id, p_user_id, p_private_audio_ref, 'publishing', p_operation_token,
    null, null, v_now
  )
  on conflict (track_id) do update set
    owner_id = excluded.owner_id,
    private_audio_ref = excluded.private_audio_ref,
    state = excluded.state,
    operation_token = excluded.operation_token,
    public_audio_url = null,
    public_object_key = null,
    updated_at = excluded.updated_at;

  return query select 'claimed'::text;
end;
$$;

create function public.finalize_track_moment_publish(
  p_track_id uuid,
  p_user_id uuid,
  p_operation_token uuid,
  p_public_audio_url text,
  p_public_object_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_publication public.track_moment_publications%rowtype;
begin
  select track.* into v_track
  from public.tracks as track
  where track.id = p_track_id
  for update;

  select publication.* into v_publication
  from public.track_moment_publications as publication
  where publication.track_id = p_track_id
  for update;

  if v_track.id is null
    or v_publication.track_id is null
    or v_track.owner_id is distinct from p_user_id
    or v_track.is_public
    or v_track.audio_url is distinct from v_publication.private_audio_ref
    or v_publication.owner_id is distinct from p_user_id
    or v_publication.state <> 'publishing'
    or v_publication.operation_token is distinct from p_operation_token
    or p_public_audio_url is null
    or p_public_object_key is null
    or p_public_audio_url !~ '^https://'
    or p_public_audio_url <> pg_catalog.btrim(p_public_audio_url)
    or p_public_audio_url ~ '[[:cntrl:]]'
    or p_public_object_key !~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
    or pg_catalog.strpos(p_public_object_key, '.moment-' || p_operation_token::text || '.mp3') = 0
    or not exists (
      select 1 from public.generation_jobs as job
      where job.track_id = p_track_id
        and job.user_id = p_user_id
        and job.status = 'ready'
    )
  then
    return false;
  end if;

  update public.tracks
  set audio_url = p_public_audio_url, is_public = true
  where id = p_track_id;

  update public.track_moment_publications
  set
    state = 'public',
    operation_token = null,
    public_audio_url = p_public_audio_url,
    public_object_key = p_public_object_key,
    updated_at = pg_catalog.clock_timestamp()
  where track_id = p_track_id;

  return true;
end;
$$;

create function public.abort_track_moment_publish(
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
  v_updated integer;
begin
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
    and publication.operation_token = p_operation_token
    and exists (
      select 1 from public.tracks as track
      where track.id = publication.track_id
        and track.owner_id = p_user_id
        and track.is_public = false
        and track.audio_url = publication.private_audio_ref
    );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create function public.unpublish_track_moment(
  p_track_id uuid,
  p_user_id uuid
)
returns table (
  outcome text,
  private_audio_ref text,
  public_audio_url text,
  public_object_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_publication public.track_moment_publications%rowtype;
begin
  select track.* into v_track
  from public.tracks as track
  where track.id = p_track_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text;
    return;
  end if;
  if v_track.owner_id is distinct from p_user_id then
    return query select 'not_owner'::text, null::text, null::text, null::text;
    return;
  end if;
  if v_track.is_ai_generated is distinct from true
    or not exists (
      select 1 from public.generation_jobs as job
      where job.track_id = p_track_id
        and job.user_id = p_user_id
        and job.status = 'ready'
    )
  then
    return query select 'ineligible'::text, null::text, null::text, null::text;
    return;
  end if;
  if not v_track.is_public then
    if v_track.audio_url ~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$' then
      select publication.* into v_publication
      from public.track_moment_publications as publication
      where publication.track_id = p_track_id
      for update;
      if found and v_publication.state = 'publishing' then
        update public.track_moment_publications as publication
        set
          state = 'private',
          operation_token = null,
          public_audio_url = null,
          public_object_key = null,
          updated_at = pg_catalog.clock_timestamp()
        where publication.track_id = p_track_id
          and publication.owner_id = p_user_id
          and publication.state = 'publishing';
        return query select 'already_private'::text, v_track.audio_url, null::text, null::text;
      elsif found and v_publication.state = 'private' then
        return query select
          'already_private'::text,
          v_track.audio_url,
          v_publication.public_audio_url,
          v_publication.public_object_key;
      elsif found then
        return query select 'conflict'::text, null::text, null::text, null::text;
      else
        return query select 'already_private'::text, v_track.audio_url, null::text, null::text;
      end if;
    else
      return query select 'invalid_media'::text, null::text, null::text, null::text;
    end if;
    return;
  end if;

  select publication.* into v_publication
  from public.track_moment_publications as publication
  where publication.track_id = p_track_id
  for update;

  if not found
    or v_publication.owner_id is distinct from p_user_id
    or v_publication.state <> 'public'
    or v_publication.private_audio_ref !~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\.mp3$'
    or v_publication.public_audio_url is distinct from v_track.audio_url
    or v_publication.public_object_key is null
  then
    return query select 'legacy_unsafe'::text, null::text, null::text, null::text;
    return;
  end if;

  update public.tracks
  set audio_url = v_publication.private_audio_ref, is_public = false
  where id = p_track_id;

  update public.track_moment_publications
  set state = 'private', operation_token = null,
      updated_at = pg_catalog.clock_timestamp()
  where track_id = p_track_id;

  return query select
    'unpublished'::text,
    v_publication.private_audio_ref,
    v_publication.public_audio_url,
    v_publication.public_object_key;
end;
$$;

revoke all on function public.claim_track_moment_publish(uuid,uuid,uuid,text)
from public, anon, authenticated;
revoke all on function public.finalize_track_moment_publish(uuid,uuid,uuid,text,text)
from public, anon, authenticated;
revoke all on function public.abort_track_moment_publish(uuid,uuid,uuid)
from public, anon, authenticated;
revoke all on function public.unpublish_track_moment(uuid,uuid)
from public, anon, authenticated;

grant execute on function public.claim_track_moment_publish(uuid,uuid,uuid,text)
to service_role;
grant execute on function public.finalize_track_moment_publish(uuid,uuid,uuid,text,text)
to service_role;
grant execute on function public.abort_track_moment_publish(uuid,uuid,uuid)
to service_role;
grant execute on function public.unpublish_track_moment(uuid,uuid)
to service_role;
