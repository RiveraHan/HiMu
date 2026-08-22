/** @jest-environment node */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

type SettingsSnapshot = {
  route: "preferences" | "account";
  viewportWidth: number;
  viewportHeight: number;
  direction: string;
  wrap: string;
  itemWidth: number;
  zoneOrder: string[];
  focusLabels: string[];
  preferenceGenres: string[];
  ambientSelected: boolean;
  languageValue: string | null;
  languageDisabled: boolean;
  legalLabels: string[];
  legalMissingVisible: boolean;
  counters: Record<string, number>;
};

type BrowserResult = {
  snapshots: {
    compactPreferences: SettingsSnapshot;
    desktopPreferences: SettingsSnapshot;
    desktopAccount: SettingsSnapshot;
    compactAccount: SettingsSnapshot;
    savingAccount: SettingsSnapshot;
  };
  session: {
    beforeSession: Record<string, number>;
    afterCancel: Record<string, number>;
    afterConfirm: Record<string, number>;
  };
  zoomReachability: {
    viewportWidth: number;
    viewportHeight: number;
    scrollTop: number;
    actionVisible: boolean;
    actionFocused: boolean;
    actionTabIndex: number;
  };
  screenshots: { filePath: string; bytes: number }[];
};

const execFileAsync = promisify(execFile);

async function runSettingsWorkflowInChrome(): Promise<BrowserResult> {
  const runner = path.join(
    __dirname,
    "..",
    "test-support",
    "settings-browser",
    "run-settings-responsive-browser.cjs",
  );
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: path.resolve(__dirname, "../.."),
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });

  return JSON.parse(stdout) as BrowserResult;
}

describe("Preferences and Account Settings production routes in Chromium", () => {
  jest.setTimeout(130_000);

  it("preserves settings state and focus order across compact, desktop, session, and zoom flows", async () => {
    const result = await runSettingsWorkflowInChrome();
    const {
      compactPreferences,
      desktopPreferences,
      desktopAccount,
      compactAccount,
      savingAccount,
    } = result.snapshots;

    expect(compactPreferences).toEqual(expect.objectContaining({
      route: "preferences",
      viewportWidth: 390,
      viewportHeight: 844,
      direction: "column",
      wrap: "nowrap",
      zoneOrder: [
        "preference-genre-zone",
        "preference-vibe-zone",
        "preference-excluded-zone",
      ],
      preferenceGenres: ["Ambient"],
      ambientSelected: true,
    }));
    expect(compactPreferences.itemWidth).toBeGreaterThan(300);

    expect(desktopPreferences).toEqual(expect.objectContaining({
      route: "preferences",
      viewportWidth: 1440,
      viewportHeight: 900,
      direction: "row",
      wrap: "wrap",
      preferenceGenres: ["Ambient"],
      ambientSelected: true,
    }));
    expect(desktopPreferences.itemWidth).toBeGreaterThan(500);
    expect(desktopPreferences.itemWidth).toBeLessThan(560);
    expect(desktopPreferences.counters).toEqual(expect.objectContaining({
      preferenceSaves: 1,
      flushes: 0,
      signOuts: 0,
      redirects: 0,
    }));

    for (const account of [desktopAccount, compactAccount]) {
      expect(account.zoneOrder).toEqual([
        "account-identity-zone",
        "account-language-zone",
        "account-session-zone",
        "account-legal-zone",
        "account-destructive-zone",
      ]);
      expect(account.languageValue).toContain("Device language (English)");
      expect(account.legalLabels).toEqual(["Terms", "Privacy"]);
      expect(account.legalMissingVisible).toBe(false);
      expect(account.counters).toEqual(expect.objectContaining({
        flushes: 0,
        signOuts: 0,
        redirects: 0,
      }));
      expect(account.focusLabels.indexOf("Language")).toBeLessThan(
        account.focusLabels.indexOf("Terms"),
      );
      expect(account.focusLabels.indexOf("Terms")).toBeLessThan(
        account.focusLabels.indexOf("Privacy"),
      );
      expect(account.focusLabels.indexOf("Privacy")).toBeLessThan(
        account.focusLabels.indexOf("Sign Out"),
      );
    }
    expect(desktopAccount).toEqual(expect.objectContaining({
      viewportWidth: 1440,
      direction: "row",
      wrap: "wrap",
    }));
    expect(compactAccount).toEqual(expect.objectContaining({
      viewportWidth: 390,
      direction: "column",
      wrap: "nowrap",
    }));
    expect(savingAccount.languageDisabled).toBe(true);

    expect(result.session.beforeSession).toEqual(expect.objectContaining({
      flushes: 0,
      signOuts: 0,
      redirects: 0,
    }));
    expect(result.session.afterCancel).toEqual(expect.objectContaining({
      flushes: 0,
      signOuts: 0,
      redirects: 0,
    }));
    expect(result.session.afterConfirm).toEqual(expect.objectContaining({
      flushes: 1,
      signOuts: 1,
      redirects: 1,
    }));

    expect(result.zoomReachability).toEqual(expect.objectContaining({
      viewportWidth: 720,
      viewportHeight: 422,
      actionVisible: true,
      actionFocused: true,
      actionTabIndex: 0,
    }));
    expect(result.zoomReachability.scrollTop).toBeGreaterThan(0);

    expect(result.screenshots).toHaveLength(4);
    for (const screenshot of result.screenshots) {
      expect(screenshot.filePath).toContain("task-4-evidence");
      expect(screenshot.bytes).toBeGreaterThan(5_000);
    }
  });
});
