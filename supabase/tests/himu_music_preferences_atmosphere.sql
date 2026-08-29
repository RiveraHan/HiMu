begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

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
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'preferences-a@example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'preferences-b@example.com', '', now(), '{}', '{}', now(), now());

select has_column(
  'public',
  'music_preferences',
  'atmosphere',
  'music preferences has an atmosphere column'
);
select col_type_is(
  'public',
  'music_preferences',
  'atmosphere',
  'text',
  'atmosphere is text'
);
select col_not_null(
  'public',
  'music_preferences',
  'atmosphere',
  'atmosphere is required'
);
select col_default_is(
  'public',
  'music_preferences',
  'atmosphere',
  'balanced',
  'atmosphere defaults to balanced'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.music_preferences'::regclass),
  true,
  'music preferences keeps row level security enabled'
);
select policies_are(
  'public',
  'music_preferences',
  array[
    'Users can create own preferences',
    'Users can delete own preferences',
    'Users can update own preferences',
    'Users can view own preferences'
  ],
  'music preferences keeps its ownership policies'
);
select is(
  has_table_privilege('authenticated', 'public.music_preferences', 'SELECT'),
  true,
  'authenticated keeps SELECT access'
);
select is(
  has_table_privilege('authenticated', 'public.music_preferences', 'INSERT'),
  true,
  'authenticated keeps INSERT access'
);
select is(
  has_table_privilege('authenticated', 'public.music_preferences', 'UPDATE'),
  true,
  'authenticated keeps UPDATE access'
);
select is(
  has_table_privilege('authenticated', 'public.music_preferences', 'DELETE'),
  true,
  'authenticated keeps DELETE access'
);

insert into public.music_preferences (user_id, genres, moods)
values (
  '70000000-0000-4000-8000-000000000002',
  array['Ambient'],
  array['Calm']
);
select is(
  (
    select atmosphere
    from public.music_preferences
    where user_id = '70000000-0000-4000-8000-000000000002'
  ),
  'balanced',
  'a legacy-shaped row without atmosphere reads as balanced'
);
select throws_ok(
  $$insert into public.music_preferences (user_id, atmosphere)
    values ('70000000-0000-4000-8000-000000000001', 'invalid')$$,
  '23514',
  null,
  'invalid atmosphere is rejected'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$insert into public.music_preferences (user_id, atmosphere)
    values ('70000000-0000-4000-8000-000000000001', 'calm')$$,
  'an authenticated user can insert their own preferences'
);
select results_eq(
  $$update public.music_preferences
    set atmosphere = 'intense'
    where user_id = '70000000-0000-4000-8000-000000000001'
    returning atmosphere$$,
  $$values ('intense'::text)$$,
  'an authenticated user can update their own preferences'
);
select throws_ok(
  $$insert into public.music_preferences (user_id, atmosphere)
    values ('70000000-0000-4000-8000-000000000002', 'calm')$$,
  '42501',
  null,
  'RLS rejects a cross-user insert'
);
select results_eq(
  $$update public.music_preferences
    set atmosphere = 'calm'
    where user_id = '70000000-0000-4000-8000-000000000002'
    returning atmosphere$$,
  $$select null::text where false$$,
  'RLS hides a cross-user update target'
);

select * from finish();
rollback;
