/** @jest-environment node */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

type WorkflowSnapshot = {
  viewportWidth: number;
  phase: "draft" | "confirmed";
  contentDirection: string;
  railDisplay: string;
  reviewPosition: string;
  title: string | null;
  direction: string | null;
  lyricsLength: number | null;
  reviewText: string;
  finalActionCount: number;
  generateCalls: number;
  focusLabels: string[];
};

type BrowserResult = {
  privateSeedPreserved: boolean;
  snapshots: [
    WorkflowSnapshot,
    WorkflowSnapshot,
    WorkflowSnapshot,
    WorkflowSnapshot,
  ];
  zoomReachability: {
    viewportWidth: number;
    viewportHeight: number;
    scrollTop: number;
    actionVisible: boolean;
    actionFocused: boolean;
    actionTabIndex: number;
    generateCalls: number;
  };
};

const execFileAsync = promisify(execFile);

async function runCreateTrackWorkflowInChrome(): Promise<BrowserResult> {
  const runner = path.join(
    __dirname,
    "browser",
    "run-create-track-responsive-browser.cjs",
  );
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: path.resolve(__dirname, "../.."),
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90_000,
  });

  return JSON.parse(stdout) as BrowserResult;
}

describe("Create Track production workflow in Chromium", () => {
  jest.setTimeout(100_000);

  it("preserves draft and accepted state across compact, desktop, and compact resize without submitting", async () => {
    const result = await runCreateTrackWorkflowInChrome();
    const [compactDraft, desktopDraft, desktopConfirmed, compactConfirmed] =
      result.snapshots;

    expect(result.privateSeedPreserved).toBe(true);

    expect(compactDraft).toEqual(expect.objectContaining({
      viewportWidth: 390,
      phase: "draft",
      contentDirection: "column",
      railDisplay: "none",
      reviewPosition: "relative",
    }));
    expect(desktopDraft).toEqual(expect.objectContaining({
      viewportWidth: 1440,
      phase: "draft",
      contentDirection: "row",
      railDisplay: "flex",
      reviewPosition: "sticky",
    }));
    expect(desktopConfirmed).toEqual(expect.objectContaining({
      viewportWidth: 1440,
      phase: "confirmed",
      contentDirection: "row",
      railDisplay: "flex",
      reviewPosition: "sticky",
    }));
    expect(compactConfirmed).toEqual(expect.objectContaining({
      viewportWidth: 390,
      phase: "confirmed",
      contentDirection: "column",
      railDisplay: "none",
      reviewPosition: "relative",
    }));

    for (const snapshot of [compactDraft, desktopDraft]) {
      expect(snapshot).toEqual(expect.objectContaining({
        title: "Owner's New Horizon",
        direction: "Build patiently from a private pulse into a bright shared release.",
        lyricsLength: 1000,
        finalActionCount: 1,
        generateCalls: 0,
      }));
      expect(snapshot.reviewText).toContain("Owner's New Horizon");
      expect(snapshot.reviewText).toContain("Vocal · Private");
    }

    for (const snapshot of [desktopConfirmed, compactConfirmed]) {
      expect(snapshot.title).toBeNull();
      expect(snapshot.direction).toBeNull();
      expect(snapshot.lyricsLength).toBeNull();
      expect(snapshot.reviewText).toContain("Confirm your track");
      expect(snapshot.reviewText).toContain("Owner's New Horizon");
      expect(snapshot.reviewText).toContain("Vocal · Private");
      expect(snapshot.finalActionCount).toBe(1);
      expect(snapshot.generateCalls).toBe(0);
    }

    expect(desktopDraft.focusLabels).toEqual(expect.arrayContaining([
      "Track title",
      "Creative direction",
      "Lyrics",
      "Review generation",
    ]));
    expect(desktopDraft.focusLabels.indexOf("Track title")).toBeLessThan(
      desktopDraft.focusLabels.indexOf("Creative direction"),
    );
    expect(desktopDraft.focusLabels.indexOf("Creative direction")).toBeLessThan(
      desktopDraft.focusLabels.indexOf("Lyrics"),
    );
    expect(desktopDraft.focusLabels.indexOf("Lyrics")).toBeLessThan(
      desktopDraft.focusLabels.indexOf("Review generation"),
    );

    expect(result.zoomReachability).toEqual(expect.objectContaining({
      viewportWidth: 720,
      viewportHeight: 422,
      actionVisible: true,
      actionFocused: true,
      actionTabIndex: 0,
      generateCalls: 0,
    }));
  });
});
