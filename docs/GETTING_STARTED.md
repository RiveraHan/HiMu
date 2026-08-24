# HiMu security deployment

## Private generated audio

HiMu stores public covers and avatars in `R2_BUCKET`. Private generated tracks
and captions must use a separate `R2_PRIVATE_BUCKET` with neither a public
custom domain nor an `r2.dev` development URL.

Set these server-only values for Supabase Edge Functions and for the migration
runner:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PRIVATE_BUCKET
R2_PUBLIC_BASE
SUPABASE_SERVICE_ROLE_KEY
EXPO_PUBLIC_SUPABASE_URL
```

Deploy the database migration and Edge Functions before moving existing media.
Always inspect a dry run first:

```sh
npm run migrate:private-media -- --dry-run --batch-size=100
npm run migrate:private-media -- --batch-size=100
npm run migrate:private-media -- --dry-run --batch-size=100
```

The final dry run must report `remaining: 0`. The runner copies and verifies an
object, conditionally changes its database reference to `r2-private://...`, and
only then deletes the public source. If a batch stops, fix the reported storage
or database issue and rerun without a cursor. `--cursor=<uuid>` is available
only for an operator-controlled resume after the earlier rows were verified.

Rollback is forward-only: leave the private bucket and opaque database
references in place, roll back application code if needed, then redeploy the
private-media resolver. Do not make the private bucket public as a rollback.
