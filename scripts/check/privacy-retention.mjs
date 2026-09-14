import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('privacy retention preserves recent events, history and access boundaries', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.listening_events (id integer primary key);
      insert into public.listening_events values (1);
    `);
    for (const file of [
      '20260826001421_himu_product_events.sql',
      '20260826003508_himu_product_events_append_only.sql',
      '20260910001103_privacy_product_event_retention.sql',
    ]) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    // Keep the boundary deterministic across report and application.
    await db.exec('begin');
    await db.exec(`
      insert into public.product_events
        (event_id, installation_id, session_id, event_name, occurred_at, created_at)
      select gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'intro_viewed',
        current_timestamp - interval '365 days', current_timestamp - age
      from (values (interval '91 days'), (interval '92 days'),
                   (interval '90 days'), (interval '1 day')) as fixture(age);
    `);
    const call = async (args = '') => (await db.query(
      `select public.maintain_product_event_retention(${args}) as result`,
    )).rows[0].result;

    await t.test('dry-run is the default and does not expire history or newer arrivals', async () => {
      const report = await call();
      assert.equal(report.retention_days, 90);
      assert.equal(report.eligible, 2);
      assert.equal(report.deleted, 0);
      assert.equal(report.dry_run, true);
      assert.equal((await db.query('select count(*)::int as count from public.product_events')).rows[0].count, 4);
      assert.equal((await db.query('select count(*)::int as count from public.listening_events')).rows[0].count, 1);
    });
    // Commit the deterministic boundary assertions before permission errors.
    await db.exec('commit');

    await t.test('anon and authenticated cannot invoke maintenance', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        await assert.rejects(call('true'), /permission denied/);
        await db.exec('reset role');
      }
    });
    await t.test('service role cannot bypass the append-only table grant', async () => {
      await db.exec('set role service_role');
      await assert.rejects(db.exec('delete from public.product_events'), /permission denied/);
      await db.exec('reset role');
    });
    await t.test('invalid arguments fail closed', async () => {
      for (const args of ['null', 'true, null', 'true, 0', 'true, 10001']) {
        await assert.rejects(call(args), /invalid retention arguments/);
      }
    });
    await t.test('authorized batches remove only expired events and are resumable', async () => {
      await db.exec('set role service_role');
      const first = await call('true, 1');
      assert.equal(first.deleted, 1);
      assert.equal(first.dry_run, false);
      assert.ok(first.remaining >= 1);
      const second = await call('true, 1000');
      assert.ok(second.deleted >= 1);
      assert.equal(second.remaining, 0);
      assert.equal((await call('true')).deleted, 0);
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as count from public.product_events')).rows[0].count, 1);
      assert.equal((await db.query('select count(*)::int as count from public.listening_events')).rows[0].count, 1);
    });
  } finally {
    await db.close();
  }
});
