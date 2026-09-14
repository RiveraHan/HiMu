-- Preparation only: no rows are deleted and no job is scheduled by this migration.
create index product_events_retention_idx
  on public.product_events (created_at, event_id);

-- A narrow maintenance capability preserves the service role's append-only
-- table privileges. Only trusted server operators can call it; clients cannot.
create function public.maintain_product_event_retention(
  p_apply boolean default false,
  p_batch_size integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := current_timestamp - interval '90 days';
  v_eligible bigint;
  v_deleted bigint := 0;
  v_remaining bigint;
begin
  if p_apply is null or p_batch_size is null
    or p_batch_size < 1 or p_batch_size > 10000 then
    raise exception 'invalid retention arguments';
  end if;

  select count(*) into v_eligible
    from public.product_events where created_at < v_cutoff;

  if p_apply then
    with expired as (
      select event_id from public.product_events
      where created_at < v_cutoff
      order by created_at, event_id
      limit p_batch_size
      for update skip locked
    )
    delete from public.product_events as event
    using expired where event.event_id = expired.event_id;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_remaining
    from public.product_events where created_at < v_cutoff;
  return pg_catalog.jsonb_build_object(
    'retention_days', 90,
    'cutoff', v_cutoff,
    'dry_run', not p_apply,
    'eligible', v_eligible,
    'deleted', v_deleted,
    'remaining', v_remaining
  );
end;
$$;

revoke all on function public.maintain_product_event_retention(boolean, integer)
  from public, anon, authenticated;
grant execute on function public.maintain_product_event_retention(boolean, integer)
  to service_role;
