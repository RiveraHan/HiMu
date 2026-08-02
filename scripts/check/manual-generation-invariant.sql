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
    null,
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000a3',
    'Invariant DJ Unreserved',
    'generation-invariant-dj-unreserved',
    null,
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000a4',
    'Invariant DJ Legacy Compatibility',
    'generation-invariant-dj-legacy-compatibility',
    null,
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
  id, user_id, dj_id, status, is_public, created_at, updated_at
)
values (
  '00000000-0000-4000-e000-0000000000a1',
  '00000000-0000-4000-a000-0000000000a1',
  '00000000-0000-4000-d000-0000000000a1',
  'queued',
  false,
  '2026-07-29T12:00:00Z',
  '2026-07-29T12:00:00Z'
);

do $$
begin
  begin
    insert into public.generation_jobs (
      id, user_id, dj_id, status, is_public, created_at, updated_at
    )
    values (
      '00000000-0000-4000-e000-000000000099',
      '00000000-0000-4000-a000-0000000000a1',
      '00000000-0000-4000-d000-0000000000a1',
      'generating',
      false,
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
  id, user_id, dj_id, status, is_public, drop_date, created_at, updated_at
)
values
  (
    '00000000-0000-4000-e000-0000000000a2',
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a2',
    'generating',
    true,
    null,
    '2026-07-29T12:00:02Z',
    '2026-07-29T12:00:02Z'
  ),
  (
    '00000000-0000-4000-e000-0000000000a3',
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a1',
    'queued',
    false,
    '2026-07-29',
    '2026-07-29T12:00:03Z',
    '2026-07-29T12:00:03Z'
  ),
  (
    '00000000-0000-4000-e000-0000000000b1',
    '00000000-0000-4000-b000-0000000000b1',
    '00000000-0000-4000-d000-0000000000b1',
    'queued',
    false,
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
declare
  legacy_compatibility boolean := coalesce(
    current_setting('himu.test_legacy_reservation_compatibility', true),
    'off'
  ) = 'on';
begin
  if pg_catalog.to_regprocedure(
    'public.finalize_generated_mix(uuid,uuid,text,text,text,text,text,text[],integer,uuid,text,text,timestamptz)'
  ) is not null then
    raise exception 'obsolete finalize_generated_mix overload still exists';
  end if;
  if legacy_compatibility then
    if pg_catalog.to_regprocedure(
      'public.reserve_manual_generation_job(uuid,uuid,text)'
    ) is null then
      raise exception 'legacy manual reservation wrapper is missing';
    end if;
    if has_function_privilege(
      'anon',
      'public.reserve_manual_generation_job(uuid,uuid,text)',
      'execute'
    ) or has_function_privilege(
      'authenticated',
      'public.reserve_manual_generation_job(uuid,uuid,text)',
      'execute'
    ) then
      raise exception 'legacy manual reservation wrapper is client-callable';
    end if;
    if not has_function_privilege(
      'service_role',
      'public.reserve_manual_generation_job(uuid,uuid,text)',
      'execute'
    ) then
      raise exception 'service_role cannot execute legacy reservation wrapper';
    end if;
  elsif pg_catalog.to_regprocedure(
    'public.reserve_manual_generation_job(uuid,uuid,text)'
  ) is not null then
    raise exception 'obsolete manual reservation overload still exists';
  end if;
  if has_function_privilege(
    'anon',
    'public.reserve_manual_generation_job(uuid,uuid,text,boolean)',
    'execute'
  ) then
    raise exception 'anon can reserve manual generation';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.reserve_manual_generation_job(uuid,uuid,text,boolean)',
    'execute'
  ) then
    raise exception 'authenticated can reserve manual generation';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_manual_generation_job(uuid,uuid,text,boolean)',
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
  if has_function_privilege(
    'authenticated',
    'public.reserve_cover_generation(uuid,uuid)',
    'execute'
  ) then
    raise exception 'authenticated can reserve cover generation';
  end if;
  if has_function_privilege(
    'anon',
    'public.enforce_one_owned_dj()',
    'execute'
  ) then
    raise exception 'anon can execute the owned DJ guard';
  end if;
end
$$;

do $$
declare
  legacy_compatibility boolean := coalesce(
    current_setting('himu.test_legacy_reservation_compatibility', true),
    'off'
  ) = 'on';
  first_reservation record;
  reconnect_reservation record;
  first_json jsonb;
  persisted_is_public boolean;
begin
  if legacy_compatibility then
    select *
    into first_reservation
    from public.reserve_manual_generation_job(
      '00000000-0000-4000-a000-0000000000a1',
      '00000000-0000-4000-d000-0000000000a4',
      null
    );

    first_json := to_jsonb(first_reservation);
    if first_reservation.outcome is distinct from 'created'
      or first_reservation.job_id is null
      or first_reservation.daily_limit is distinct from 3
      or first_reservation.queued_at is null
      or not first_json ?& array[
        'outcome', 'job_id', 'daily_limit', 'queued_at'
      ]
      or (select count(*) from jsonb_object_keys(first_json)) <> 4
    then
      raise exception 'legacy reservation returned an invalid four-field shape';
    end if;

    select is_public
    into persisted_is_public
    from public.generation_jobs
    where id = first_reservation.job_id;

    if persisted_is_public is distinct from false then
      raise exception 'legacy reservation did not default visibility to private';
    end if;

    select *
    into reconnect_reservation
    from public.reserve_manual_generation_job(
      '00000000-0000-4000-a000-0000000000a1',
      '00000000-0000-4000-d000-0000000000a4',
      null
    );

    if reconnect_reservation.outcome is distinct from 'existing'
      or reconnect_reservation.job_id is distinct from first_reservation.job_id
      or reconnect_reservation.queued_at
        is distinct from first_reservation.queued_at
      or reconnect_reservation.daily_limit is distinct from 3
    then
      raise exception 'legacy reservation reconnect changed its stored job';
    end if;
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
    null,
    true
  );

  if reservation.outcome <> 'existing'
    or reservation.job_id <> '00000000-0000-4000-e000-0000000000a1'
    or reservation.queued_at <> '2026-07-29T12:00:00Z'::timestamptz
    or reservation.daily_limit <> 3
    or reservation.is_public is distinct from false
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
  persisted_is_public boolean;
begin
  select *
  into reservation
  from public.reserve_manual_generation_job(
    '00000000-0000-4000-a000-0000000000a1',
    '00000000-0000-4000-d000-0000000000a3',
    null,
    true
  );

  select status, updated_at, is_public
  into persisted_status, persisted_queued_at, persisted_is_public
  from public.generation_jobs
  where id = reservation.job_id;

  if reservation.outcome is distinct from 'created'
    or reservation.job_id is null
    or reservation.queued_at is null
    or reservation.daily_limit <> 3
    or reservation.is_public is distinct from true
    or persisted_status is distinct from 'queued'
    or reservation.queued_at is distinct from persisted_queued_at
    or persisted_is_public is distinct from true
  then
    raise exception 'created reservation did not return its persisted queued token';
  end if;
end
$$;

do $$
begin
  begin
    perform *
    from public.reserve_manual_generation_job(
      '00000000-0000-4000-b000-0000000000b1',
      '00000000-0000-4000-d000-0000000000b1',
      null,
      null
    );
    raise exception 'null manual visibility unexpectedly succeeded';
  exception
    when sqlstate '22004' then null;
  end;
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
declare
  finalized_owner_id uuid;
  finalized_is_public boolean;
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

  select owner_id, is_public
  into finalized_owner_id, finalized_is_public
  from public.tracks
  where id = '00000000-0000-4000-f000-0000000000a1';

  if finalized_owner_id <> '00000000-0000-4000-a000-0000000000a1'
    or finalized_is_public is distinct from false
  then
    raise exception 'finalization did not derive privacy from the claimed job';
  end if;
end
$$;

select *
from public.finalize_generated_mix(
  '00000000-0000-4000-e000-0000000000a2',
  '00000000-0000-4000-f000-0000000000a2',
  'Public system-DJ test',
  'Invariant DJ B',
  'https://media.example.invalid/public-test.mp3',
  null,
  'Test',
  array['test'],
  120,
  '00000000-0000-4000-d000-0000000000a2',
  null,
  null,
  '2026-07-29T12:00:02Z',
  now()
);

do $$
declare
  finalized_owner_id uuid;
  finalized_is_public boolean;
begin
  select owner_id, is_public
  into finalized_owner_id, finalized_is_public
  from public.tracks
  where id = '00000000-0000-4000-f000-0000000000a2';

  if finalized_owner_id <> '00000000-0000-4000-a000-0000000000a1'
    or finalized_is_public is distinct from true
  then
    raise exception 'public system-DJ finalization did not derive job privacy';
  end if;
end
$$;

rollback;
