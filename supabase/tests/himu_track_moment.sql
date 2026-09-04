begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'moment-a@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'moment-b@example.com', '', now(), '{}', '{}', now(), now());

insert into public.djs (id, name, slug, is_public)
values ('72000000-0000-4000-8000-000000000001', 'Moment Test DJ', 'moment-test-dj', false);

insert into public.tracks (
  id, title, artist, audio_url, is_ai_generated, owner_id, is_public, dj_id
)
values
  ('73000000-0000-4000-8000-000000000001', 'Owner Track', 'Test', 'r2-private://tracks/generated/job/attempt.mp3', true, '71000000-0000-4000-8000-000000000001', false, '72000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000002', 'Other Track', 'Test', 'r2-private://tracks/generated/job/other.mp3', true, '71000000-0000-4000-8000-000000000002', false, '72000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000003', 'Legacy Public Track', 'Test', 'https://media.example/tracks/generated/job/legacy.mp3', true, '71000000-0000-4000-8000-000000000002', true, '72000000-0000-4000-8000-000000000001');

insert into public.generation_jobs (id, user_id, dj_id, status, track_id)
values
  ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'ready', '73000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'ready', '73000000-0000-4000-8000-000000000002'),
  ('74000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'ready', '73000000-0000-4000-8000-000000000003');

select has_table('public', 'track_experience_feedback', 'feedback table exists');
select col_is_pk('public', 'track_experience_feedback', array['user_id', 'track_id'], 'feedback has one row per user and track');
select col_not_null('public', 'track_experience_feedback', 'created_at', 'created timestamp is required');
select col_not_null('public', 'track_experience_feedback', 'updated_at', 'updated timestamp is required');
select fk_ok('public', 'track_experience_feedback', 'user_id', 'auth', 'users', 'id', 'feedback user cascades from auth user');
select fk_ok('public', 'track_experience_feedback', 'track_id', 'public', 'tracks', 'id', 'feedback track references tracks');
select is(
  (select confdeltype from pg_constraint
    where conrelid = 'public.track_experience_feedback'::regclass
      and conname = 'track_experience_feedback_user_id_fkey'),
  'c'::"char",
  'deleting an auth user cascades feedback'
);
select is(
  (select confdeltype from pg_constraint
    where conrelid = 'public.track_experience_feedback'::regclass
      and conname = 'track_experience_feedback_track_id_fkey'),
  'c'::"char",
  'deleting a track cascades feedback'
);
select is((select relrowsecurity from pg_class where oid = 'public.track_experience_feedback'::regclass), true, 'feedback RLS is enabled');
select policies_are('public', 'track_experience_feedback', array[
  'track_experience_feedback_owner_insert',
  'track_experience_feedback_owner_select',
  'track_experience_feedback_owner_update'
], 'feedback has explicit read and upsert policies');
select is(has_table_privilege('anon', 'public.track_experience_feedback', 'SELECT'), false, 'anonymous cannot read feedback');
select is(has_table_privilege('anon', 'public.track_experience_feedback', 'INSERT'), false, 'anonymous cannot insert feedback');
select is(has_table_privilege('authenticated', 'public.track_experience_feedback', 'SELECT'), true, 'authenticated can select through RLS');
select is(has_table_privilege('authenticated', 'public.track_experience_feedback', 'INSERT'), true, 'authenticated can insert through RLS');
select is(has_table_privilege('authenticated', 'public.track_experience_feedback', 'UPDATE'), true, 'authenticated can update through RLS');
select is(has_table_privilege('authenticated', 'public.track_experience_feedback', 'DELETE'), false, 'authenticated cannot delete feedback');

insert into public.track_experience_feedback(user_id, track_id, would_share)
values ('71000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into public.track_experience_feedback(user_id, track_id, surprised)
    values ('71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', true)$$,
  'owner can insert one private answer'
);
select results_eq(
  $$select track_id from public.track_experience_feedback order by track_id$$,
  $$values ('73000000-0000-4000-8000-000000000001'::uuid)$$,
  'owner selects only own feedback'
);
select lives_ok(
  $$update public.track_experience_feedback set would_share = false
    where user_id = '71000000-0000-4000-8000-000000000001'
      and track_id = '73000000-0000-4000-8000-000000000001'$$,
  'owner can update an answer while identity stays immutable'
);
select throws_ok(
  $$insert into public.track_experience_feedback(user_id, track_id, surprised)
    values ('71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', null)$$,
  '23514', null, 'row needs at least one answer'
);
select throws_ok(
  $$insert into public.track_experience_feedback(user_id, track_id, surprised)
    values ('71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', true)$$,
  '42501', null, 'owner cannot insert feedback for another user track'
);
select results_eq(
  $$update public.track_experience_feedback
    set surprised = false
    where user_id = '71000000-0000-4000-8000-000000000002'
      and track_id = '73000000-0000-4000-8000-000000000002'
    returning track_id$$,
  $$select null::uuid where false$$,
  'RLS prevents updating another owner feedback row'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.track_experience_feedback$$,
  '42501', null, 'anonymous cannot read feedback'
);
select throws_ok(
  $$insert into public.track_experience_feedback(user_id, track_id, surprised)
    values ('71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', false)$$,
  '42501', null, 'anonymous cannot write feedback'
);
reset role;

select throws_ok(
  $$update public.track_experience_feedback
    set user_id = '71000000-0000-4000-8000-000000000002'
    where track_id = '73000000-0000-4000-8000-000000000001'$$,
  '55000',
  'feedback_identity_immutable',
  'feedback identity update is rejected'
);
select is(
  (select user_id from public.track_experience_feedback where track_id = '73000000-0000-4000-8000-000000000001'),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'feedback identity remains immutable'
);

delete from public.tracks where id = '73000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.track_experience_feedback where track_id = '73000000-0000-4000-8000-000000000001'),
  0::bigint,
  'deleting a track cascades its feedback'
);

select is(has_table_privilege('authenticated', 'public.track_moment_publications', 'SELECT'), false, 'publication state is not client-readable');
select is(has_table_privilege('anon', 'public.track_moment_publications', 'SELECT'), false, 'publication state is not anonymous-readable');
select is(has_function_privilege('authenticated', 'public.claim_track_moment_publish(uuid,uuid,uuid,text)', 'EXECUTE'), false, 'authenticated cannot claim a publication directly');
select is(has_function_privilege('service_role', 'public.claim_track_moment_publish(uuid,uuid,uuid,text)', 'EXECUTE'), true, 'service role can claim through Edge');
select is(has_function_privilege('authenticated', 'public.finalize_track_moment_publish(uuid,uuid,uuid,text,text)', 'EXECUTE'), false, 'authenticated cannot finalize a publication directly');
select is(has_function_privilege('service_role', 'public.unpublish_track_moment(uuid,uuid)', 'EXECUTE'), true, 'service role can unpublish through Edge');

set local role service_role;
select results_eq(
  $$select outcome from public.claim_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000001',
    'r2-private://tracks/generated/job/other.mp3'
  )$$,
  $$values ('claimed'::text)$$,
  'first publish operation owns the serialized claim'
);
select results_eq(
  $$select outcome from public.claim_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000002',
    'r2-private://tracks/generated/job/other.mp3'
  )$$,
  $$values ('busy'::text)$$,
  'a concurrent publish operation cannot steal a live claim'
);
select is(
  public.finalize_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000002',
    'https://media.example/tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000002.mp3',
    'tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000002.mp3'
  ),
  false,
  'a losing operation cannot finalize the winner claim'
);
select is(
  public.finalize_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000001',
    'https://media.example/tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000001.mp3',
    'tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000001.mp3'
  ),
  true,
  'claim owner can finalize verified public media'
);
select is(
  (select is_public from public.tracks where id = '73000000-0000-4000-8000-000000000002'),
  true,
  'visibility becomes public only after finalization'
);
select results_eq(
  $$select outcome from public.unpublish_track_moment(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002'
  )$$,
  $$values ('unpublished'::text)$$,
  'unpublish atomically restores the retained private source'
);
select is(
  (select audio_url from public.tracks where id = '73000000-0000-4000-8000-000000000002'),
  'r2-private://tracks/generated/job/other.mp3',
  'the unpublished owner track remains playable through private media'
);
select results_eq(
  $$select outcome from public.claim_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000003',
    'r2-private://tracks/generated/job/other.mp3'
  )$$,
  $$values ('claimed'::text)$$,
  'a later retry can claim the private track'
);
select results_eq(
  $$select outcome from public.unpublish_track_moment(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002'
  )$$,
  $$values ('already_private'::text)$$,
  'private intent cancels an in-flight publish claim'
);
select is(
  public.finalize_track_moment_publish(
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000003',
    'https://media.example/tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000003.mp3',
    'tracks/generated/job/other.moment-75000000-0000-4000-8000-000000000003.mp3'
  ),
  false,
  'a cancelled publish claim cannot later re-publicize the track'
);
select results_eq(
  $$select outcome from public.unpublish_track_moment(
    '73000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-000000000002'
  )$$,
  $$values ('legacy_unsafe'::text)$$,
  'a public-only legacy track is never made private without a safe source'
);
reset role;

select * from finish();
rollback;
