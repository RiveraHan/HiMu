create table public.product_events (
  event_id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  installation_id uuid not null,
  session_id uuid not null,
  event_name text not null check (event_name in (
    'intro_viewed',
    'intro_step_viewed',
    'intro_completed',
    'auth_started',
    'auth_succeeded',
    'auth_failed',
    'first_track_gate_resolved',
    'first_track_intent_cancelled',
    'dj_creation_started',
    'dj_step_completed',
    'dj_identity_draft_succeeded',
    'dj_identity_draft_failed',
    'dj_created',
    'dj_creation_failed',
    'track_generation_confirmed',
    'track_generation_ready',
    'track_generation_failed',
    'preference_nudge_shown',
    'preference_nudge_accepted',
    'preference_nudge_dismissed',
    'music_preferences_saved'
  )),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object')
    check (properties - array[
      'flowVersion',
      'platform',
      'locale',
      'step',
      'elapsedMs',
      'selectedCountBucket',
      'routeOutcome',
      'errorCategory'
    ] = '{}'::jsonb)
    check (pg_column_size(properties) <= 4096),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index product_events_installation_created_idx
on public.product_events (installation_id, created_at desc);

alter table public.product_events enable row level security;
revoke all on table public.product_events from public, anon, authenticated;
grant all on table public.product_events to service_role;

create function public.record_product_event(
  p_event_id uuid,
  p_user_id uuid,
  p_installation_id uuid,
  p_session_id uuid,
  p_event_name text,
  p_properties jsonb,
  p_occurred_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_installation_id::text)::bigint
  );

  if exists (
    select 1
    from public.product_events as event
    where event.event_id = p_event_id
  ) then
    return 'duplicate';
  end if;

  if (
    select count(*)
    from public.product_events as recent
    where recent.installation_id = p_installation_id
      and recent.created_at >= pg_catalog.clock_timestamp() - interval '1 minute'
  ) >= 60 then
    return 'rate_limited';
  end if;

  insert into public.product_events (
    event_id,
    user_id,
    installation_id,
    session_id,
    event_name,
    properties,
    occurred_at
  )
  values (
    p_event_id,
    p_user_id,
    p_installation_id,
    p_session_id,
    p_event_name,
    p_properties,
    p_occurred_at
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  return 'accepted';
end;
$$;

revoke all on function public.record_product_event(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  timestamptz
)
from public, anon, authenticated;
grant execute on function public.record_product_event(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  timestamptz
)
to service_role;
