# Security policy

HiMu is beta software. Security fixes target the latest `develop` revision;
older commits and forks have no separate security maintenance commitment.
Operators are responsible for updating their deployments and applying migrations.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option if private
reporting is enabled. Do not put exploit details, credentials, private media URLs,
or personal data in public issues. If private reporting is unavailable, open an
issue requesting a private security contact without disclosing the vulnerability.
Maintainers still need to enable private reporting in repository settings.

Include the affected commit/platform, reproduction steps using test data,
expected and actual behavior, impact, and a suggested fix if available. No fixed
response SLA or bounty is currently promised.

## Deployment boundaries

- Only public configuration belongs in `EXPO_PUBLIC_*`. Provider tokens, R2
  credentials, and Supabase service-role keys belong on the server.
- Apply database migrations and deploy Edge Functions together. Review RLS,
  ownership validation, quotas, and private-media access when changing either.
- Native sessions use chunked Expo SecureStore. Web sessions use localStorage;
  protect the web origin from script injection and untrusted scripts.
- Private media requires a private R2 bucket and authenticated URL issuance.
  Publicly published media can be copied by recipients.
- Never include production accounts, secrets, or private content in test fixtures,
  screenshots, CI artifacts, or bug reports.

See [PRIVACY.md](PRIVACY.md) for data handling and deletion limitations.
