# Native validation and real app captures

## Automated public-entry smoke flow

Install Maestro and a configured HiMu development or preview build on an Android
emulator or iOS simulator. For a development client, start Metro and open the app
before running the flow. Use a signed-out test account state, dismiss developer
menus, and run from the repository root:

```sh
maestro test .maestro/public-entry.yaml
```

The flow opens `himu://welcome`, checks the public introduction, follows the
existing-account action, and verifies login. It takes actual runtime screenshots.
It does not clear keychain credentials, complete Google OAuth, or prove audio
playback. It passed on the accelerated Android emulator described below. It is not yet
added to hosted CI.
Command reference: [Maestro](https://docs.maestro.dev/api-reference/commands).

## Recorded validation

On September 9, 2026, Maestro 2.10.0 passed `public-entry.yaml` on the Android
Small_Phone emulator (720×1280, Google Play image, KVM acceleration, 3 GB RAM).
The development client loaded the current Metro working tree based on `ad42eb2`,
with dummy Supabase configuration. The run took 40 seconds and verified welcome
visibility, the existing-account action, and login visibility. Reviewed captures
are in `assets/screenshots/android-welcome-en.png` and `android-login-en.png`.

The native JS bundle compiled successfully. This is not a fresh native binary
build, OAuth acceptance test, or playback/lock-screen verification. Software-only
emulation was unstable on this host; check `emulator -accel-check` from the actual
host before launching an AVD.

`public-deep-links.yaml` additionally checks opening `himu://welcome` with the app
stopped, navigating to login, and reopening welcome while the process is alive:

```sh
maestro test .maestro/public-deep-links.yaml
```

## Authenticated Android validation (September 12, 2026)

The development client restored a real Supabase session for an explicitly marked,
disposable QA account. Home and the Ember DJ profile loaded the existing catalog.
Google's native sign-in screen opened, but no Google account was authenticated;
the QA session used Supabase password authentication through a temporary local
bootstrap. That bootstrap was removed from `index.ts` before further validation.

Playing “Bruma Eléctrica” produced an Android media session in `PLAYING` state.
While the app stayed in the background, position advanced from 23.404 to 104.867
seconds; the screen was off for part of this interval. Android media pause changed
state to `PAUSED` at 106.664 seconds, and media play restored `PLAYING`. The system
media card displayed the correct title, artist and artwork. This verifies engine
progress and system transport commands, not an audible recording or lock-screen UI:
the emulator had no screen lock configured.

The run exposed `AudioPlayer.replace(null)` failing on Android in expo-audio 1.1.1.
Session teardown now pauses playback, resets application state and clears system
controls without passing a null source to Android. Toggle cannot restart retained
media when no current track exists, and stale status cannot refill cleared state.
Regression tests cover the account switch and attempted resume afterward.

On September 13 the QA Auth account was deleted. Profiles, favorites, listening
history/statistics and onboarding rows were verified absent. Existing catalog
tracks and media were preserved. The hosted database has no `product_events`
table, so the proposed telemetry retention migration was not deployed or exercised
against hosted data.

Cold public deep links require a standalone preview/release build: a stopped Expo
development client opens its server selector instead. The dev-client cold-link
run failed that prerequisite; it is not recorded as an app-routing success.

## Existing native flows

The repository already includes `himu-beta-onboarding-first-track.yaml`,
`himu-beta-visual-polish.yaml`, and `himu-moment.yaml` in `.maestro`. They cover
beta onboarding, responsive settings, and track publication/feedback. Read their
prerequisites first: some require an authenticated account, a prepared track, or
the local beta smoke mode. They do not validate real Google sign-in or background
audio, and are not automatically run by CI.

## Device release checks

Run on both Android and iOS using a test backend and playable test catalog. Record
commit, build type, device/OS, language, and pass/fail evidence for each case.

| Case | Steps and expected result |
| --- | --- |
| Google authentication | Sign in, cancel sign-in, retry, restart, and sign out. Verify session restoration and that private screens are no longer accessible after sign-out. |
| Deep links | Open `himu://welcome` cold and warm while signed out. Open an actual shared track URL signed out and signed in; verify intended routing and access restrictions. |
| Background audio | Play a known track, background the app for at least a minute, then return. Verify audible continuity and synchronized progress; test pause/resume and queue transitions. |
| Lock-screen controls | Lock the device during playback. Verify title/artwork, pause/resume, next/previous where supported, and that switching tracks refreshes metadata. |
| Session change | Sign out during playback and sign in with another test account. Verify no previous private queue/history leaks into the new session. |

Use physical devices for final audio and lock-screen acceptance. These cases
remain manual; Jest and the public-entry smoke flow do not cover native system UI.
Automating them needs a stable test catalog, test Google credentials, and device
runners. Do not add production credentials to public pull-request workflows.

## README captures

The existing `assets/design` images are design references, not app screenshots.
Capture Home, a DJ profile, Player, and Vibe Check from a running test build; add
a short recording showing playback, backgrounding, and lock-screen controls.
Review captures for personal information and private content before committing.
Label actual captures with platform, build/commit and date, keeping design images
in their own clearly labeled section. Public Android and web captures are now in `assets/screenshots/` (720×1280
native, 1280×720 web desktop, and 390×844 mobile-width web). They come from the
running app with dummy backend configuration. Authenticated Home and DJ captures were added on September 12. Full-screen Player,
Vibe Check, and a native playback video were added on September 13; see the
standalone capture and demo results below.

## Repository checks (September 13, 2026)

The working tree passed 171 Jest suites / 1,406 tests without `--forceExit`,
TypeScript, lint and the web production export. Six PGlite retention tests passed against the repository SQL
migrations. Tests which spawn Node processes need a host environment permitting
child processes; the restricted local sandbox returned `EPERM` for those checks.
A feedback mutation test now waits for the observable React Query result instead
of assuming its notification has rendered immediately after `mutateAsync`.

## Standalone Android build and links (September 13, 2026)

`./gradlew assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2`
completed successfully in 10m 34s. This local emulator APK uses the repository's
debug signing configuration; it is not a store release or a validation of ARM/iOS.
The temporary QA bootstrap was absent from the entry point when it was bundled.

After installing the APK, ADB reported a cold launch for `himu://welcome`
(2.220 seconds). The welcome screen was confirmed visually and in the native UI
hierarchy. Tapping the existing-account action displayed the Google login screen;
reopening the same link while the app was alive returned to welcome, again
confirmed by its UI hierarchy. This was an ADB/visual acceptance check, not a
new Maestro pass. Android UIAutomator could not reach idle on the animated login
screen, so login was verified from the actual screenshot instead.

At this stage, Google authentication, lock-screen UI, iOS testing, Player/Vibe
Check captures and a native demo were still pending. The subsequent standalone
validation below completed the Android captures, demo and basic lock-screen
transport checks.

## Player, Vibe Check and lock-screen demo (September 13, 2026)

A fresh, disposable Supabase QA account restored its session in the standalone
Android APK. The emulator viewport was set to 720×1600 so the complete Player
controls fit. Existing catalog tracks were played normally; no listening rows
were manually seeded. Supabase recorded five minutes and two completed tracks
before the Vibe Check capture.

This exposed a UTC/local-calendar mismatch: the server had Monday's totals while
the emulator was still on Sunday. Vibe Check now computes dates, week boundaries
and streaks in the same UTC calendar as the stored totals. A regression test
reproduced the missing-week issue in America/Managua before the fix; the focused
21 tests passed afterward, as did TypeScript, lint and the updated Android build.

The new captures are `android-player-en.png`, `android-vibe-check-en.png` and
`android-lock-screen-en.png`. The uncut 45.5-second H.264 recording is
`assets/demos/android-player-vibe-check.mp4` (720×1600, approximately 3.5 MB, silent).
It shows actual playback, the Android swipe lock screen, and Vibe Check. Tapping
the lock-screen pause button produced PAUSED at 42.420 seconds; tapping play
restored PLAYING and advanced to 45.466 seconds. The media card displayed the
track title, artist and artwork. The MP4 was remuxed for fast start without
re-encoding or adding audio.

These checks complete the Android capture/demo and basic lock-screen transport
items listed earlier. Full Google authentication, iOS, secure PIN/biometric lock
behavior and physical-device audio acceptance remain unverified.

After capture, the second QA Auth account was deleted and zero remaining rows
were verified in profiles, favorites, listening_events, listening_stats and
user_onboarding. Existing catalog content was preserved; the emulator was stopped.

Final verification for the UTC correction: 171 Jest suites / 1,407 tests passed
without forced exit. TypeScript, lint and the rebuilt standalone APK also passed.
