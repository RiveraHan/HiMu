create function public.claim_user_preference_nudge(
  p_user_id uuid,
  p_track_id uuid
)
returns table(state jsonb, applied boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_applied boolean := false;
  v_row_count bigint := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260825,
    pg_catalog.hashtext(p_user_id::text)
  );

  update public.user_experience_state
  set
    preference_nudge_status = 'shown',
    preference_nudge_shown_at = coalesce(preference_nudge_shown_at, now()),
    updated_at = greatest(updated_at, pg_catalog.clock_timestamp())
  where user_id = p_user_id
    and preference_nudge_status = 'eligible'
    and preference_nudge_track_id = p_track_id;

  get diagnostics v_row_count = row_count;
  v_applied := v_row_count = 1;

  return query
  select pg_catalog.to_jsonb(experience), v_applied
  from public.user_experience_state as experience
  where experience.user_id = p_user_id;
end;
$$;

revoke all on function public.claim_user_preference_nudge(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claim_user_preference_nudge(uuid, uuid)
to service_role;
