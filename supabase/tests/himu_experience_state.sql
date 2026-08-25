begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

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

insert into public.tracks (
  id, title, artist, is_ai_generated, owner_id, is_public, dj_id, created_at
)
values
  ('30000000-0000-0000-0000-000000000001', 'Earlier AI Track', 'Test', true, '10000000-0000-0000-0000-000000000002', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 10:00:00+00'),
  ('30000000-0000-0000-0000-000000000002', 'Later AI Track', 'Test', true, '10000000-0000-0000-0000-000000000002', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 11:00:00+00'),
  ('30000000-0000-0000-0000-000000000003', 'Existing-State First Track', 'Test', true, '10000000-0000-0000-0000-000000000003', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 12:00:00+00'),
  ('30000000-0000-0000-0000-000000000004', 'Race Track One', 'Test', true, '10000000-0000-0000-0000-000000000004', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 13:00:00+00'),
  ('30000000-0000-0000-0000-000000000005', 'Race Track Two', 'Test', true, '10000000-0000-0000-0000-000000000004', false, '20000000-0000-0000-0000-000000000001', '2026-08-24 13:00:00+00');

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

select * from finish();

rollback;
