import { createClient } from '@supabase/supabase-js';

// No environment file is loaded implicitly. The package script opts into .env.
const args = process.argv.slice(2);
if (args.some((arg) => !['--apply', '--dry-run'].includes(arg)) ||
    (args.includes('--apply') && args.includes('--dry-run'))) {
  throw new Error('Usage: npm run privacy:retention -- [--dry-run | --apply]');
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase URL and server-only service role key are required');

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc('maintain_product_event_retention', {
  p_apply: args.includes('--apply'),
  p_batch_size: 1000,
});
if (error) {
  // Do not serialize request headers or client configuration in operational logs.
  console.error(`Retention failed (${error.code || 'unknown'}): ${error.message}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(data, null, 2));
}
