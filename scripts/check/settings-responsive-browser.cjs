const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/settings-browser/run-settings-responsive-browser.cjs",
);

function includesInOrder(values, expected) {
  let previous = -1;
  for (const value of expected) {
    const index = values.indexOf(value);
    assert.ok(index > previous, `${value} is out of focus order: ${values.join(", ")}`);
    previous = index;
  }
}

async function main() {
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
  const result = JSON.parse(stdout);
  const {
    compactPreferences,
    desktopPreferences,
    desktopAccount,
    compactAccount,
    failedLanguageAccount,
    savedLanguageAccount,
    remountedPreferences,
    remountedAccount,
  } = result.snapshots;

  assert.equal(compactPreferences.route, "/preferences");
  assert.equal(compactPreferences.hasRouteTitle, true);
  assert.equal(compactPreferences.viewportWidth, 390);
  assert.equal(compactPreferences.viewportHeight, 844);
  assert.equal(compactPreferences.direction, "column");
  assert.equal(compactPreferences.wrap, "nowrap");
  assert.deepEqual(compactPreferences.zoneOrder, [
    "preference-genre-zone",
    "preference-vibe-zone",
    "preference-excluded-zone",
  ]);
  assert.deepEqual(compactPreferences.preferenceGenres, ["Ambient"]);
  assert.equal(compactPreferences.ambientSelected, true);
  assert.ok(compactPreferences.itemWidth > 300);

  assert.equal(desktopPreferences.route, "/preferences");
  assert.equal(desktopPreferences.viewportWidth, 1440);
  assert.equal(desktopPreferences.viewportHeight, 900);
  assert.equal(desktopPreferences.direction, "row");
  assert.equal(desktopPreferences.wrap, "wrap");
  assert.deepEqual(desktopPreferences.preferenceGenres, ["Ambient"]);
  assert.ok(desktopPreferences.itemWidth > 500);
  assert.ok(desktopPreferences.itemWidth < 560);
  assert.equal(desktopPreferences.counters.preferenceSaves, 1);

  for (const account of [desktopAccount, compactAccount, remountedAccount]) {
    assert.equal(account.route, "/account-settings");
    assert.equal(account.hasRouteTitle, true);
    assert.deepEqual(account.zoneOrder, [
      "account-identity-zone",
      "account-language-zone",
      "account-session-zone",
      "account-legal-zone",
      "account-destructive-zone",
    ]);
    assert.deepEqual(account.legalLabels, ["Terms", "Privacy"]);
    assert.equal(account.legalMissingVisible, false);
    includesInOrder(account.focusLabels, ["Language", "Terms", "Privacy", "Sign Out"]);
  }
  assert.equal(desktopAccount.direction, "row");
  assert.equal(compactAccount.direction, "column");

  assert.equal(failedLanguageAccount.languagePreference, "en");
  assert.equal(failedLanguageAccount.languageSaveErrorVisible, true);
  assert.equal(failedLanguageAccount.counters.languageFailures, 1);
  assert.deepEqual(JSON.parse(failedLanguageAccount.storedLanguageState), {
    preference: "en",
    pendingSync: true,
  });
  assert.equal(savedLanguageAccount.languagePreference, "en");
  assert.equal(savedLanguageAccount.languageSaveErrorVisible, false);
  assert.equal(savedLanguageAccount.remoteLanguagePreference, "en");
  assert.deepEqual(JSON.parse(savedLanguageAccount.storedLanguageState), {
    preference: "en",
    pendingSync: false,
  });
  assert.equal(remountedPreferences.route, "/preferences");
  assert.deepEqual(remountedPreferences.preferenceGenres, ["Ambient"]);
  assert.equal(remountedAccount.languagePreference, "en");

  assert.equal(result.session.beforeSession.flushes, 0);
  assert.equal(result.session.beforeSession.signOuts, 0);
  assert.equal(result.session.beforeSession.redirects, 0);
  assert.equal(result.session.afterCancel.flushes, 0);
  assert.equal(result.session.afterCancel.signOuts, 0);
  assert.equal(result.session.afterCancel.redirects, 0);
  assert.equal(result.session.afterConfirm.flushes, 1);
  assert.equal(result.session.afterConfirm.signOuts, 1);
  assert.equal(result.session.afterConfirm.redirects, 1);

  assert.equal(result.zoomReachability.viewportWidth, 720);
  assert.equal(result.zoomReachability.viewportHeight, 422);
  assert.ok(result.zoomReachability.scrollTop >= 0);
  assert.equal(result.zoomReachability.actionVisible, true);
  assert.equal(result.zoomReachability.actionFocused, true);
  assert.equal(result.zoomReachability.actionTabIndex, 0);

  assert.equal(result.screenshots.length, 4);
  for (const screenshot of result.screenshots) {
    assert.match(screenshot.filePath, /task-4-evidence/);
    assert.ok(screenshot.bytes > 5_000);
  }

  process.stdout.write(
    "Settings browser check passed: HTTP /preferences and /account-settings, responsive composition, locale persistence/retry, legal/session actions, focus, and zoom.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
