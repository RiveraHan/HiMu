drop function if exists public.reserve_manual_generation_job(uuid, uuid, text);

create function public.reserve_manual_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_prompt text
)
returns table (
  outcome text,
  job_id uuid,
  daily_limit integer,
  queued_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_job_id uuid;
  v_job_updated_at timestamptz;
  v_limit constant integer := 10;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    20260729,
    pg_catalog.hashtext(p_user_id::text)
  );

  update public.cover_regens as cr
  set status = 'failed', completed_at = null, updated_at = v_now
  where cr.user_id = p_user_id
    and cr.status = 'reserved'
    and cr.updated_at < v_now - interval '15 minutes';

  select gj.id, gj.updated_at
  into v_job_id, v_job_updated_at
  from public.generation_jobs as gj
  where gj.user_id = p_user_id
    and gj.dj_id = p_dj_id
    and gj.drop_date is null
    and gj.status in ('queued', 'generating')
  order by gj.created_at asc
  limit 1;

  if found then
    return query
      select 'existing'::text, v_job_id, v_limit, v_job_updated_at;
    return;
  end if;

  if public.generation_quota_usage(p_user_id, v_now) >= v_limit then
    return query
      select 'quota'::text, null::uuid, v_limit, null::timestamptz;
    return;
  end if;

  begin
    insert into public.generation_jobs (
      user_id, dj_id, prompt, status, created_at, updated_at
    )
    values (p_user_id, p_dj_id, p_prompt, 'queued', v_now, v_now)
    returning id, updated_at into v_job_id, v_job_updated_at;
  exception
    when unique_violation then
      select gj.id, gj.updated_at
      into v_job_id, v_job_updated_at
      from public.generation_jobs as gj
      where gj.user_id = p_user_id
        and gj.dj_id = p_dj_id
        and gj.drop_date is null
        and gj.status in ('queued', 'generating')
      order by gj.created_at asc
      limit 1;

      if found then
        return query
          select 'existing'::text, v_job_id, v_limit, v_job_updated_at;
        return;
      end if;
      raise;
  end;

  return query select 'created'::text, v_job_id, v_limit, v_job_updated_at;
end;
$$;

revoke all on function public.reserve_manual_generation_job(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_manual_generation_job(uuid, uuid, text)
  to service_role;
