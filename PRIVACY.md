# Privacy and data handling

This describes the repository implementation, not a universal privacy notice or
a claim of legal compliance. Each deployment operator must publish its own notice
and contact information at `EXPO_PUBLIC_PRIVACY_URL` before a public beta.

## Data handled

- Google and Supabase authenticate users. Google sign-in requests profile and
  email scopes. Sessions persist in Expo SecureStore on native and localStorage
  on web.
- Supabase stores profiles, preferences, favorites, DJ ownership/configuration,
  generation jobs, and listening data used for personalization and Vibe Check.
- `listening_events` records the user, track, completed/skipped event and time.
- Product telemetry records installation/session IDs, event names, timestamps,
  and a restricted set of properties such as platform, locale, and flow outcome.
  It is separate from listening history.
- Generated audio, voices, covers, and avatars use media storage, including
  Cloudflare R2. Visibility depends on publication state and deployment setup.

## Third-party processing

The configured backend sends creative inputs to Replicate-hosted models to
produce text, music, images, or voice. Inputs can include user-provided DJ
descriptions and generation instructions; do not put sensitive information into
creative prompts. Google handles sign-in, Supabase handles authentication and
application data, and Cloudflare serves/stores generated media. Some catalog
functionality also integrates with Audius.

Provider retention, processing regions, training use, and contractual terms are
not controlled by this repository. The operator must verify and disclose the
providers and models actually enabled in its installation, including relevant
provider logs and backups. No zero-retention or no-training guarantee is made here.

## Retention and deletion

The repository now includes an opt-in maintenance function for product events
older than 90 days, with dry-run as the default. It is not scheduled automatically
and has not been applied to the hosted deployment. Listening history has no
time-based expiry. The proposed policy and activation steps are in
[PRIVACY_OPERATIONS.md](PRIVACY_OPERATIONS.md). Operators must separately define
retention for logs, backups, generation records, and storage objects; no automatic
expiry guarantee applies until those operations are configured and verified.

No self-service account deletion flow is currently implemented. Signing out does
not delete server-side data. Operators must provide a private request channel and
an administrative deletion process before offering this as a supported feature.

Deleting an owned DJ uses the `delete-dj` function: it removes database records
first, then attempts cleanup of associated R2 assets. Storage cleanup is best
effort and needs operational verification. This is not account deletion.
Listening-event rows cascade when their referenced auth user or track is deleted.
Product events instead keep their rows and set `user_id` to null on user deletion;
installation/session identifiers remain. Deleting the auth user alone therefore
does not establish complete erasure or anonymization.

## User content and publication

Ownership and access rules restrict private records; private media access needs
the configured private bucket and authenticated endpoint. Content intentionally
made public may be accessible without sign-in and copied outside the service.
Removing the source cannot recall copies already downloaded by others.
Contributors should use synthetic accounts/content in reports and demos. The
Apache 2.0 source-code license is not a blanket license for user content or model
outputs; operators must explain content rights and acceptable use in their terms.
