# English and Spanish Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver complete English and neutral Latin American Spanish UI support that follows the device by default and can be changed immediately from Account Settings.

**Architecture:** Initialize i18next from a small locale-resolution module, keep translation catalogs split by product area, and mount a locale controller inside the existing Query Provider. Persist `system | en | es` per authenticated user in SecureStore and in the existing profile preferences JSON, while keeping canonical music catalog and dynamic content unchanged.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9, Expo Router 6, i18next, react-i18next, expo-localization, Zustand 5, TanStack Query 5, Expo SecureStore, Jest, React Native Testing Library.

## Global Constraints

- Supported preferences are exactly `system`, `en`, and `es`.
- Spanish copy uses neutral Latin American Spanish; English remains the source and fallback language.
- Every Spanish regional locale, including `es-NI` and `es-MX`, resolves to `es`; unsupported locales resolve to `en`.
- UI language changes immediately without restart or reauthentication.
- Static UI, alerts, validation, onboarding, and accessibility copy are translated.
- Known genre and mood labels are translated for presentation only; their stored and transmitted canonical values never change.
- DJ names, track titles, playlist titles, and generated or database-authored content remain unchanged.
- Existing users default to `system`; the existing profile JSON field means no database migration is added.
- Local persistence failure never blocks startup; remote persistence failure retains the local selection and shows localized feedback.
- Preserve the pre-existing unstaged `package-lock.json` changes and inspect that diff before committing dependency updates.

---

## File structure

New core files:

- `src/i18n/types.ts` — supported-language and preference types.
- `src/i18n/locale.ts` — pure locale/preference validation and resolution.
- `src/i18n/index.ts` — i18next initialization and resource registration.
- `src/i18n/resources.ts` — typed composition of English and Spanish feature catalogs.
- `src/i18n/locales/{en,es}/{common,settings,home,discover,profile,dj,playback,onboarding}.ts` — copy owned by each product area.
- `src/i18n/catalog-labels.ts` — presentation-only genre, mood, and group-label translation.
- `src/i18n/locale-storage.ts` — per-user SecureStore serialization.
- `src/i18n/LocaleProvider.tsx` — runtime language, local/remote reconciliation, and selection API.
- `src/i18n/__tests__/*.ts(x)` — locale resolution, resource parity, catalog, storage, and provider behavior.

Existing files are modified in the task that owns their copy. Generic component labels go in `common`; screen copy goes in the corresponding feature catalog. Tests set an explicit locale through the shared Jest setup, except tests whose purpose is language switching.

---

### Task 1: Install and initialize the i18n foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `src/i18n/types.ts`
- Create: `src/i18n/locale.ts`
- Create: `src/i18n/locales/en/common.ts`
- Create: `src/i18n/locales/es/common.ts`
- Create: `src/i18n/resources.ts`
- Create: `src/i18n/index.ts`
- Create: `src/i18n/__tests__/locale-test.ts`
- Create: `src/i18n/__tests__/resources-test.ts`

**Interfaces:**
- Produces: `LanguagePreference = "system" | "en" | "es"`, `SupportedLanguage = "en" | "es"`.
- Produces: `isLanguagePreference(value: unknown): value is LanguagePreference`.
- Produces: `resolveLanguage(preference: LanguagePreference, deviceLanguageCode?: string | null): SupportedLanguage`.
- Produces: the initialized default export from `@/src/i18n`.

- [ ] **Step 1: Write failing locale and catalog-parity tests**

```ts
// src/i18n/__tests__/locale-test.ts
import { isLanguagePreference, resolveLanguage } from "../locale";

describe("locale resolution", () => {
  test.each(["es", "es-NI", "es-MX"])("maps %s to Spanish", (locale) => {
    expect(resolveLanguage("system", locale)).toBe("es");
  });

  test.each(["en", "fr", null, undefined])("falls back to English for %s", (locale) => {
    expect(resolveLanguage("system", locale)).toBe("en");
  });

  test("an explicit preference overrides the device", () => {
    expect(resolveLanguage("es", "en-US")).toBe("es");
    expect(resolveLanguage("en", "es-NI")).toBe("en");
  });

  test("accepts only supported preference values", () => {
    expect(["system", "en", "es"].every(isLanguagePreference)).toBe(true);
    expect(isLanguagePreference("fr")).toBe(false);
  });
});
```

```ts
// src/i18n/__tests__/resources-test.ts
import { en, es } from "../resources";

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : leafKeys(child, path);
  });
}

test("English and Spanish expose the same translation keys", () => {
  expect(leafKeys(es).sort()).toEqual(leafKeys(en).sort());
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- src/i18n/__tests__/locale-test.ts src/i18n/__tests__/resources-test.ts`

Expected: FAIL because `locale`, `resources`, and language catalogs do not exist.

- [ ] **Step 3: Install compatible dependencies without discarding the existing lockfile diff**

Run:

```bash
git diff -- package-lock.json
npx expo install expo-localization
npm install i18next react-i18next
```

Expected: `package.json` contains all three dependencies and `package-lock.json` retains its earlier `devOptional` changes plus the new packages. Add `"expo-localization"` to the Expo `plugins` array in `app.json`.

- [ ] **Step 4: Implement pure types and resolution**

```ts
// src/i18n/types.ts
export const LANGUAGE_PREFERENCES = ["system", "en", "es"] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];
export type SupportedLanguage = Exclude<LanguagePreference, "system">;
```

```ts
// src/i18n/locale.ts
import { LANGUAGE_PREFERENCES, type LanguagePreference, type SupportedLanguage } from "./types";

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === "string" && LANGUAGE_PREFERENCES.includes(value as LanguagePreference);
}

export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode?: string | null,
): SupportedLanguage {
  if (preference !== "system") return preference;
  return deviceLanguageCode?.toLowerCase().split("-")[0] === "es" ? "es" : "en";
}
```

- [ ] **Step 5: Add the first typed resources and initialize i18next**

Both common catalogs must contain the same keys: `actions.back`, `actions.close`, `actions.cancel`, `actions.confirm`, `actions.retry`, `actions.dismiss`, `actions.play`, `actions.pause`, `actions.next`, `actions.previous`, `actions.remove`, `states.loading`, `states.empty`, `errors.generic`, and `errors.savePreference`. Spanish values are `Atrás`, `Cerrar`, `Cancelar`, `Confirmar`, `Reintentar`, `Descartar`, `Reproducir`, `Pausar`, `Siguiente`, `Anterior`, `Eliminar`, `Cargando`, `Sin contenido`, `Algo salió mal. Inténtalo de nuevo.` and `No pudimos sincronizar tu preferencia. Se conservará en este dispositivo.`

```ts
// src/i18n/resources.ts
import { common as enCommon } from "./locales/en/common";
import { common as esCommon } from "./locales/es/common";

export const en = { common: enCommon } as const;
export const es = { common: esCommon } as const;
export const resources = { en: { translation: en }, es: { translation: es } } as const;
```

```ts
// src/i18n/index.ts
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveLanguage } from "./locale";
import { resources } from "./resources";

const deviceLanguageCode = getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage("system", deviceLanguageCode),
  fallbackLng: "en",
  supportedLngs: ["en", "es"],
  interpolation: { escapeValue: false },
  returnNull: false,
  saveMissing: __DEV__,
  missingKeyHandler: (_languages, _namespace, key) => {
    if (__DEV__) console.warn(`[i18n] Missing translation: ${key}`);
  },
});

export default i18n;
```

- [ ] **Step 6: Verify GREEN and type safety**

Run: `npm test -- src/i18n/__tests__/locale-test.ts src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: both suites PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json package-lock.json app.json src/i18n
git commit -m "feat: initialize English and Spanish localization"
```

---

### Task 2: Persist and reconcile the language preference

**Files:**
- Modify: `src/types/preferences.ts`
- Modify: `src/hooks/use-settings.ts`
- Create: `src/i18n/locale-storage.ts`
- Create: `src/i18n/LocaleProvider.tsx`
- Create: `src/i18n/use-locale.ts`
- Modify: `app/_layout.tsx`
- Create: `src/i18n/__tests__/locale-storage-test.ts`
- Create: `src/i18n/__tests__/LocaleProvider-test.tsx`
- Create: `src/types/__tests__/preferences-test.ts`

**Interfaces:**
- Consumes: `LanguagePreference`, `resolveLanguage`, initialized `i18n`.
- Produces: `UserPreferences.language: LanguagePreference` with default `system`.
- Produces: `StoredLanguageState = { preference: LanguagePreference; pendingSync: boolean }`.
- Produces: `readLanguageState(userId: string)` and `writeLanguageState(userId: string, state: StoredLanguageState)`.
- Produces: `useLocale(): { preference; resolvedLanguage; setPreference; isSaving }`.

- [ ] **Step 1: Write failing preference migration tests**

```ts
import { DEFAULT_PREFERENCES, mergePreferences } from "../preferences";

test("existing profiles default to device language", () => {
  expect(mergePreferences({ audio: {}, notifications: {} }).language).toBe("system");
  expect(DEFAULT_PREFERENCES.language).toBe("system");
});

test("validates stored language preferences", () => {
  expect(mergePreferences({ language: "es" }).language).toBe("es");
  expect(mergePreferences({ language: "fr" }).language).toBe("system");
});
```

- [ ] **Step 2: Run the migration test and confirm RED**

Run: `npm test -- src/types/__tests__/preferences-test.ts`

Expected: FAIL because `language` is not part of `UserPreferences`.

- [ ] **Step 3: Extend preferences with validation**

Add `language: LanguagePreference` to `UserPreferences`, set `DEFAULT_PREFERENCES.language` to `system`, and return `isLanguagePreference(preferences.language) ? preferences.language : "system"` from `mergePreferences`. Keep the existing audio and notification merge behavior unchanged.

- [ ] **Step 4: Write failing local-storage tests**

Mock `secureStorage` and assert these exact behaviors: the key is `himu:language:<userId>`; absent, malformed, and invalid values return `null`; valid `{ "preference": "es", "pendingSync": true }` round-trips; a storage exception returns `null` rather than rejecting.

- [ ] **Step 5: Run the storage test and confirm RED**

Run: `npm test -- src/i18n/__tests__/locale-storage-test.ts`

Expected: FAIL because `locale-storage.ts` does not exist.

- [ ] **Step 6: Implement safe per-user storage**

```ts
export type StoredLanguageState = {
  preference: LanguagePreference;
  pendingSync: boolean;
};

const keyFor = (userId: string) => `himu:language:${userId}`;

export async function readLanguageState(userId: string): Promise<StoredLanguageState | null> {
  try {
    const raw = await secureStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (!isLanguagePreference(candidate.preference) || typeof candidate.pendingSync !== "boolean") return null;
    return { preference: candidate.preference, pendingSync: candidate.pendingSync };
  } catch {
    return null;
  }
}
```

`writeLanguageState` serializes the same shape and lets the caller handle write errors so the provider can show feedback.

- [ ] **Step 7: Write failing provider behavior tests**

Mock `getLocales`, `useSettings`, `useUpdateSettings`, local storage, and `i18n.changeLanguage`. Verify:

- no authenticated user resolves `system` from the device;
- a cached explicit preference is applied before remote settings;
- a remote preference replaces a clean cached preference;
- a cached `pendingSync: true` preference is retained and retried instead of being replaced;
- `setPreference("es")` changes i18next before awaiting local or remote writes;
- a local write failure retains Spanish, continues the remote update, and emits `common.errors.savePreference`;
- a remote failure retains Spanish, stores `pendingSync: true`, and emits `common.errors.savePreference` through the toast store;
- a successful retry stores `pendingSync: false`.

- [ ] **Step 8: Run the provider test and confirm RED**

Run: `npm test -- src/i18n/__tests__/LocaleProvider-test.tsx`

Expected: FAIL because the provider and hook do not exist.

- [ ] **Step 9: Implement the provider and root integration**

`LocaleProvider` reads the current user ID, existing settings query, and `mutateAsync` from `useUpdateSettings`. It derives the device language from `getLocales()[0]?.languageCode`. On user change it briefly withholds its children until `himu:language:<userId>` has been read, preventing an authenticated screen from flashing in the wrong cached language. When remote settings arrive it uses the remote preference only when the local record is not pending. `setPreference` performs this order: update React state, call `i18n.changeLanguage(resolveLanguage(next, deviceLanguageCode))`, write `{ preference: next, pendingSync: true }`, update `{ ...settings, language: next }`, then write `{ preference: next, pendingSync: false }` on success. A failure leaves the pending record and active language intact.

Catch local and remote persistence errors independently. A local write error must not prevent the Supabase update, and either error calls `useToastStore.getState().show("error", i18n.t("common.errors.generic"), i18n.t("common.errors.savePreference"))` without reverting the active language.

Mount it in the existing order:

```tsx
<QueryProvider>
  <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthInitializer>
      <LocaleProvider>
        <PlayerProvider>
          <AppTourProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="account-settings" />
              <Stack.Screen name="preferences" />
              <Stack.Screen name="favorites" />
              <Stack.Screen name="vibe-check" />
              <Stack.Screen name="dj/[id]" />
              <Stack.Screen name="focus-mode" options={{ animation: "fade" }} />
              <Stack.Screen name="create-dj" />
              <Stack.Screen name="train-dj/[id]" />
            </Stack>
            <MiniPlayer />
          </AppTourProvider>
          <ToastHost />
          <ConfirmDialogHost />
        </PlayerProvider>
      </LocaleProvider>
    </AuthInitializer>
    <StatusBar style="light" />
  </GestureHandlerRootView>
</QueryProvider>
```

Import `@/src/i18n` before rendering routes. Keep `ToastHost` under the provider; direct use of `useToastStore.getState().show` allows synchronization errors to surface without provider-order coupling.

- [ ] **Step 10: Verify the complete persistence slice**

Run: `npm test -- src/types/__tests__/preferences-test.ts src/i18n/__tests__/locale-storage-test.ts src/i18n/__tests__/LocaleProvider-test.tsx && npx tsc --noEmit`

Expected: all suites PASS and TypeScript exits 0.

- [ ] **Step 11: Commit preference persistence**

```bash
git add app/_layout.tsx src/types/preferences.ts src/types/__tests__/preferences-test.ts src/hooks/use-settings.ts src/i18n/LocaleProvider.tsx src/i18n/use-locale.ts src/i18n/locale-storage.ts src/i18n/__tests__
git commit -m "feat: persist and synchronize language preference"
```

---

### Task 3: Add the language selector to Account Settings

**Files:**
- Create: `src/i18n/locales/en/settings.ts`
- Create: `src/i18n/locales/es/settings.ts`
- Modify: `src/i18n/resources.ts`
- Modify: `app/account-settings.tsx`
- Create: `app/__tests__/account-settings-test.tsx`

**Interfaces:**
- Consumes: `useLocale()` and existing `useSettings()`.
- Produces: Account Settings picker for `system`, `en`, and `es`.

- [ ] **Step 1: Write the failing settings interaction test**

Render Account Settings with `useLocale` returning `system`. Assert the row is labeled `Language`, its value is `Device language (English)`, and pressing it calls `Alert.alert` with `Use device language`, `English`, `Español`, and `Cancel`. Invoke the Spanish option and expect `setPreference("es")`.

- [ ] **Step 2: Run the settings test and confirm RED**

Run: `npm test -- app/__tests__/account-settings-test.tsx`

Expected: FAIL because there is no language row.

- [ ] **Step 3: Add complete settings catalogs**

Define matching keys for `header.title`, `header.subtitle`, `sections.account`, `sections.language`, `sections.audio`, `sections.notifications`, `sections.devices`, `email`, `subscription`, `free`, `lossless`, `losslessDescription`, `downloadQuality`, `quality.low`, `quality.high`, `quality.lossless`, `push`, `pushDescription`, `newsletters`, `newslettersDescription`, `currentDevice`, `thisDevice`, `signOut`, `signOutQuestion`, `language.label`, `language.system`, `language.systemResolved`, `language.en`, and `language.es`. Spanish uses `Ajustes`, `Administra tu experiencia en HiMu`, `Información de la cuenta`, `Idioma`, `Calidad de audio`, `Notificaciones`, `Dispositivos conectados`, `Correo electrónico`, `Suscripción`, `Gratis`, `Alta fidelidad sin pérdida`, `Transmite a 24 bits/192 kHz`, `Calidad de descarga`, `Baja (96 kbps)`, `Alta (256 kbps)`, `Sin pérdida`, `Notificaciones push`, `Nuevos lanzamientos y estadísticas de escucha`, `Boletines por correo`, `Resúmenes semanales seleccionados`, `Dispositivo actual`, `Este dispositivo`, `Cerrar sesión`, `¿Seguro que quieres cerrar sesión?`, `Idioma`, `Usar idioma del dispositivo`, `Idioma del dispositivo ({{language}})`, `English`, and `Español`.

- [ ] **Step 4: Implement the picker and replace every settings literal**

Use `Languages` from `lucide-react-native`, `useTranslation`, and `useLocale`. Replace `QUALITY_LABELS` with translated lookups inside the component. Add the Language section before Audio Quality. Its value is `t("settings.language.systemResolved", { language: t(`settings.language.${resolvedLanguage}`) })` for `system`, otherwise the chosen language name. `Alert.alert` uses the translated section title and calls `setPreference` for each non-cancel option. Translate the sign-out confirmation, accessibility label, device fallback, and all existing section copy.

- [ ] **Step 5: Verify both languages**

Run: `npm test -- app/__tests__/account-settings-test.tsx src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: settings test and resource parity PASS.

- [ ] **Step 6: Commit the settings UI**

```bash
git add app/account-settings.tsx app/__tests__/account-settings-test.tsx src/i18n/locales/en/settings.ts src/i18n/locales/es/settings.ts src/i18n/resources.ts
git commit -m "feat: add language picker to settings"
```

---

### Task 4: Translate the app shell, authentication, and shared components

**Files:**
- Modify: `src/i18n/locales/en/common.ts`
- Modify: `src/i18n/locales/es/common.ts`
- Modify: `app/(app)/_layout.tsx`
- Modify: `app/(auth)/login.tsx`
- Create: `app/(auth)/__tests__/login-i18n-test.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/Toast.tsx`
- Modify: `src/components/ScreenHeader.tsx`
- Modify: `src/components/MiniPlayer.tsx`
- Modify: `src/components/TrackCard.tsx`
- Modify: `src/components/PlaylistCard.tsx`
- Modify: `src/components/IconButton.tsx`
- Modify: `src/components/GlassInput.tsx`
- Modify: `src/components/preferences/Chip.tsx`
- Modify: `src/components/settings/Toggle.tsx`
- Modify: `src/components/settings/SettingsInfoRow.tsx`
- Modify: `src/components/settings/SettingsToggleRow.tsx`
- Modify: `src/components/profile/SettingsRow.tsx`
- Modify: `src/hooks/use-confirm.ts`
- Modify: `src/stores/confirm-store.ts`
- Modify: `jest.setup.js`
- Create: `src/components/__tests__/shared-i18n-test.tsx`

**Interfaces:**
- Consumes: `useTranslation()` and the initialized global i18n instance.
- Produces: localized shared controls and a deterministic English test environment.

- [ ] **Step 1: Write failing shared-control tests**

Render `ScreenHeader`, `MiniPlayer`, `ToastHost`, and a removable `Chip` after `i18n.changeLanguage("es")`. Assert `Atrás`, `Pausar` or `Reproducir` according to mocked state, `Descartar`, and `Eliminar <label>` are exposed as accessibility labels. Add a tab-layout assertion that Discover exposes `Descubrir`. Render Login and assert `Bienvenido a HiMu`, `Continuar con Google`, and `Iniciar sesión con correo`.

- [ ] **Step 2: Run the shared test and confirm RED**

Run: `npm test -- src/components/__tests__/shared-i18n-test.tsx app/'(app)'/__tests__/layout-test.tsx app/'(auth)'/__tests__/login-i18n-test.tsx`

Expected: FAIL because shared labels are hard-coded in English.

- [ ] **Step 3: Extend common catalogs with shell and authentication copy**

Add matching keys for `navigation.home`, `navigation.discover`, `navigation.profile`, `player.open`, `player.close`, `player.shuffle`, `player.repeat`, `favorites.add`, `favorites.remove`, `auth.welcome`, `auth.subtitle`, `auth.spotify`, `auth.google`, `auth.email`, `auth.or`, `auth.accountPrompt`, `auth.signUp`, `auth.terms`, `auth.privacy`, `auth.comingSoonTitle`, and `auth.comingSoonMessage`. Use `Inicio`, `Descubrir`, `Perfil`, `Abrir reproductor`, `Cerrar reproductor`, `Aleatorio`, `Repetir`, `Guardar en favoritos`, `Quitar de favoritos`, `Bienvenido a HiMu`, `Tu música, presentada por DJs con IA.`, `Continuar con Spotify`, `Continuar con Google`, `Iniciar sesión con correo`, `O`, `¿No tienes una cuenta?`, `Regístrate`, `Términos`, `Privacidad`, `Próximamente`, and `Esta función estará disponible pronto.` for Spanish.

- [ ] **Step 4: Replace shell and component literals**

Call `useTranslation` at component boundaries and pass translated labels into leaf controls. Keep dynamic title, artist, email, and device values unchanged. Change `confirm-store` so `confirmLabel` and `cancelLabel` stay optional in pending state; `ConfirmDialog` resolves missing labels with `t("common.actions.confirm")` and `t("common.actions.cancel")`, while caller-provided text remains authoritative. For `Chip`, translate the removable-label template with `{ label }`. For tabs, set localized `tabBarAccessibilityLabel` on Home, Discover, and Profile.

- [ ] **Step 5: Make Jest deterministic**

Mock `expo-localization.getLocales` to return `[{ languageCode: "en", languageTag: "en-US", regionCode: "US", textDirection: "ltr", digitGroupingSeparator: ",", decimalSeparator: ".", measurementSystem: "us", temperatureUnit: "fahrenheit", currencyCode: "USD", currencySymbol: "$" }]`, import `src/i18n`, and reset `i18n.changeLanguage("en")` in `beforeEach`.

- [ ] **Step 6: Verify the shared layer**

Run: `npm test -- src/components/__tests__/shared-i18n-test.tsx app/'(app)'/__tests__/layout-test.tsx app/'(auth)'/__tests__/login-i18n-test.tsx && npx tsc --noEmit`

Expected: both suites PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the shared layer**

```bash
git add jest.setup.js app/'(app)'/_layout.tsx app/'(auth)'/login.tsx src/components src/i18n/locales/en/common.ts src/i18n/locales/es/common.ts
git commit -m "feat: translate app shell and shared controls"
```

---

### Task 5: Translate Home, Discover, Favorites, Community, and Profile

**Files:**
- Create: `src/i18n/locales/en/home.ts`
- Create: `src/i18n/locales/es/home.ts`
- Create: `src/i18n/locales/en/discover.ts`
- Create: `src/i18n/locales/es/discover.ts`
- Create: `src/i18n/locales/en/profile.ts`
- Create: `src/i18n/locales/es/profile.ts`
- Modify: `src/i18n/resources.ts`
- Modify: `app/(app)/index.tsx`
- Modify: `app/(app)/discover.tsx`
- Modify: `app/(app)/profile.tsx`
- Modify: `app/(app)/community.tsx`
- Create: `app/(app)/__tests__/community-test.tsx`
- Modify: `app/favorites.tsx`
- Modify: `src/components/home/ContentShelf.tsx`
- Modify: `src/components/home/OnAirHero.tsx`
- Modify: `src/components/home/VibeSpotlightCard.tsx`
- Modify: `src/components/home/CaptionVoiceButton.tsx`
- Modify: `src/components/discover/AudiusShelf.tsx`
- Modify: `src/utils/home-curation.ts`
- Modify: `src/utils/listening-identity.ts`
- Modify: `src/utils/format-stats.ts`
- Modify: `src/hooks/use-profile.ts`
- Create: `src/utils/__tests__/format-stats-test.ts`
- Modify: `app/(app)/__tests__/home-test.tsx`
- Modify: `app/(app)/__tests__/discover-test.tsx`
- Modify: `app/(app)/__tests__/profile-test.tsx`
- Modify: `app/__tests__/favorites-test.tsx`

**Interfaces:**
- Produces: feature catalogs `home`, `discover`, and `profile`.
- Produces: semantic `TimeOfDayBucket` and listening-identity IDs rather than English display strings.

- [ ] **Step 1: Add failing Spanish screen assertions**

Set i18n to Spanish within each suite and assert: Home renders `Buenos días`, `Tus DJs`, and `Tu entorno sonoro te espera.`; Discover renders `Descubrir`, `Música real de artistas independientes`, and `Buscar en Audius…`; Profile renders `PREFERENCIAS`, `Detalles de la cuenta`, `Oyente`, and `Cerrar sesión`; Favorites renders `Favoritos`; Community renders `Comunidad (próximamente)`.

- [ ] **Step 2: Run the five screen suites and confirm RED**

Run: `npm test -- app/'(app)'/__tests__/home-test.tsx app/'(app)'/__tests__/discover-test.tsx app/'(app)'/__tests__/profile-test.tsx app/'(app)'/__tests__/community-test.tsx app/__tests__/favorites-test.tsx`

Expected: FAIL on the new Spanish assertions.

- [ ] **Step 3: Define complete feature catalogs**

The Home catalog covers greetings, hero states, Daily Drop, Your DJs, Fresh Frequencies, Favorites, AI Mixes, time-of-day headlines/labels, empty states, buttons, Vibe Check summary, Focus Mode, and related accessibility copy. The Discover catalog covers heading/subheading, Audius search/results/error/retry/attribution, curated shelf titles, and play actions. The Profile catalog covers tier labels, anonymous fallback, Vibe Check, hours/tracks/DJs, listening identities, preferences, account/music/subscription/tour/logout rows, logout confirmation, favorites, and community.

Use i18next plurals such as `tracks_one: "{{count}} track"`, `tracks_other: "{{count}} tracks"`, `tracks_one: "{{count}} canción"`, and `tracks_other: "{{count}} canciones"`. Translate known shelf headings but do not translate track, artist, DJ, playlist, or generated caption values.

- [ ] **Step 4: Return semantic identifiers from utilities**

Keep `TIME_OF_DAY_MOODS` canonical. Remove English `TIME_OF_DAY_HEADLINES` and `TIME_OF_DAY_LABELS`; screens translate `home.timeOfDay.${bucket}.headline` and `.label`. Change `getListeningIdentity` to return `{ id: "etherealArchitect" | "pulseDriver" | "modernRomantic" | "stillMind" | "soundExplorer" }`, then translate `profile.identities.${id}.title` and `.description` in Profile.

Remove the English `"Listener"` fallback from `useProfile`; return `name: string | null` when profile and identity metadata have no name. Profile renders `t("profile.listener")` for the missing value, keeping actual profile and identity-metadata names unchanged.

Add a failing `format-stats-test.ts` assertion that `formatHours(1.5, "en")` returns `1.5`, `formatHours(1.5, "es")` returns `1,5`, and large counts use locale-aware compact notation. Update `formatCount(value, language)` and `formatHours(value, language)` to use `Intl.NumberFormat(language, { maximumFractionDigits: 1, notation: value >= 1000 ? "compact" : "standard" })`; pass `resolvedLanguage` from Home, Profile, and Vibe Check. Timer and seek values remain clock notation (`mm:ss`) in both languages.

- [ ] **Step 5: Replace all listed UI and accessibility literals**

Use `t()` at the relevant component boundary. Convert query-dependent text to interpolation, including `No results on Audius for “{{query}}”.` and profile metric labels. Translate curated Audius shelf display titles while preserving each `genre` API value. Preserve `drop.caption`, DJ names, track titles, usernames, and email addresses unchanged.

- [ ] **Step 6: Verify feature screens and resource parity**

Run: `npm test -- app/'(app)'/__tests__/home-test.tsx app/'(app)'/__tests__/discover-test.tsx app/'(app)'/__tests__/profile-test.tsx app/'(app)'/__tests__/community-test.tsx app/__tests__/favorites-test.tsx src/utils/__tests__/format-stats-test.ts src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: all suites PASS and TypeScript exits 0.

- [ ] **Step 7: Commit browse and profile translations**

```bash
git add app/'(app)' app/favorites.tsx app/__tests__/favorites-test.tsx src/components/home src/components/discover src/hooks/use-profile.ts src/utils/home-curation.ts src/utils/listening-identity.ts src/utils/format-stats.ts src/utils/__tests__/format-stats-test.ts src/i18n
git commit -m "feat: translate discovery and profile surfaces"
```

---

### Task 6: Translate music preferences and DJ creation, training, and profile

**Files:**
- Create: `src/i18n/locales/en/dj.ts`
- Create: `src/i18n/locales/es/dj.ts`
- Modify: `src/i18n/resources.ts`
- Create: `src/i18n/catalog-labels.ts`
- Create: `src/i18n/__tests__/catalog-labels-test.ts`
- Modify: `app/preferences.tsx`
- Modify: `app/create-dj.tsx`
- Modify: `app/train-dj/[id].tsx`
- Modify: `app/dj/[id].tsx`
- Create: `app/__tests__/preferences-i18n-test.tsx`
- Create: `app/__tests__/create-dj-i18n-test.tsx`
- Create: `app/__tests__/train-dj-i18n-test.tsx`
- Modify: `src/components/dj/DjBirthOverlay.tsx`
- Modify: `src/components/dj/DjTraitsForm.tsx`
- Modify: `src/components/dj/GeneratingTrackCard.tsx`
- Modify: `src/components/dj/DjHero.tsx`
- Modify: `src/components/preferences/GroupedChipPicker.tsx`
- Modify: `app/dj/__tests__/dj-profile-test.tsx`

**Interfaces:**
- Produces: `catalogLabel(value: string, language: SupportedLanguage): string`.
- Produces: `catalogGroupLabel(value: string, language: SupportedLanguage): string`.
- Preserves canonical `GENRE_GROUPS`, `MOOD_GROUPS`, selected arrays, query values, and mutation payloads.

- [ ] **Step 1: Write failing catalog-label tests**

```ts
expect(catalogLabel("Ambient", "es")).toBe("Ambiental");
expect(catalogLabel("Late Night", "es")).toBe("Noche");
expect(catalogLabel("Techno", "es")).toBe("Techno");
expect(catalogLabel("Unknown Style", "es")).toBe("Unknown Style");
expect(catalogGroupLabel("Chill & Ambient", "es")).toBe("Relajado y ambiental");
```

In the three new screen suites, set Spanish and assert `Preferencias musicales`, `Afinidad de géneros`, `Crear tu DJ`, `Dar vida a mi DJ`, `Entrenar tu DJ`, and `Guardar cambios`. Extend the DJ profile suite with `DJ no encontrado`, `CANCIONES`, `GÉNEROS`, `Generar una mezcla nueva`, and the one/many delete-confirmation variants.

- [ ] **Step 2: Run catalog and DJ suites and confirm RED**

Run: `npm test -- src/i18n/__tests__/catalog-labels-test.ts app/dj/__tests__/dj-profile-test.tsx app/__tests__/preferences-i18n-test.tsx app/__tests__/create-dj-i18n-test.tsx app/__tests__/train-dj-i18n-test.tsx`

Expected: catalog suite fails because its module is absent; new Spanish DJ assertions fail.

- [ ] **Step 3: Implement explicit presentation maps**

Create read-only English and Spanish maps for every group and item exported by `GENRE_GROUPS` and `MOOD_GROUPS`. Spanish examples include `Chill & Ambient → Relajado y ambiental`, `Classical & Cinematic → Clásica y cinematográfica`, `Jazz & Soul → Jazz y soul`, `Indie & Folk → Indie y folk`, `Global → Global`, `Ambient → Ambiental`, `Drone → Drone`, `Lo-Fi → Lo-fi`, `Downtempo → Downtempo`, `Trip-Hop → Trip-hop`, `Minimal Techno → Techno minimal`, `Deep House → House profundo`, `Drum & Bass → Drum and bass`, `Neo-Classical → Neoclásica`, `Classical → Clásica`, `Piano → Piano`, `Cinematic → Cinemática`, `Blues → Blues`, `Soul → Soul`, `Latin Pop → Pop latino`, `Latin Jazz → Jazz latino`, `Post-Rock → Post-rock`, `Dream Pop → Dream pop`, `Folk → Folk`, `Acoustic → Acústica`, `World → Músicas del mundo`, `Focus → Concentración`, `Relax → Relajación`, `Dreamy → Soñador`, `Meditate → Meditación`, `Nature → Naturaleza`, `Sleep → Sueño`, `Cozy → Acogedor`, `Ethereal → Etéreo`, `Energetic → Enérgico`, `Uplifting → Inspirador`, `Happy → Alegre`, `Playful → Juguetón`, `Groovy → Con ritmo`, `Party → Fiesta`, `Workout → Entrenamiento`, `Dark → Oscuro`, `Melancholic → Melancólico`, `Romantic → Romántico`, `Nostalgic → Nostálgico`, `Mysterious → Misterioso`, `Epic → Épico`, `Intense → Intenso`, `Late Night → Noche`, and `Rainy Day → Día lluvioso`. Values not in the map return unchanged.

- [ ] **Step 4: Define complete DJ and preference catalogs**

Cover Music Preferences headings, sliders, excluded moods, group accessibility, removable chips, create/train headings, identity/genres/moods/energy/sound/vibe form labels, examples, validation, generation lifecycle, quota and generic errors, delete confirmation, resident/owned badges, track and genre counts with plurals, original-lyrics labels, and all DJ profile actions. Spanish uses consistent `DJ`, `mezcla`, `géneros`, `estados de ánimo`, `energía`, `sonido`, `letra original`, `Crear tu DJ`, `Entrenar tu DJ`, `Dar vida a mi DJ`, and `Generar una mezcla nueva` terminology.

- [ ] **Step 5: Localize presentation while retaining canonical values**

Add optional `getGroupLabel` and `getItemLabel` props to `GroupedChipPicker`. Account and DJ forms pass `catalogGroupLabel(value, resolvedLanguage)` and `catalogLabel(value, resolvedLanguage)` for display/accessibility only. `onToggle` continues receiving the original string. DJ profile chips use the same helper. Translate all listed screen and component static literals with `t()` and use i18next plurals for tracks and genres.

- [ ] **Step 6: Verify DJ and catalog behavior**

Run: `npm test -- src/i18n/__tests__/catalog-labels-test.ts app/dj/__tests__/dj-profile-test.tsx app/__tests__/preferences-i18n-test.tsx app/__tests__/create-dj-i18n-test.tsx app/__tests__/train-dj-i18n-test.tsx src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: all suites PASS; tests confirm mutation callbacks still receive canonical English catalog values.

- [ ] **Step 7: Commit DJ and catalog translations**

```bash
git add app/preferences.tsx app/create-dj.tsx app/train-dj app/dj src/components/dj src/components/preferences/GroupedChipPicker.tsx src/i18n
git commit -m "feat: translate DJ and music preference flows"
```

---

### Task 7: Translate player, focus mode, and Vibe Check

**Files:**
- Create: `src/i18n/locales/en/playback.ts`
- Create: `src/i18n/locales/es/playback.ts`
- Modify: `src/i18n/resources.ts`
- Modify: `app/player.tsx`
- Modify: `app/focus-mode.tsx`
- Modify: `app/vibe-check.tsx`
- Modify: `src/components/player/SeekBar.tsx`
- Modify: `src/components/focus/FocusOrb.tsx`
- Modify: `src/components/focus/FocusAtmosphere.tsx`
- Modify: `src/components/vibe/TopGenreCard.tsx`
- Modify: `src/components/vibe/VibeAreaChart.tsx`
- Modify: `src/components/vibe/TopDjRow.tsx`
- Modify: `src/utils/vibe-stats.ts`
- Modify: `app/__tests__/vibe-check-test.tsx`
- Create: `app/__tests__/player-i18n-test.tsx`
- Create: `app/__tests__/focus-mode-i18n-test.tsx`

**Interfaces:**
- Consumes: `catalogLabel` for known genres.
- Produces: localized playback controls, focus lifecycle, chart labels, metrics, and errors.

- [ ] **Step 1: Write failing Spanish playback assertions**

Assert Player exposes `Cerrar reproductor`, `Regenerar portada`, `Guardar en favoritos`, `Aleatorio`, `Pista anterior`, `Pausar`, `Siguiente`, and `Repetir`. Assert Focus Mode exposes `Finalizar sesión de concentración` and localized running/paused/completed copy. Assert Vibe Check renders `Tu evolución sonora esta semana.`, `Esta semana`, and pluralized `0 canciones · racha de 0 días`.

- [ ] **Step 2: Run the three suites and confirm RED**

Run: `npm test -- app/__tests__/player-i18n-test.tsx app/__tests__/focus-mode-i18n-test.tsx app/__tests__/vibe-check-test.tsx`

Expected: FAIL on Spanish copy and accessibility labels.

- [ ] **Step 3: Define the playback catalog**

Add matching sections for player source labels, cover regeneration success/failure, favorite actions, transport controls, repeat modes, focus title/status/actions/session completion, Vibe Check title/subtitle/resonance/mostly genre/this week/hours/tracks/streak/week-over-week/top genres/top DJs/empty state, weekday abbreviations, and chart accessibility. Use i18next plural forms for songs, hours, days, and streaks.

- [ ] **Step 4: Make vibe data locale-independent**

Replace `DayPoint.label` with `weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`. `buildVibeCheck` emits weekday IDs and chart rendering resolves `playback.vibe.weekdays.${point.weekday}`. Keep ISO dates and all calculations unchanged.

- [ ] **Step 5: Replace all playback, focus, and insight literals**

Use `t()` for every static visible string, alert, toast, and accessibility label in the listed files. Preserve track title, artist, DJ, generated caption, and external Audius metadata. Use `catalogLabel` only for recognized genre values. Keep timer digits and seek timestamps numeric.

- [ ] **Step 6: Verify playback and statistics**

Run: `npm test -- app/__tests__/player-i18n-test.tsx app/__tests__/focus-mode-i18n-test.tsx app/__tests__/vibe-check-test.tsx src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: all suites PASS and TypeScript exits 0.

- [ ] **Step 7: Commit playback translations**

```bash
git add app/player.tsx app/focus-mode.tsx app/vibe-check.tsx app/__tests__ src/components/player src/components/focus src/components/vibe src/utils/vibe-stats.ts src/i18n
git commit -m "feat: translate playback and listening insights"
```

---

### Task 8: Translate onboarding and guided tours

**Files:**
- Create: `src/i18n/locales/en/onboarding.ts`
- Create: `src/i18n/locales/es/onboarding.ts`
- Modify: `src/i18n/resources.ts`
- Modify: `src/onboarding/constants.ts`
- Modify: `src/onboarding/types.ts`
- Modify: `src/onboarding/WelcomeTour.tsx`
- Modify: `src/onboarding/TourTooltip.tsx`
- Modify: `src/onboarding/TourCompletionSheet.tsx`
- Modify: `src/onboarding/ContinueTourCard.tsx`
- Modify: `src/onboarding/engine/SpotlightTourEngine.tsx`
- Modify: `src/onboarding/__tests__/WelcomeTour-test.tsx`
- Modify: `src/onboarding/__tests__/TourTooltip-test.tsx`
- Modify: `src/onboarding/__tests__/AppTourProvider-test.tsx`
- Modify: `src/onboarding/__tests__/AppTourProvider-home-registration-test.tsx`

**Interfaces:**
- Produces: tour steps containing semantic `titleKey` and `descriptionKey` while retaining stable IDs, target IDs, and placement.

- [ ] **Step 1: Add failing Spanish onboarding assertions**

Set Spanish and assert `BIENVENIDO A HIMU`, `TU MÚSICA, EN EL MOMENTO JUSTO`, `Página 1 de 2`, `Omitir`, `Atrás`, `Continuar`, `CONOCE A TUS DJS CON IA`, `TOUR COMPLETADO`, `YA ESTÁS LISTO`, and localized accessibility announcements.

- [ ] **Step 2: Run onboarding suites and confirm RED**

Run: `npm test -- src/onboarding/__tests__/WelcomeTour-test.tsx src/onboarding/__tests__/TourTooltip-test.tsx src/onboarding/__tests__/AppTourProvider-test.tsx src/onboarding/__tests__/AppTourProvider-home-registration-test.tsx`

Expected: FAIL on Spanish assertions.

- [ ] **Step 3: Define the complete onboarding catalog**

Include welcome pages, page count, skip/back/continue/show-around actions, Home tour steps, Discover and DJ contextual tips, tooltip controls and step announcements, continue-tour card, completion sheet, and replay copy. Spanish tour wording remains concise enough for existing tooltip widths.

- [ ] **Step 4: Make tour configuration semantic**

Change `HOME_TOUR_STEPS` and `CONTEXTUAL_TIP_COPY` from English `title`/`description` values to stable translation keys such as `onboarding.home.dailyDrop.title` and `onboarding.home.dailyDrop.description`. Resolve keys with `t()` when constructing the active `SpotlightStep`; do not change `id`, `targetId`, placement, onboarding version, or persisted completion data.

- [ ] **Step 5: Replace all onboarding copy and accessibility strings**

Use interpolation for `Página {{page}} de {{count}}`, tooltip step counts, and combined accessibility announcements. Ensure changing the language while a tour is open rerenders the current step without resetting its phase or completion state.

- [ ] **Step 6: Verify onboarding and resource parity**

Run: `npm test -- src/onboarding/__tests__ src/i18n/__tests__/resources-test.ts && npx tsc --noEmit`

Expected: all onboarding suites PASS; no onboarding migration is required.

- [ ] **Step 7: Commit onboarding translations**

```bash
git add src/onboarding src/i18n/locales/en/onboarding.ts src/i18n/locales/es/onboarding.ts src/i18n/resources.ts
git commit -m "feat: translate onboarding and product tours"
```

---

### Task 9: Audit all user-facing copy and run release verification

**Files:**
- Inspect: `app/**/*.tsx`
- Inspect: `src/**/*.tsx`
- Inspect: `src/i18n/locales/**/*.ts`

**Interfaces:**
- Consumes all prior tasks.
- Produces a clean bilingual client with no known hard-coded static UI copy.

- [ ] **Step 1: Run a targeted hard-coded-copy audit**

Run:

```bash
rg -n 'accessibilityLabel="|title="[A-Za-zÁÉÍÓÚÑ¿¡]|subtitle="[A-Za-zÁÉÍÓÚÑ¿¡]|label="[A-Za-zÁÉÍÓÚÑ¿¡]|placeholder="[A-Za-zÁÉÍÓÚÑ¿¡]|Alert\.alert\("|<Text[^>]*>[[:space:]]*[A-Za-zÁÉÍÓÚÑ¿¡]' app src --glob '*.tsx' --glob '!**/__tests__/**'
```

Expected: every match is either dynamic content, a non-user-facing identifier, or an untranslated static string that must be moved into its owning catalog before continuing.

- [ ] **Step 2: Verify catalog parity and absence of static findings**

Run `npm test -- src/i18n/__tests__/resources-test.ts` and repeat the `rg` command from Step 1. Expected: parity PASS; the audit has no untranslated static UI. If it finds one, stop this verification task and add a new red-green translation task with that exact file, copy, keys, and assertions before resuming.

- [ ] **Step 3: Run complete automated verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Expected: Jest reports all suites PASS, TypeScript and ESLint exit 0, and Expo completes a web export without missing localization modules or raw resource errors.

- [ ] **Step 4: Perform the bilingual manual smoke test**

Verify these exact scenarios on one native development build: first launch with device language Spanish; first launch with an unsupported device language; select English; select Spanish; select device language; restart after each selection; disable network and restart; navigate Login, Home, Discover, Profile, Settings, Preferences, DJ profile/create/train, Player, Focus Mode, Vibe Check, Favorites, onboarding, alerts, toasts, and confirmations. Confirm long Spanish copy wraps without overlap and screen-reader labels match visible actions.

- [ ] **Step 5: Review the final diff and working tree**

```bash
git status --short
git diff --check
git diff --stat
```

Expected: no uncommitted implementation changes remain; only unrelated user-owned changes that predated execution may still appear.
