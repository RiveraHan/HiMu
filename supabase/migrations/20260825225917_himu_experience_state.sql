create table public.user_experience_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  intro_version_seen integer not null default 0 check (intro_version_seen >= 0),
  first_owned_track_id uuid references public.tracks(id) on delete set null,
  first_owned_track_ready_at timestamptz,
  preference_nudge_status text not null default 'ineligible'
    check (preference_nudge_status in ('ineligible','eligible','shown','dismissed','completed')),
  preference_nudge_track_id uuid references public.tracks(id) on delete set null,
  preference_nudge_shown_at timestamptz,
  preference_nudge_dismissed_at timestamptz,
  preference_nudge_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_experience_state enable row level security;
revoke all on table public.user_experience_state from public, anon, authenticated;
grant select on table public.user_experience_state to authenticated;
grant all on table public.user_experience_state to service_role;

create policy "Users read own experience state"
on public.user_experience_state for select to authenticated
using ((select auth.uid()) = user_id);

create function public.transition_user_experience(
  p_user_id uuid,
  p_action text,
  p_intro_version integer,
  p_track_id uuid
)
returns setof public.user_experience_state
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260825,
    pg_catalog.hashtext(p_user_id::text)
  );

  insert into public.user_experience_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  case p_action
    when 'sync_intro' then
      update public.user_experience_state
      set
        intro_version_seen = greatest(intro_version_seen, p_intro_version),
        updated_at = greatest(updated_at, pg_catalog.clock_timestamp())
      where user_id = p_user_id;
    when 'claim_nudge' then
      update public.user_experience_state
      set
        preference_nudge_status = 'shown',
        preference_nudge_shown_at = coalesce(preference_nudge_shown_at, now()),
        updated_at = greatest(updated_at, pg_catalog.clock_timestamp())
      where user_id = p_user_id
        and preference_nudge_status = 'eligible'
        and preference_nudge_track_id = p_track_id;
    when 'dismiss_nudge' then
      update public.user_experience_state
      set
        preference_nudge_status = 'dismissed',
        preference_nudge_dismissed_at = coalesce(preference_nudge_dismissed_at, now()),
        updated_at = greatest(updated_at, pg_catalog.clock_timestamp())
      where user_id = p_user_id
        and preference_nudge_status = 'shown'
        and preference_nudge_track_id = p_track_id;
    when 'complete_nudge' then
      update public.user_experience_state
      set
        preference_nudge_status = 'completed',
        preference_nudge_completed_at = coalesce(preference_nudge_completed_at, now()),
        updated_at = greatest(updated_at, pg_catalog.clock_timestamp())
      where user_id = p_user_id
        and preference_nudge_status in ('eligible', 'shown', 'dismissed');
    else
      raise exception 'invalid_experience_action';
  end case;

  return query
  select experience.*
  from public.user_experience_state as experience
  where experience.user_id = p_user_id;
end;
$$;

revoke all on function public.transition_user_experience(uuid, text, integer, uuid)
from public, anon, authenticated;
grant execute on function public.transition_user_experience(uuid, text, integer, uuid)
to service_role;

create function public.capture_first_owned_track_ready()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if new.status <> 'ready'
    or old.status = 'ready'
    or new.track_id is null
  then
    return new;
  end if;

  select track.*
  into v_track
  from public.tracks as track
  where track.id = new.track_id;

  if not found
    or v_track.owner_id is distinct from new.user_id
    or v_track.is_ai_generated is distinct from true
  then
    return new;
  end if;

  if exists (
    select 1
    from public.tracks as earlier
    where earlier.owner_id = new.user_id
      and earlier.is_ai_generated = true
      and earlier.id <> new.track_id
      and (
        coalesce(earlier.created_at, '-infinity'::timestamptz),
        earlier.id
      ) < (
        coalesce(v_track.created_at, '-infinity'::timestamptz),
        v_track.id
      )
  ) then
    return new;
  end if;

  insert into public.user_experience_state (
    user_id,
    first_owned_track_id,
    first_owned_track_ready_at,
    preference_nudge_status,
    preference_nudge_track_id,
    updated_at
  )
  values (
    new.user_id,
    new.track_id,
    v_now,
    'eligible',
    new.track_id,
    v_now
  )
  on conflict (user_id) do update
  set
    first_owned_track_id = excluded.first_owned_track_id,
    first_owned_track_ready_at = excluded.first_owned_track_ready_at,
    preference_nudge_status = case
      when public.user_experience_state.preference_nudge_status = 'ineligible'
        then excluded.preference_nudge_status
      else public.user_experience_state.preference_nudge_status
    end,
    preference_nudge_track_id = excluded.preference_nudge_track_id,
    updated_at = greatest(
      public.user_experience_state.updated_at,
      excluded.updated_at
    )
  where public.user_experience_state.first_owned_track_ready_at is null;

  return new;
end;
$$;

revoke all on function public.capture_first_owned_track_ready()
from public, anon, authenticated;

create trigger capture_first_owned_track_ready
after update of status, track_id on public.generation_jobs
for each row execute function public.capture_first_owned_track_ready();
