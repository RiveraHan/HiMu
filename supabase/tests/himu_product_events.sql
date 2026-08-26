begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table(
  'public',
  'product_events',
  'product events table exists'
);

select policies_are(
  'public',
  'product_events',
  array[]::text[],
  'product events exposes no client RLS policies'
);

select is(
  has_table_privilege('anon', 'public.product_events', 'SELECT'),
  false,
  'anonymous callers have no table SELECT'
);
select is(
  has_table_privilege('anon', 'public.product_events', 'INSERT'),
  false,
  'anonymous callers have no table INSERT'
);
select is(
  has_table_privilege('authenticated', 'public.product_events', 'SELECT'),
  false,
  'authenticated callers have no table SELECT'
);
select is(
  has_table_privilege('service_role', 'public.product_events', 'SELECT'),
  true,
  'service role can inspect product-event rows'
);

select is(
  has_function_privilege(
    'anon',
    'public.record_product_event(uuid,uuid,uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute the collector RPC'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.record_product_event(uuid,uuid,uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated callers cannot execute the collector RPC'
);
select is(
  has_function_privilege(
    'service_role',
    'public.record_product_event(uuid,uuid,uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ),
  true,
  'service role can execute the collector RPC'
);

set local role service_role;

select is(
  public.record_product_event(
    '60000000-0000-4000-8000-000000000001',
    null,
    '60000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000201',
    'intro_viewed',
    '{"flowVersion":2,"platform":"web","locale":"en"}'::jsonb,
    '2026-08-25 12:00:00+00'
  ),
  'accepted',
  'first event ID is accepted'
);
select is(
  public.record_product_event(
    '60000000-0000-4000-8000-000000000001',
    null,
    '60000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000201',
    'intro_viewed',
    '{}'::jsonb,
    '2026-08-25 12:00:01+00'
  ),
  'duplicate',
  'the same event ID is idempotent'
);
select is(
  (select count(*) from public.product_events where event_id = '60000000-0000-4000-8000-000000000001'),
  1::bigint,
  'a duplicate event ID does not insert a second row'
);

select throws_ok(
  $$select public.record_product_event(
    '60000000-0000-4000-8000-000000000002',
    null,
    '60000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000201',
    'intro_viewed',
    '{"lyrics":"must never be stored"}'::jsonb,
    now()
  )$$,
  '23514',
  null,
  'the table rejects creative property keys'
);
select throws_ok(
  $$select public.record_product_event(
    '60000000-0000-4000-8000-000000000003',
    null,
    '60000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000201',
    'unknown_event',
    '{}'::jsonb,
    now()
  )$$,
  '23514',
  null,
  'the table rejects unknown event names'
);

select is(
  (
    select count(*)
    from (
      select public.record_product_event(
        ('60000000-0000-4000-8001-' || lpad(sequence::text, 12, '0'))::uuid,
        null,
        '60000000-0000-4000-8000-000000000102',
        '60000000-0000-4000-8000-000000000202',
        'intro_viewed',
        '{}'::jsonb,
        now()
      ) as outcome
      from generate_series(1, 60) as sequence
    ) as results
    where outcome = 'accepted'
  ),
  60::bigint,
  'the first 60 events in a rolling minute are accepted'
);
select is(
  public.record_product_event(
    '60000000-0000-4000-8001-000000000061',
    null,
    '60000000-0000-4000-8000-000000000102',
    '60000000-0000-4000-8000-000000000202',
    'intro_viewed',
    '{}'::jsonb,
    now()
  ),
  'rate_limited',
  'the 61st event in a rolling minute is rate limited'
);

select throws_ok(
  $$select public.record_product_event(
    '60000000-0000-4000-8000-000000000004',
    null,
    '60000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000201',
    'auth_failed',
    jsonb_build_object('errorCategory', repeat('x', 5000)),
    now()
  )$$,
  '23514',
  null,
  'the table rejects properties over 4 KB'
);

select * from finish();
rollback;
