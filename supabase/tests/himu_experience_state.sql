begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

select plan(29);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'experience-a@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'experience-b@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'experience-existing@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'experience-race@example.com', '', now(), '{}', '{}', now(), now());

insert into public.djs (id, name, slug, is_public)
values
  ('20000000-0000-0000-0000-000000000001', 'Experience Test DJ', 'experience-test-dj', false),
  ('20000000-0000-0000-0000-000000000002', 'Experience Test DJ Two', 'experience-test-dj-two', false);

select has_table(
  'public',
  'user_experience_state',
  'experience state table exists'
);

select policies_are(
  'public',
  'user_experience_state',
  array['Users read own experience state'],
  'experience state exposes only the intended RLS policy'
);

select is(
  has_table_privilege('authenticated', 'public.user_experience_state', 'SELECT'),
  true,
  'authenticated has table SELECT'
);

select is(
  has_table_privilege('authenticated', 'public.user_experience_state', 'INSERT'),
  false,
  'authenticated has no table INSERT'
);

select is(
  has_table_privilege('authenticated', 'public.user_experience_state', 'UPDATE'),
  false,
  'authenticated has no table UPDATE'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.transition_user_experience(uuid,text,integer,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute transitions'
);

select is(
  has_function_privilege(
    'service_role',
    'public.transition_user_experience(uuid,text,integer,uuid)',
    'EXECUTE'
  ),
  true,
  'service role can execute transitions'
);

set local role service_role;
select lives_ok(
  $$select public.transition_user_experience('10000000-0000-0000-0000-000000000001', 'sync_intro', 2, null)$$,
  'service role can sync intro state'
);
select lives_ok(
  $$select public.transition_user_experience('10000000-0000-0000-0000-000000000002', 'sync_intro', 1, null)$$,
  'service role can create a second user state'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select user_id from public.user_experience_state order by user_id$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'authenticated user selects only their own state'
);
select throws_ok(
  $$insert into public.user_experience_state (user_id) values ('10000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'authenticated cannot insert experience state'
);
select throws_ok(
  $$update public.user_experience_state set intro_version_seen = 99 where user_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'authenticated cannot update experience state'
);
reset role;

set local role service_role;
update public.user_experience_state
set preference_nudge_status = 'eligible'
where user_id = '10000000-0000-0000-0000-000000000001';
select public.transition_user_experience(
  '10000000-0000-0000-0000-000000000001',
  'complete_nudge',
  0,
  null
);
select public.transition_user_experience(
  '10000000-0000-0000-0000-000000000001',
  'dismiss_nudge',
  0,
  null
);
reset role;

select is(
  (select preference_nudge_status from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000001'),
  'completed',
  'completed preference nudge status cannot regress'
);

set local role service_role;
update public.user_experience_state
set updated_at = '2099-01-01 00:00:00+00'
where user_id = '10000000-0000-0000-0000-000000000001';
select public.transition_user_experience(
  '10000000-0000-0000-0000-000000000001',
  'sync_intro',
  3,
  null
);
reset role;

select is(
  (select updated_at from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000001'),
  '2099-01-01 00:00:00+00'::timestamptz,
  'service transitions never move updated_at backward'
);

insert into public.tracks (
  id, title, artist, is_ai_generated, owner_id, is_public, dj_id, created_at
)
values
  ('30000000-0000-0000-0000-000000000001', 'Earlier AI Track', 'Test', true, '10000000-0000-0000-0000-000000000002', false, '20000000-0000-0000-0000-000000000001', null),
  ('30000000-0000-0000-0000-000000000002', 'Later AI Track', 'Test', true, '10000000-0000-0000-0000-000000000002', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 11:00:00+00'),
  ('30000000-0000-0000-0000-000000000003', 'Existing-State First Track', 'Test', true, '10000000-0000-0000-0000-000000000003', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 12:00:00+00'),
  ('30000000-0000-0000-0000-000000000004', 'Race Track One', 'Test', true, '10000000-0000-0000-0000-000000000004', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 13:00:00+00'),
  ('30000000-0000-0000-0000-000000000005', 'Race Track Two', 'Test', true, '10000000-0000-0000-0000-000000000004', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 13:00:00+00'),
  ('30000000-0000-0000-0000-000000000006', 'Post-Deletion Track', 'Test', true, '10000000-0000-0000-0000-000000000003', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 15:00:00+00');

insert into public.generation_jobs (id, user_id, dj_id, status, track_id)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'generating', '30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'generating', '30000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'generating', '30000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'generating', '30000000-0000-0000-0000-000000000005');

update public.generation_jobs
set status = 'ready'
where id = '40000000-0000-0000-0000-000000000001';

select is(
  (select first_owned_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000002'),
  null::uuid,
  'a later ready job is ineligible when an earlier qualifying owned AI track exists'
);
select is(
  (select preference_nudge_status from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000002'),
  'ineligible',
  'an ineligible later ready job leaves the nudge ineligible'
);

set local role service_role;
select public.transition_user_experience(
  '10000000-0000-0000-0000-000000000003',
  'sync_intro',
  7,
  null
);
update public.user_experience_state
set updated_at = '2099-01-01 00:00:00+00'
where user_id = '10000000-0000-0000-0000-000000000003';
reset role;

update public.generation_jobs
set status = 'ready'
where id = '40000000-0000-0000-0000-000000000002';

select is(
  (select first_owned_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'first ready job fills the empty first-track fields on a state row created by sync_intro'
);
select is(
  (select intro_version_seen from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  7,
  'first ready capture preserves prior intro state'
);
select is(
  (select preference_nudge_status from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  'eligible',
  'first ready capture atomically makes the nudge eligible'
);
select is(
  (select preference_nudge_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'first ready capture atomically associates the nudge with the captured track'
);
select is(
  (select updated_at from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  '2099-01-01 00:00:00+00'::timestamptz,
  'first ready capture never moves updated_at backward'
);

delete from public.tracks
where id = '30000000-0000-0000-0000-000000000003';

insert into public.generation_jobs (id, user_id, dj_id, status, track_id)
values (
  '40000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  'generating',
  '30000000-0000-0000-0000-000000000006'
);
update public.generation_jobs
set status = 'ready'
where id = '40000000-0000-0000-0000-000000000007';

select is(
  (select first_owned_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  null::uuid,
  'deleting the captured track does not reopen first-track assignment'
);
select is(
  (select preference_nudge_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  null::uuid,
  'a post-deletion ready track does not replace the original nudge association'
);
select isnt(
  (select first_owned_track_ready_at from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000003'),
  null::timestamptz,
  'the immutable first-track claim sentinel survives captured-track deletion'
);

update public.generation_jobs
set status = 'ready'
where id = '40000000-0000-0000-0000-000000000003';
update public.generation_jobs
set status = 'ready'
where id = '40000000-0000-0000-0000-000000000004';

select ok(
  (select first_owned_track_id in (
    '30000000-0000-0000-0000-000000000004'::uuid,
    '30000000-0000-0000-0000-000000000005'::uuid
  ) from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000004'),
  'competing ready transitions retain one qualifying track ID'
);
select is(
  (select first_owned_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000004'),
  (select preference_nudge_track_id from public.user_experience_state where user_id = '10000000-0000-0000-0000-000000000004'),
  'competing ready transitions keep first-track and nudge track IDs atomic'
);

select extensions.dblink_connect(
  'experience_race_one',
  'host=host.docker.internal port=54322 dbname=' || current_database() || ' user=postgres password=postgres'
);
select extensions.dblink_connect(
  'experience_race_two',
  'host=host.docker.internal port=54322 dbname=' || current_database() || ' user=postgres password=postgres'
);

select extensions.dblink_exec(
  'experience_race_one',
  $setup$
    delete from auth.users
    where id = '10000000-0000-0000-0000-000000000005';
    delete from public.djs
    where id in (
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000004'
    );
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '10000000-0000-0000-0000-000000000005',
      'authenticated',
      'authenticated',
      'experience-concurrency@example.com',
      '',
      now(),
      '{}',
      '{}',
      now(),
      now()
    );
    insert into public.djs (id, name, slug, is_public)
    values
      ('20000000-0000-0000-0000-000000000003', 'Experience Race DJ One', 'experience-race-dj-one', false),
      ('20000000-0000-0000-0000-000000000004', 'Experience Race DJ Two', 'experience-race-dj-two', false);
    insert into public.generation_jobs (id, user_id, dj_id, status)
    values
      ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'generating'),
      ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'generating');
    insert into public.user_experience_state (user_id, intro_version_seen)
    values ('10000000-0000-0000-0000-000000000005', 9);
  $setup$
);

select pg_catalog.pg_advisory_lock(20260825, 9101);
select pg_catalog.pg_advisory_lock(20260825, 9102);

select extensions.dblink_send_query(
  'experience_race_one',
  $race_one$
    do $do$
    begin
      insert into public.tracks (
        id, title, artist, is_ai_generated, owner_id, is_public, dj_id, created_at
      ) values (
        '30000000-0000-0000-0000-000000000007',
        'Concurrent Winner',
        'Test',
        true,
        '10000000-0000-0000-0000-000000000005',
        false,
        '20000000-0000-0000-0000-000000000003',
        '2026-08-24 14:00:00+00'
      );
      perform pg_catalog.pg_advisory_xact_lock(20260825, 9101);
      update public.generation_jobs
      set status = 'ready', track_id = '30000000-0000-0000-0000-000000000007'
      where id = '40000000-0000-0000-0000-000000000005';
      perform pg_catalog.pg_sleep(1);
    end
    $do$;
  $race_one$
);
select extensions.dblink_send_query(
  'experience_race_two',
  $race_two$
    do $do$
    begin
      insert into public.tracks (
        id, title, artist, is_ai_generated, owner_id, is_public, dj_id, created_at
      ) values (
        '30000000-0000-0000-0000-000000000008',
        'Concurrent Contender',
        'Test',
        true,
        '10000000-0000-0000-0000-000000000005',
        false,
        '20000000-0000-0000-0000-000000000004',
        '2026-08-24 14:00:00+00'
      );
      perform pg_catalog.pg_advisory_xact_lock(20260825, 9102);
      update public.generation_jobs
      set status = 'ready', track_id = '30000000-0000-0000-0000-000000000008'
      where id = '40000000-0000-0000-0000-000000000006';
    end
    $do$;
  $race_two$
);

select pg_catalog.pg_sleep(0.2);
select pg_catalog.pg_advisory_unlock(20260825, 9101);
select pg_catalog.pg_sleep(0.2);
select pg_catalog.pg_advisory_unlock(20260825, 9102);

select *
from extensions.dblink_get_result('experience_race_one') as result(status text);
select *
from extensions.dblink_get_result('experience_race_one') as result(status text);
select *
from extensions.dblink_get_result('experience_race_two') as result(status text);
select *
from extensions.dblink_get_result('experience_race_two') as result(status text);

select is(
  (
    select count(*)
    from public.generation_jobs
    where user_id = '10000000-0000-0000-0000-000000000005'
      and status = 'ready'
  ),
  2::bigint,
  'both concurrent generation-ready transactions commit'
);
select is(
  (
    select first_owned_track_id
    from public.user_experience_state
    where user_id = '10000000-0000-0000-0000-000000000005'
  ),
  '30000000-0000-0000-0000-000000000007'::uuid,
  'the first concurrent capture remains the sole winner'
);
select is(
  (
    select preference_nudge_track_id
    from public.user_experience_state
    where user_id = '10000000-0000-0000-0000-000000000005'
  ),
  '30000000-0000-0000-0000-000000000007'::uuid,
  'the concurrent winner keeps the nudge association atomic'
);

select extensions.dblink_exec(
  'experience_race_one',
  $cleanup$
    delete from auth.users
    where id = '10000000-0000-0000-0000-000000000005';
    delete from public.djs
    where id in (
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000004'
    );
  $cleanup$
);
select extensions.dblink_disconnect('experience_race_one');
select extensions.dblink_disconnect('experience_race_two');

select * from finish();

rollback;
