# HiMu English and Spanish Internationalization Design

## Goal

Add complete English and neutral Latin American Spanish support to HiMu. The app follows the device language by default and lets an authenticated user override it from Settings. Language changes take effect immediately without restarting the app or signing out.

## Scope

Internationalize all user-facing client UI, including:

- Screen titles, navigation labels, buttons, forms, placeholders, helper text, empty states, and loading states.
- Alerts, confirmation dialogs, toasts, validation and error messages.
- Onboarding and guided-tour copy.
- Accessibility labels and announcements.
- Known genre labels displayed by the app.
- Dates, numbers, durations, and pluralized UI copy where applicable.

DJ names, track and playlist titles, and generated or database-authored descriptions remain in their original language. The first release supports only English (`en`) and neutral Latin American Spanish (`es`).

## Technical approach

Use `i18next` with `react-i18next` for resource lookup and reactive rendering, and `expo-localization` to read the device locale. Translation resources are separated by language and organized into namespaces or feature-oriented sections so screens do not depend on one large unstructured catalog.

An internationalization module initializes i18next before application content renders. A provider at the application root exposes the active language to all routes and shared components. English is the fallback language if a translation key is unavailable.

The supported language preference is:

```ts
type LanguagePreference = "system" | "en" | "es";
```

`system` is the default. Device locales whose language code is `es`, including regional variants such as `es-NI` and `es-MX`, resolve to neutral Spanish. All other device languages resolve to English.

## Preference persistence and precedence

The language preference becomes part of the existing `UserPreferences` object stored in the profile `preferences` JSON field. No database schema migration is required because the field is already JSON and preference merging supplies defaults for existing users.

A local copy is retained using the app's existing secure local-storage facilities. This makes the selected language available during cold starts and offline use. Resolution follows this order:

1. Apply the locally cached preference during startup.
2. If the preference is `system` or no cached value exists, resolve the current device locale.
3. After authentication and profile loading, reconcile with the profile preference and apply it.
4. A manual change updates the UI and local cache immediately, then updates the profile when a session is available.

The stored value remains `system`, rather than the currently resolved language, so a user who chooses device language continues following each device's locale.

## Settings experience

Add a Language section to Account Settings. Its row displays the resolved selection and opens the platform-appropriate picker with these choices:

- Use device language / Usar idioma del dispositivo
- English
- Español

Selecting an option updates all mounted screens immediately. No restart or reauthentication is required. The language names remain recognizable in both interfaces.

If remote persistence fails, the app keeps the locally selected language, displays a localized non-blocking error, and allows the existing query lifecycle or a later update to retry synchronization.

## Translation resources and content rules

English is the source and fallback catalog. Spanish translations use neutral Latin American wording, concise labels, and terminology consistent across the product. Brand names and product concepts such as HiMu and Vibe Check remain branded where translation would weaken recognition.

Known genre values retain their canonical internal identifiers for queries, filtering, analytics, and generation prompts. A presentation mapping translates only the displayed genre label. Unknown genres and all other dynamic content fall back to their source text instead of being machine-translated at runtime.

Translation calls use interpolation and i18next plural rules rather than string concatenation. This applies to track counts, streaks, page indicators, listening statistics, and other variable copy. Accessibility text uses the same catalog and receives equivalent meaning in both languages.

## Component boundaries

- The i18n initialization module owns supported languages, device-locale resolution, fallback behavior, and resource registration.
- Translation resource files own copy only; they contain no application logic.
- A locale controller owns preference reconciliation, local persistence, and runtime language changes.
- Existing screens and components consume translations through `useTranslation` or a narrowly scoped helper.
- A genre-label helper translates known canonical genres without changing their stored values.
- Account Settings owns only the language picker UI and delegates state changes to the locale controller.

These boundaries keep locale detection and persistence testable without rendering every screen and keep translation catalogs independent from Supabase concerns.

## Startup and data flow

1. Initialize i18next with English resources and the best immediately available language.
2. Load the cached `LanguagePreference` and resolve `system` against `expo-localization`.
3. Render the application with that resolved language.
4. When authentication and settings data become available, reconcile the remote preference.
5. On manual selection, change the active language first, persist locally, and update Supabase optimistically.

Initialization must avoid displaying raw translation keys. The local value is loaded early enough to minimize visible language changes during startup; profile reconciliation may update the language if another device changed the user's explicit preference.

## Error handling

- Missing keys fall back to English.
- Unsupported device locales fall back to English.
- Invalid stored preference values are treated as `system`.
- Local-storage read failures do not block startup; the device locale is used.
- Local-storage write or Supabase synchronization failures show a localized, non-blocking message while leaving the active selection intact.
- Dynamic content without a known translation is shown unchanged.

Development and test configuration reports missing keys so incomplete catalogs are detected before release.

## Testing and verification

Automated coverage includes:

- Device-locale resolution for `en`, Spanish regional variants, and unsupported languages.
- Defaulting and validation of old, absent, or malformed stored preferences.
- Preference precedence and reconciliation between local cache, device locale, and remote profile.
- Immediate runtime switching between English and Spanish.
- Equal key sets across the English and Spanish catalogs.
- Interpolation, plurals, and known genre presentation labels.
- Settings picker behavior and persistence failures.
- Deterministic locale setup for existing screen and onboarding tests.

Manual verification covers the principal screens in both languages, long-text wrapping, alerts and dialogs, onboarding, tab labels, accessibility labels, and switching without restarting. Final verification runs Jest, TypeScript checking, and ESLint.

## Acceptance criteria

- A first launch in a Spanish device locale renders neutral Spanish; an English or unsupported locale renders English.
- The user can select device language, English, or Spanish in Account Settings.
- Manual changes appear across the mounted app immediately and survive restart.
- Authenticated preferences synchronize through the existing profile settings and work offline from the local copy.
- All static UI and accessibility copy is available in both languages with English fallback.
- Known genre labels are localized without changing stored or transmitted values.
- Names and dynamic/generated content are never automatically translated.
- Existing users receive `system` without requiring a database migration.
