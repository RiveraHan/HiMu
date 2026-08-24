-- Accept richer production plans while preserving every reservation, quota,
-- lease, immutability, and privilege invariant of the remediated RPC.
create or replace function public.reserve_manual_generation_job(
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
  v_usage_outcome text;
  v_limit constant integer := 3;
begin
  if p_is_public is null then
    raise exception using errcode = '22004', message = 'p_is_public must not be null';
  end if;
  if p_generation_brief is null
    or pg_catalog.jsonb_typeof(p_generation_brief) <> 'object'
    or p_generation_brief->>'version' not in ('1', '2')
  then
    raise exception using errcode = '22023', message = 'invalid_generation_brief';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext('generation')
  );

  update public.cover_regens as cover
  set status = 'failed', completed_at = null, updated_at = v_now
  where cover.user_id = p_user_id
    and cover.status = 'reserved'
    and cover.updated_at < v_now - interval '15 minutes';

  select
    job.id,
    job.updated_at,
    job.is_public,
    job.generation_brief,
    job.source_track_id
  into
    v_job_id,
    v_job_updated_at,
    v_job_is_public,
    v_job_brief,
    v_job_source_track_id
  from public.generation_jobs as job
  where job.user_id = p_user_id
    and job.dj_id = p_dj_id
    and job.drop_date is null
    and job.status in ('queued', 'generating')
  order by job.created_at asc
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

  v_job_id := gen_random_uuid();
  select reservation.outcome
  into v_usage_outcome
  from public.reserve_provider_usage_event(
    p_user_id,
    'generation',
    'manual_mix',
    'mix:' || v_job_id,
    v_job_id
  ) as reservation;

  if v_usage_outcome = 'quota' then
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

  insert into public.generation_jobs as job (
    id,
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
    v_job_id,
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
    job.updated_at,
    job.is_public,
    job.generation_brief,
    job.source_track_id
  into
    v_job_updated_at,
    v_job_is_public,
    v_job_brief,
    v_job_source_track_id;

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

revoke all on function public.reserve_manual_generation_job(
  uuid,
  uuid,
  jsonb,
  boolean,
  uuid
) from public, anon, authenticated;
grant execute on function public.reserve_manual_generation_job(
  uuid,
  uuid,
  jsonb,
  boolean,
  uuid
) to service_role;
