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
