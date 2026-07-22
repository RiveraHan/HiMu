# Task 5 Report: Translate Home, Discover, Favorites, Community, and Profile

## Status

Implemented the English and Spanish `home`, `discover`, and `profile` catalogs and localized the owned browse/profile surfaces. User-, DJ-, track-, artist-, caption-, username-, email-, and Audius API genre values remain unchanged.

## RED evidence

Command:

```bash
npm test -- --runTestsByPath 'app/(app)/__tests__/home-test.tsx' 'app/(app)/__tests__/discover-test.tsx' 'app/(app)/__tests__/profile-test.tsx' 'app/(app)/__tests__/community-test.tsx' 'app/__tests__/favorites-test.tsx' 'src/utils/__tests__/format-stats-test.ts' --runInBand
```

Result before production changes: **6 suites failed**, with **7 intended failures and 35 existing tests passing**. Failures were the missing Spanish Home, Discover, Profile, Favorites, and Community copy plus Spanish decimal/compact number formatting.

## GREEN evidence

Focused feature and parity verification:

```bash
npm test -- --runTestsByPath 'app/(app)/__tests__/home-test.tsx' 'app/(app)/__tests__/discover-test.tsx' 'app/(app)/__tests__/profile-test.tsx' 'app/(app)/__tests__/community-test.tsx' 'app/__tests__/favorites-test.tsx' 'src/utils/__tests__/format-stats-test.ts' 'src/i18n/__tests__/resources-test.ts' --runInBand
```

Result: **7/7 suites passed, 43/43 tests passed**.

Fresh full Jest verification:

```bash
npm test -- --runInBand
```

Result: **37/37 suites passed, 294/294 tests passed**.

Static checks:

```bash
git diff --check
npx eslint <Task 5 production files>
npx tsc --noEmit
```

- `git diff --check`: passed.
- ESLint over the Task 5 production files: passed.
- TypeScript: the four pre-existing Home inference diagnostics in the touched screen were fixed. The command still exits 2 on two known, unrelated baseline diagnostics:
  - `app/dj/[id].tsx(381,44)`: implicit `any` for `g`.
  - `src/types/onboarding-database.ts(1,58)`: missing generated `./database` module.

## Implementation notes

- Replaced time-of-day English display constants with semantic `TimeOfDayBucket` values; Home translates each bucket headline and shelf label.
- Changed listening identity selection to return one of five semantic IDs; Profile and the shared Vibe identity card translate the title and description.
- Removed the English `Listener` fallback from `useProfile`; the hook now returns `string | null`, and Profile owns the localized fallback.
- Switched stat formatting to locale-aware `Intl.NumberFormat` compact/standard notation and passed i18next's resolved language from Home, Profile, and Vibe Check.
- Translated curated Audius shelf display titles while preserving the exact `genre` query strings.
- Kept generated Daily Drop captions and all content/entity names unmodified.

## Self-review

- Catalog parity is covered and green.
- No remaining owned UI/accessibility English literals were found in the translated surfaces/components.
- Dynamic strings use interpolation/plurals; raw content and API values are not passed through translation.
- Scope additions outside the initial file list are limited to Vibe Check formatting expectations and the shared top-genre identity display, both required consumers of the semantic/locale-aware utility changes.

## Concerns

Only the two unrelated TypeScript baseline diagnostics above remain.

## Review fixes

Addressed all Task 5 review findings:

- Added an optional `TrackCard` accessibility label and threaded per-track label generation through `ContentShelf`.
- Search results and real Audius shelf cards now expose localized `discover.playTrack` labels without altering track titles, artists, or press behavior.
- Changed only the Spanish Ambient shelf display to `Ambiental`; the Audius hook still receives the exact `Ambient` API genre.
- Expanded Discover coverage for Spanish shelf display/API separation, attribution, no-results interpolation, error/retry behavior, and search play accessibility.
- Reworked the Audius shelf coverage to exercise the real `ContentShelf` and `TrackCard` path for English and Spanish play labels and playback callbacks.
- Added exhaustive tests for all six genre-to-identity mappings, null/unknown fallbacks, case-insensitive matching, and a Spanish Profile identity title/description consumer.

### Review-fix RED evidence

Requested focused command before implementation:

```bash
npm test -- --runTestsByPath 'app/(app)/__tests__/discover-test.tsx' 'src/components/discover/__tests__/AudiusShelf-test.tsx' 'src/utils/__tests__/listening-identity-test.ts' 'app/(app)/__tests__/profile-test.tsx' 'src/i18n/__tests__/resources-test.ts' --runInBand
```

The screen suite failed on the intended `Ambiental` display assertion and missing Spanish search-card accessibility. After correcting a test-only barrel-import environment error, the isolated real shelf slice failed only on the missing English and Spanish play labels, while its loading and independent-query tests passed. The semantic identity, translated Profile consumer, and parity coverage already passed against Task 5's implementation.

### Review-fix GREEN evidence

The requested focused command passed: **5/5 suites, 35/35 tests**.

Fresh full Jest run:

```bash
npm test -- --runInBand
```

Result: **38/38 suites, 308/308 tests passed**.

`git diff --check` and scoped ESLint passed. `npx tsc --noEmit` remains limited to the same two unrelated baseline diagnostics documented above.
