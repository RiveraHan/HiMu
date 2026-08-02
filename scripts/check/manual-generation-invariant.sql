begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-a000-0000000000a1',
    'authenticated',
    'authenticated',
    'generation-invariant-a@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Invariant A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-b000-0000000000b1',
    'authenticated',
    'authenticated',
    'generation-invariant-b@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Invariant B"}',
    now(),
    now()
  );

insert into public.djs (id, name, slug, owner_id, is_public)
values
  (
    '00000000-0000-4000-d000-0000000000a1',
    'Invariant DJ A',
    'generation-invariant-dj-a',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000a2',
    'Invariant DJ B',
    'generation-invariant-dj-b',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000a3',
    'Invariant DJ Unreserved',
    'generation-invariant-dj-unreserved',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000b1',
    'Invariant DJ C',
    'generation-invariant-dj-c',
    '00000000-0000-4000-b000-0000000000b1',
    false
  );

insert into public.generation_jobs (
  id, user_id, dj_id, status, created_at, updated_at
)
values (
  '00000000-0000-4000-e000-0000000000a1',
  '00000000-0000-4000-a000-0000000000a1',
  '00000000-0000-4000-d000-0000000000a1',
  'queued',
  '2026-07-29T12:00:00Z',
  '2026-07-29T12:00:00Z'
);

do $$
begin
  begin
    insert into public.generation_jobs (
      id, user_id, dj_id, status, created_at, updated_at
    )
    values (
      '00000000-0000-4000-e000-000000000099',
      '00000000-0000-4000-a000-0000000000a1',
      '00000000-0000-4000-d000-0000000000a1',
      'generating',
      '2026-07-29T12:00:01Z',
      '2026-07-29T12:00:01Z'
    );
    raise exception 'duplicate active manual job unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end
$$;

insert into public.generation_jobs (
  id, user_id, dj_id, status, drop_date, created_at, updated_at
)
values
  (
    '00000000-0000-4000-e000-0000000000a2',
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a2',
    'generating',
    null,
    '2026-07-29T12:00:02Z',
    '2026-07-29T12:00:02Z'
  ),
  (
    '00000000-0000-4000-e000-0000000000a3',
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a1',
    'queued',
    '2026-07-29',
    '2026-07-29T12:00:03Z',
    '2026-07-29T12:00:03Z'
  ),
  (
    '00000000-0000-4000-e000-0000000000b1',
    '00000000-0000-4000-b000-0000000000b1',
    '00000000-0000-4000-d000-0000000000b1',
    'queued',
    null,
    '2026-07-29T12:00:04Z',
    '2026-07-29T12:00:04Z'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-a000-0000000000a1',
  true
);

do $$
declare
  visible_count integer;
  foreign_count integer;
begin
  select
    count(*),
    count(*) filter (
      where user_id <> '00000000-0000-4000-a000-0000000000a1'
    )
  into visible_count, foreign_count
  from public.generation_jobs
  where id = any(array[
    '00000000-0000-4000-e000-0000000000a1'::uuid,
    '00000000-0000-4000-e000-0000000000a2'::uuid,
    '00000000-0000-4000-e000-0000000000a3'::uuid,
    '00000000-0000-4000-e000-0000000000b1'::uuid
  ]);

  if visible_count <> 3 or foreign_count <> 0 then
    raise exception
      'user A RLS mismatch: visible %, foreign %',
      visible_count,
      foreign_count;
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-b000-0000000000b1',
  true
);

do $$
declare
  visible_count integer;
  foreign_count integer;
begin
  select
    count(*),
    count(*) filter (
      where user_id <> '00000000-0000-4000-b000-0000000000b1'
    )
  into visible_count, foreign_count
  from public.generation_jobs
  where id = any(array[
    '00000000-0000-4000-e000-0000000000a1'::uuid,
    '00000000-0000-4000-e000-0000000000a2'::uuid,
    '00000000-0000-4000-e000-0000000000a3'::uuid,
    '00000000-0000-4000-e000-0000000000b1'::uuid
  ]);

  if visible_count <> 1 or foreign_count <> 0 then
    raise exception
      'user B RLS mismatch: visible %, foreign %',
      visible_count,
      foreign_count;
  end if;
end
$$;

reset role;

do $$
begin
  if pg_catalog.to_regprocedure(
    'public.finalize_generated_mix(uuid,uuid,text,text,text,text,text,text[],integer,uuid,text,text,timestamptz)'
  ) is not null then
    raise exception 'obsolete finalize_generated_mix overload still exists';
  end if;
  if has_function_privilege(
    'anon',
    'public.reserve_manual_generation_job(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'anon can reserve manual generation';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_manual_generation_job(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'service_role cannot reserve manual generation';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.finalize_generated_mix(uuid,uuid,text,text,text,text,text,text[],integer,uuid,text,text,timestamptz,timestamptz)',
    'execute'
  ) then
    raise exception 'authenticated can finalize generated mixes';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.finalize_generated_mix(uuid,uuid,text,text,text,text,text,text[],integer,uuid,text,text,timestamptz,timestamptz)',
    'execute'
  ) then
    raise exception 'service_role cannot finalize generated mixes';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_cover_generation(uuid,uuid)',
    'execute'
  ) then
    raise exception 'service_role cannot reserve cover generation';
  end if;
end
$$;

do $$
declare
  reservation record;
begin
  select *
  into reservation
  from public.reserve_manual_generation_job(
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a1',
    null
  );

  if reservation.outcome <> 'existing'
    or reservation.job_id <> '00000000-0000-4000-e000-0000000000a1'
    or reservation.queued_at <> '2026-07-29T12:00:00Z'::timestamptz
  then
    raise exception 'manual reservation did not return its exact queued token';
  end if;
end
$$;

do $$
declare
  reservation record;
  persisted_status text;
  persisted_queued_at timestamptz;
begin
  select *
  into reservation
  from public.reserve_manual_generation_job(
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a3',
    null
  );

  select status, updated_at
  into persisted_status, persisted_queued_at
  from public.generation_jobs
  where id = reservation.job_id;

  if reservation.outcome is distinct from 'created'
    or reservation.job_id is null
    or reservation.queued_at is null
    or persisted_status is distinct from 'queued'
    or reservation.queued_at is distinct from persisted_queued_at
  then
    raise exception 'created reservation did not return its persisted queued token';
  end if;
end
$$;

update public.generation_jobs
set status = 'queued'
where id = '00000000-0000-4000-e000-0000000000a1';

do $$
begin
  begin
    perform *
    from public.finalize_generated_mix(
      '00000000-0000-4000-e000-0000000000a1',
      '00000000-0000-4000-f000-0000000000a1',
      'Atomic test',
      'Invariant DJ A',
      'https://media.example.invalid/test.mp3',
      null,
      'Test',
      array['test'],
      120,
      '00000000-0000-4000-d000-0000000000a1',
      null,
      null,
      '2026-07-29T12:00:00Z',
      now()
    );
    raise exception 'invalid atomic finalization unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;
end
$$;

do $$
declare
  fixture_track_count integer;
  fixture_job_status text;
  fixture_job_track uuid;
begin
  select count(*)
  into fixture_track_count
  from public.tracks
  where id = '00000000-0000-4000-f000-0000000000a1';

  select status, track_id
  into fixture_job_status, fixture_job_track
  from public.generation_jobs
  where id = '00000000-0000-4000-e000-0000000000a1';

  if fixture_track_count <> 0
    or fixture_job_status <> 'queued'
    or fixture_job_track is not null
  then
    raise exception 'failed finalization was not atomic';
  end if;
end
$$;

update public.generation_jobs
set status = 'generating'
where id = '00000000-0000-4000-e000-0000000000a1';

do $$
begin
  begin
    perform *
    from public.finalize_generated_mix(
      '00000000-0000-4000-e000-0000000000a1',
      '00000000-0000-4000-f000-0000000000a1',
      'Stale attempt',
      'Invariant DJ A',
      'https://media.example.invalid/stale.mp3',
      null,
      'Test',
      array['test'],
      120,
      '00000000-0000-4000-d000-0000000000a1',
      null,
      null,
      '2026-07-29T11:59:59Z',
      now()
    );
    raise exception 'stale generation attempt unexpectedly finalized';
  exception
    when sqlstate '55000' then null;
  end;
end
$$;

select *
from public.finalize_generated_mix(
  '00000000-0000-4000-e000-0000000000a1',
  '00000000-0000-4000-f000-0000000000a1',
  'Atomic test',
  'Invariant DJ A',
  'https://media.example.invalid/test.mp3',
  null,
  'Test',
  array['test'],
  120,
  '00000000-0000-4000-d000-0000000000a1',
  null,
  null,
  '2026-07-29T12:00:00Z',
  now()
);

do $$
begin
  if not exists (
    select 1
    from public.generation_jobs as gj
    join public.tracks as t on t.id = gj.track_id
    where gj.id = '00000000-0000-4000-e000-0000000000a1'
      and gj.status = 'ready'
      and t.id = '00000000-0000-4000-f000-0000000000a1'
  ) then
    raise exception 'valid finalization did not commit track and job together';
  end if;
end
$$;

rollback;
