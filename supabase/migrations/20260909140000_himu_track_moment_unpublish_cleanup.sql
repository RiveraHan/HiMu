-- A private visibility request can cancel a publishing claim after R2 has
-- copied its public object but before the claim finalizes. Preserve that
-- operation-owned object as durable cleanup before clearing its token.
create or replace function public.unpublish_track_moment(
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
  v_operation_public_key text;
  v_existing_cleanup_key text;
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
    if v_track.audio_url !~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\\.mp3$' then
      return query select 'invalid_media'::text, null::text, null::text, null::text;
      return;
    end if;

    select publication.* into v_publication
    from public.track_moment_publications as publication
    where publication.track_id = p_track_id
    for update;

    if found and v_publication.state = 'publishing' then
      -- Only the currently locked, owner-matching claim may enqueue cleanup.
      -- This branch cannot target a durable winner because the locked track is
      -- still private and a winner changes it to public in finalization.
      if v_publication.owner_id is distinct from p_user_id
        or v_publication.private_audio_ref is distinct from v_track.audio_url
        or v_publication.operation_token is null
      then
        return query select 'conflict'::text, null::text, null::text, null::text;
        return;
      end if;

      v_operation_public_key := pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          v_publication.private_audio_ref,
          '^r2-private://',
          ''
        ),
        '\\.mp3$',
        '.moment-' || v_publication.operation_token::text || '.mp3'
      );

      if v_operation_public_key !~ '^tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\\.mp3$'
        or pg_catalog.strpos(
          v_operation_public_key,
          '.moment-' || v_publication.operation_token::text || '.mp3'
        ) = 0
      then
        return query select 'conflict'::text, null::text, null::text, null::text;
        return;
      end if;

      -- A token names one immutable operation. Do not clear the publication
      -- if a corrupt/reused token already names a different cleanup target.
      select cleanup.public_object_key into v_existing_cleanup_key
      from public.track_moment_cleanup_outbox as cleanup
      where cleanup.track_id = p_track_id
        and cleanup.operation_token = v_publication.operation_token
      for update;

      if found and v_existing_cleanup_key is distinct from v_operation_public_key then
        return query select 'conflict'::text, null::text, null::text, null::text;
        return;
      end if;

      insert into public.track_moment_cleanup_outbox (
        track_id, operation_token, owner_id, public_object_key
      ) values (
        p_track_id,
        v_publication.operation_token,
        p_user_id,
        v_operation_public_key
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
        and publication.operation_token = v_publication.operation_token;

      return query select 'already_private'::text, v_track.audio_url, null::text, null::text;
      return;
    elsif found and v_publication.state = 'private' then
      return query select
        'already_private'::text,
        v_track.audio_url,
        v_publication.public_audio_url,
        v_publication.public_object_key;
      return;
    elsif found then
      return query select 'conflict'::text, null::text, null::text, null::text;
      return;
    end if;

    return query select 'already_private'::text, v_track.audio_url, null::text, null::text;
    return;
  end if;

  select publication.* into v_publication
  from public.track_moment_publications as publication
  where publication.track_id = p_track_id
  for update;

  if not found
    or v_publication.owner_id is distinct from p_user_id
    or v_publication.state <> 'public'
    or v_publication.private_audio_ref !~ '^r2-private://tracks/generated/[A-Za-z0-9._%:-]+/[A-Za-z0-9._%:-]+\\.mp3$'
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

revoke all on function public.unpublish_track_moment(uuid,uuid)
from public, anon, authenticated;
grant execute on function public.unpublish_track_moment(uuid,uuid)
to service_role;
