begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'raw-track-owner@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'raw-track-other@example.com', '', now(), '{}', '{}', now(), now());

insert into public.tracks (
  id, title, artist, audio_url, owner_id, is_public, source_track_id
)
values
  ('82000000-0000-4000-8000-000000000001', 'Owner private', 'HiMu', 'r2-private://tracks/generated/a.mp3', '81000000-0000-4000-8000-000000000001', false, null),
  ('82000000-0000-4000-8000-000000000002', 'Other Moment', 'HiMu', 'https://media.example/moment.mp3', '81000000-0000-4000-8000-000000000002', true, '82000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000003', 'Catalogue', 'HiMu', 'https://media.example/catalogue.mp3', null, true, null);

select is(
  has_table_privilege('anon', 'public.tracks', 'SELECT'),
  false,
  'anon has no raw tracks SELECT grant'
);
select is(
  has_table_privilege('authenticated', 'public.tracks', 'SELECT'),
  true,
  'authenticated owners retain an explicit raw tracks SELECT grant'
);
select policies_are(
  'public',
  'tracks',
  array['tracks_select_owned_or_catalog'],
  'tracks exposes only the owner-or-catalogue select policy'
);

set local role anon;
select throws_ok(
  $$select id, owner_id, source_track_id from public.tracks$$,
  '42501',
  null,
  'anon cannot enumerate public Moments or private raw metadata'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$select id from public.tracks order by id$$,
  $$values
    ('82000000-0000-4000-8000-000000000001'::uuid),
    ('82000000-0000-4000-8000-000000000003'::uuid)$$,
  'an owner reads their own raw track and signed-in catalogue rows only'
);
select results_eq(
  $$select owner_id, source_track_id
      from public.tracks
      where id = '82000000-0000-4000-8000-000000000002'$$,
  $$select null::uuid, null::uuid where false$$,
  'a public Moment never exposes another owner or its source track through Data API'
);
reset role;

select * from finish();
rollback;
