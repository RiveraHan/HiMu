# Privacy operations

Status: proposed policy and tested retention tooling, not an active hosted policy.
No production rows have been deleted and no recurring job has been enabled.

## Proposed retention

| Data | Proposed rule | Current implementation |
| --- | --- | --- |
| Listening history and preferences | Keep until the account owner requests deletion | No time-based purge |
| Product events | Keep for 90 days after server ingestion | Opt-in, bounded maintenance function; not scheduled |
| Generated content | Keep while owned/published; remove on an approved deletion request | DJ removal exists; account erasure requires operator work |
| Provider logs, CDN copies and backups | Operator must select and disclose periods based on actual provider settings | Not controlled by the retention function |

Before adopting this policy, designate a privacy contact, confirm the provider
settings/regions and backup expiry, and update the deployment's published privacy
notice. Do not publish an unverified deletion deadline. A public support issue is
not an appropriate place for account identifiers or deletion inventories.

## Product-event retention

Apply the retention migration first to an isolated test deployment. The migration
creates an index and a server-only function. It does not delete data, schedule a
job, or give clients DELETE access. The existing append-only service-role table
grant remains unchanged.

With server credentials in an untracked `.env`, preview the operation:

```sh
npm run privacy:retention
```

The response reports `dry_run`, the UTC cutoff, eligible rows, deleted rows, and
remaining rows. The default is always a dry run. The cutoff uses `created_at`
(server ingestion), not the client-supplied event time. Listening events and
preferences are outside this operation.

After reviewing the target deployment and preview, an operator can explicitly
apply one batch of at most 1,000 expired events:

```sh
npm run privacy:retention -- --apply
```

Repeat while `remaining` is nonzero. Each batch is transactional and safe to retry;
concurrent invocations skip locked rows. A crash rolls back the current batch.
Record only the aggregate report, execution time, and deployment identifier in
operational logs. A failed call must alert the operator, not be treated as success.

Once the policy is approved and a test deployment is verified, the operator may
schedule `select public.maintain_product_event_retention(true, 1000);` through
Supabase Cron. Choose a frequency that drains the observed daily volume, monitor
the remaining backlog, and verify expiry regularly. Scheduling and public policy
publication are separate deployment steps, not effects of this repository change.

Local verification: `npm run check:privacy-retention` runs against disposable
Postgres in PGlite, including the original event migrations, role permissions,
dry-run, cutoff boundaries, batching, invalid arguments, and history preservation.
It does not substitute for testing the hosted scheduler or provider backups.

## Account-erasure procedure

This is an operator runbook. There is no self-service account-erasure endpoint or
button yet. Do not report a request as completed after merely signing the user out,
deleting a DJ, or deleting an Auth record.

1. Receive the request privately and verify ownership through the deployment's
   authenticated support process. Resolve the exact Auth UUID and deployment;
   do not select an account only by a display name. Confirm the scope with the
   account owner before performing irreversible deletion.
2. Prevent new account activity and quiesce its in-flight generation/publication
   jobs. Revoke sessions through supported Auth administration and account for
   already-issued JWTs until expiry; token revocation alone is not an immediate
   blanket block on database access. Do not proceed while jobs can recreate data.
3. Build a restricted, temporary inventory **before** cascading database deletion:
   owned DJs/tracks, generation jobs and caption audio, avatars/covers,
   `track_moment_publications` private/public references, and every
   `track_moment_cleanup_outbox` key. Include files in Supabase Storage and R2,
   outstanding provider jobs, product-event installation/session IDs, and any
   installation-specific tables or integrations. Never commit this inventory.
4. Check ownership and references before removing media. Keep shared catalog or
   third-party resources not owned by the requester. Drain/verify pending public
   publication cleanup before deleting rows: cascading deletion also removes its
   outbox records. Verify object deletion rather than relying on `delete-dj`'s
   best-effort storage cleanup. Retain retry targets until cleanup succeeds.
5. Remove the requester's product events **before** deleting the Auth user, using
   an authorized database-maintenance role. The Auth foreign key otherwise sets
   `user_id` to null and leaves installation/session identifiers behind. Review
   unattributed events linked to the same installation carefully: shared-device
   activity may belong to other people. Do not indiscriminately delete another
   account's records. The 90-day retention job is not an immediate erasure tool.
6. Resolve records that can block cascades, notably `live_sessions.host_id`, and
   ownership/shared-content decisions. Remove any owned Supabase Storage objects
   through its Storage API before Auth deletion. Then perform the approved hard
   deletion with the Auth admin API. Do not edit managed Auth tables directly.
7. Verify absence of the Auth user, profile, owned rows, listening data, feedback,
   tracked product events, and inventoried media. Verify old credentials cannot
   access private data. Check that no pending job recreates content. Track provider
   deletion requests, CDN expiry, and backup expiry separately; do not claim they
   are complete merely because primary-database deletion succeeded.
8. Keep a minimal completion record (request reference, scope, completion date,
   unresolved provider/backup items), remove the temporary inventory according to
   the operator's support-record policy, and communicate the verified result
   privately. If restoring a backup, reapply erasure records before reopening it
   to traffic.

Self-service deletion should be built around durable cleanup/retry records that
survive account deletion and block new writes while erasure is pending. The
existing DJ cleanup outbox cascades with the owner and cannot supply that guarantee.

References: [Supabase Auth admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
and [Supabase Cron](https://supabase.com/docs/guides/cron).
