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
    'visibility-a@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Visibility A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-b000-0000000000b1',
    'authenticated',
    'authenticated',
    'visibility-b@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Visibility B"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-c000-0000000000c1',
    'authenticated',
    'authenticated',
    'visibility-quota@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Visibility quota"}',
    now(),
    now()
  );

insert into public.djs (id, name, slug, owner_id, is_public)
values
  (
    '00000000-0000-4000-d000-000000000001',
    'Visibility system DJ',
    'visibility-system-dj',
    null,
    true
  ),
  (
    '00000000-0000-4000-d000-0000000000a1',
    'Visibility private DJ A',
    'visibility-private-dj-a',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-d000-0000000000b1',
    'Visibility public DJ B',
    'visibility-public-dj-b',
    '00000000-0000-4000-b000-0000000000b1',
    true
  );

insert into public.tracks (
  id, title, artist, dj_id, owner_id, is_public
)
values
  (
    '00000000-0000-4000-f000-0000000000a1',
    'Private system track A',
    'Visibility system DJ',
    '00000000-0000-4000-d000-000000000001',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-f000-0000000000a2',
    'Private DJ track A',
    'Visibility private DJ A',
    '00000000-0000-4000-d000-0000000000a1',
    '00000000-0000-4000-a000-0000000000a1',
    false
  ),
  (
    '00000000-0000-4000-f000-0000000000b1',
    'Private track under public DJ B',
    'Visibility public DJ B',
    '00000000-0000-4000-d000-0000000000b1',
    '00000000-0000-4000-b000-0000000000b1',
    false
  ),
  (
    '00000000-0000-4000-f000-000000000001',
    'Public track under private DJ A',
    'Visibility private DJ A',
    '00000000-0000-4000-d000-0000000000a1',
    null,
    true
  ),
  (
    '00000000-0000-4000-f000-000000000002',
    'Public catalog track',
    'Visibility system DJ',
    '00000000-0000-4000-d000-000000000001',
    null,
    true
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
begin
  select count(*)
  into visible_count
  from public.tracks
  where id in (
    '00000000-0000-4000-f000-0000000000a1',
    '00000000-0000-4000-f000-0000000000a2',
    '00000000-0000-4000-f000-0000000000b1',
    '00000000-0000-4000-f000-000000000001',
    '00000000-0000-4000-f000-000000000002'
  );

  if visible_count <> 4 then
    raise exception 'user A track visibility mismatch: %', visible_count;
  end if;

  if exists (
    select 1
    from public.tracks
    where id = '00000000-0000-4000-f000-0000000000b1'
  ) then
    raise exception 'user A can read user B private track under public DJ';
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
begin
  select count(*)
  into visible_count
  from public.tracks
  where id in (
    '00000000-0000-4000-f000-0000000000a1',
    '00000000-0000-4000-f000-0000000000a2',
    '00000000-0000-4000-f000-0000000000b1',
    '00000000-0000-4000-f000-000000000001',
    '00000000-0000-4000-f000-000000000002'
  );

  if visible_count <> 3 then
    raise exception 'user B track visibility mismatch: %', visible_count;
  end if;

  if exists (
    select 1 from public.tracks
    where id = '00000000-0000-4000-f000-0000000000a1'
  ) then
    raise exception 'foreign user can read private track in system DJ';
  end if;
end
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  visible_count integer;
begin
  select count(*)
  into visible_count
  from public.tracks
  where id in (
    '00000000-0000-4000-f000-0000000000a1',
    '00000000-0000-4000-f000-0000000000a2',
    '00000000-0000-4000-f000-0000000000b1',
    '00000000-0000-4000-f000-000000000001',
    '00000000-0000-4000-f000-000000000002'
  );

  if visible_count <> 2 then
    raise exception 'anon track visibility mismatch: %', visible_count;
  end if;
end
$$;

reset role;

insert into public.djs (id, name, slug, owner_id, is_public)
values (
  '00000000-0000-4000-d000-0000000000c1',
  'Quota DJ first',
  'visibility-quota-dj-first',
  '00000000-0000-4000-c000-0000000000c1',
  false
);

do $$
begin
  begin
    insert into public.djs (id, name, slug, owner_id, is_public)
    values (
      '00000000-0000-4000-d000-0000000000c2',
      'Quota DJ second',
      'visibility-quota-dj-second',
      '00000000-0000-4000-c000-0000000000c1',
      false
    );
    raise exception 'second owned DJ unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'dj_quota_reached' then
        raise exception 'owned DJ quota returned unstable message: %', sqlerrm;
      end if;
  end;
end
$$;

do $$
begin
  begin
    update public.djs
    set owner_id = '00000000-0000-4000-a000-0000000000a1'
    where id = '00000000-0000-4000-d000-000000000001';
    raise exception 'duplicate DJ owner change unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'dj_quota_reached' then
        raise exception 'DJ owner change returned unstable message: %', sqlerrm;
      end if;
  end;
end
$$;

update public.djs
set
  name = 'Quota DJ first renamed',
  owner_id = '00000000-0000-4000-c000-0000000000c1'
where id = '00000000-0000-4000-d000-0000000000c1';

insert into public.djs (id, name, slug, owner_id, is_public)
values (
  '00000000-0000-4000-d000-000000000002',
  'Visibility second system DJ',
  'visibility-second-system-dj',
  null,
  false
);

rollback;
