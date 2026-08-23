create table public.provider_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quota_bucket text not null check (
    quota_bucket in ('generation', 'daily_drop', 'avatar', 'creative_draft')
  ),
  operation text not null check (
    operation in (
      'manual_mix',
      'cover',
      'daily_drop',
      'initial_avatar',
      'avatar_regen',
      'creative_draft'
    )
  ),
  idempotency_key text not null
    check (char_length(btrim(idempotency_key)) between 1 and 200),
  resource_id uuid,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (user_id, quota_bucket, idempotency_key)
);

create index provider_usage_events_user_bucket_created_idx
  on public.provider_usage_events (user_id, quota_bucket, created_at desc);

alter table public.provider_usage_events enable row level security;
revoke all on table public.provider_usage_events from public, anon, authenticated;
grant all on table public.provider_usage_events to service_role;

insert into public.provider_usage_events (
  user_id,
  quota_bucket,
  operation,
  idempotency_key,
  resource_id,
  created_at
)
select
  gj.user_id,
  'generation',
  'manual_mix',
  'mix:' || gj.id,
  gj.id,
  gj.created_at
from public.generation_jobs as gj
where gj.drop_date is null
on conflict do nothing;

insert into public.provider_usage_events (
  user_id,
  quota_bucket,
  operation,
  idempotency_key,
  resource_id,
  created_at
)
select
  gj.user_id,
  'daily_drop',
  'daily_drop',
  'drop:' || gj.id,
  gj.id,
  gj.created_at
from public.generation_jobs as gj
where gj.drop_date is not null
on conflict do nothing;

insert into public.provider_usage_events (
  user_id,
  quota_bucket,
  operation,
  idempotency_key,
  resource_id,
  created_at
)
select
  cr.user_id,
  'generation',
  'cover',
  'cover:' || cr.id,
  cr.id,
  cr.created_at
from public.cover_regens as cr
on conflict do nothing;

insert into public.provider_usage_events (
  user_id,
  quota_bucket,
  operation,
  idempotency_key,
  resource_id,
  created_at
)
select
  ar.user_id,
  'avatar',
  'avatar_regen',
  'avatar:' || ar.id,
  ar.id,
  ar.created_at
from public.avatar_regens as ar
on conflict do nothing;

insert into public.provider_usage_events (
  user_id,
  quota_bucket,
  operation,
  idempotency_key,
  resource_id,
  created_at
)
select
  cde.user_id,
  'creative_draft',
  'creative_draft',
  'draft:' || cde.id,
  cde.id,
  cde.created_at
from public.creative_draft_events as cde
on conflict do nothing;

create function public.reserve_provider_usage_event(
  p_user_id uuid,
  p_quota_bucket text,
  p_operation text,
  p_idempotency_key text,
  p_resource_id uuid default null
)
returns table (
  outcome text,
  event_id uuid,
  daily_limit integer,
  resource_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_limit integer;
  v_window interval;
  v_event_id uuid;
  v_resource_id uuid;
begin
  select limits.limit_value, limits.window_value
  into v_limit, v_window
  from (values
    ('generation'::text, 3, interval '24 hours'),
    ('daily_drop'::text, 1, interval '24 hours'),
    ('avatar'::text, 3, interval '24 hours'),
    ('creative_draft'::text, 30, interval '1 hour')
  ) as limits(bucket, limit_value, window_value)
  where limits.bucket = p_quota_bucket;

  if p_user_id is null
    or v_limit is null
    or nullif(btrim(p_idempotency_key), '') is null
    or char_length(p_idempotency_key) > 200
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_provider_usage_reservation';
  end if;

  if not (
    (p_quota_bucket = 'generation' and p_operation in ('manual_mix', 'cover'))
    or (p_quota_bucket = 'daily_drop' and p_operation = 'daily_drop')
    or (
      p_quota_bucket = 'avatar'
      and p_operation in ('initial_avatar', 'avatar_regen')
    )
    or (
      p_quota_bucket = 'creative_draft'
      and p_operation = 'creative_draft'
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_provider_usage_operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext(p_quota_bucket)
  );

  select event.id, event.resource_id
  into v_event_id, v_resource_id
  from public.provider_usage_events as event
  where event.user_id = p_user_id
    and event.quota_bucket = p_quota_bucket
    and event.idempotency_key = p_idempotency_key;

  if found then
    return query
    select 'existing'::text, v_event_id, v_limit, v_resource_id;
    return;
  end if;

  if (
    select count(*)
    from public.provider_usage_events as event
    where event.user_id = p_user_id
      and event.quota_bucket = p_quota_bucket
      and event.created_at > v_now - v_window
  ) >= v_limit then
    return query
    select 'quota'::text, null::uuid, v_limit, null::uuid;
    return;
  end if;

  insert into public.provider_usage_events (
    user_id,
    quota_bucket,
    operation,
    idempotency_key,
    resource_id,
    created_at
  ) values (
    p_user_id,
    p_quota_bucket,
    p_operation,
    p_idempotency_key,
    p_resource_id,
    v_now
  )
  returning id into v_event_id;

  return query
  select 'created'::text, v_event_id, v_limit, p_resource_id;
end;
$$;

revoke all on function public.reserve_provider_usage_event(
  uuid,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.reserve_provider_usage_event(
  uuid,
  text,
  text,
  text,
  uuid
) to service_role;

create or replace function public.generation_quota_usage(
  p_user_id uuid,
  p_at timestamptz default pg_catalog.clock_timestamp()
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.provider_usage_events as event
  where event.user_id = p_user_id
    and event.quota_bucket = 'generation'
    and event.created_at > p_at - interval '24 hours'
$$;

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
    or p_generation_brief->>'version' <> '1'
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

create or replace function public.retry_legacy_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_job_id uuid
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
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
  v_prompt text;
  v_is_public boolean;
  v_job_id uuid;
  v_usage_outcome text;
  v_limit constant integer := 3;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext('generation')
  );

  update public.cover_regens as cover
  set status = 'failed', completed_at = null, updated_at = v_now
  where cover.user_id = p_user_id
    and cover.status = 'reserved'
    and cover.updated_at < v_now - interval '15 minutes';

  select job.prompt, job.is_public
  into v_prompt, v_is_public
  from public.generation_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.dj_id = p_dj_id
    and job.drop_date is null
    and job.generation_brief is null
    and job.status = 'failed';

  if not found then
    return query select
      'unavailable'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::boolean,
      null::text;
    return;
  end if;

  select active.id, active.prompt, active.is_public
  into v_job_id, v_prompt, v_is_public
  from public.generation_jobs as active
  where active.user_id = p_user_id
    and active.dj_id = p_dj_id
    and active.drop_date is null
    and active.generation_brief is null
    and active.status in ('queued', 'generating')
  order by active.created_at asc
  limit 1;

  if found then
    return query select
      'existing'::text,
      v_job_id,
      v_limit,
      v_now,
      v_is_public,
      v_prompt;
    return;
  end if;

  if exists (
    select 1
    from public.generation_jobs as active
    where active.user_id = p_user_id
      and active.dj_id = p_dj_id
      and active.drop_date is null
      and active.status in ('queued', 'generating')
  ) then
    return query select
      'unavailable'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::boolean,
      null::text;
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
      null::text;
    return;
  end if;

  insert into public.generation_jobs (
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
    v_prompt,
    null,
    null,
    'queued',
    v_is_public,
    v_now,
    v_now
  );

  return query select
    'created'::text,
    v_job_id,
    v_limit,
    v_now,
    v_is_public,
    v_prompt;
end;
$$;

revoke all on function public.retry_legacy_manual_generation_job(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_legacy_manual_generation_job(uuid, uuid, uuid)
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
  v_reservation_id uuid := gen_random_uuid();
  v_usage_outcome text;
  v_limit constant integer := 3;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext('generation')
  );

  update public.cover_regens as cover
  set status = 'failed', completed_at = null, updated_at = v_now
  where cover.user_id = p_user_id
    and cover.status = 'reserved'
    and cover.updated_at < v_now - interval '15 minutes';

  select reservation.outcome
  into v_usage_outcome
  from public.reserve_provider_usage_event(
    p_user_id,
    'generation',
    'cover',
    'cover:' || v_reservation_id,
    v_reservation_id
  ) as reservation;

  if v_usage_outcome = 'quota' then
    return query select 'quota'::text, null::uuid, v_limit;
    return;
  end if;

  insert into public.cover_regens (
    id,
    user_id,
    track_id,
    status,
    completed_at,
    created_at,
    updated_at
  ) values (
    v_reservation_id,
    p_user_id,
    p_track_id,
    'reserved',
    null,
    v_now,
    v_now
  );

  return query select 'reserved'::text, v_reservation_id, v_limit;
end;
$$;

revoke all on function public.reserve_cover_generation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_cover_generation(uuid, uuid)
  to service_role;

create function public.reserve_daily_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_drop_date date
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
  queued_at timestamptz,
  status text,
  updated_at timestamptz,
  dj_id uuid,
  is_public boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_job_id uuid;
  v_usage_outcome text;
  v_limit constant integer := 1;
begin
  if p_user_id is null or p_dj_id is null or p_drop_date is null then
    raise exception using errcode = '22004', message = 'daily_drop_inputs_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext('daily_drop')
  );

  return query
  select
    'existing'::text,
    job.id,
    v_limit,
    job.created_at,
    job.status,
    job.updated_at,
    job.dj_id,
    job.is_public
  from public.provider_usage_events as event
  join public.generation_jobs as job on job.id = event.resource_id
  where event.user_id = p_user_id
    and event.quota_bucket = 'daily_drop'
    and event.created_at > v_now - interval '24 hours'
  order by event.created_at desc
  limit 1;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.provider_usage_events as event
    where event.user_id = p_user_id
      and event.quota_bucket = 'daily_drop'
      and event.created_at > v_now - interval '24 hours'
  ) then
    return query select
      'quota'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::text,
      null::timestamptz,
      null::uuid,
      null::boolean;
    return;
  end if;

  select job.id
  into v_job_id
  from public.generation_jobs as job
  where job.user_id = p_user_id
    and job.drop_date = p_drop_date
  limit 1;

  if found then
    return query
    select
      'existing'::text,
      job.id,
      v_limit,
      job.created_at,
      job.status,
      job.updated_at,
      job.dj_id,
      job.is_public
    from public.generation_jobs as job
    where job.id = v_job_id;
    return;
  end if;

  v_job_id := gen_random_uuid();
  select reservation.outcome
  into v_usage_outcome
  from public.reserve_provider_usage_event(
    p_user_id,
    'daily_drop',
    'daily_drop',
    'drop:' || v_job_id,
    v_job_id
  ) as reservation;

  if v_usage_outcome = 'quota' then
    return query select
      'quota'::text,
      null::uuid,
      v_limit,
      null::timestamptz,
      null::text,
      null::timestamptz,
      null::uuid,
      null::boolean;
    return;
  end if;

  insert into public.generation_jobs (
    id,
    user_id,
    dj_id,
    status,
    drop_date,
    is_public,
    created_at,
    updated_at
  ) values (
    v_job_id,
    p_user_id,
    p_dj_id,
    'queued',
    p_drop_date,
    false,
    v_now,
    v_now
  );

  return query select
    'created'::text,
    v_job_id,
    v_limit,
    v_now,
    'queued'::text,
    v_now,
    p_dj_id,
    false;
end;
$$;

revoke all on function public.reserve_daily_generation_job(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.reserve_daily_generation_job(uuid, uuid, date)
  to service_role;
