/** @jest-environment node */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

type WorkflowSnapshot = {
  viewportWidth: number;
  contentDirection: string;
  railDisplay: string;
  reviewPosition: string;
  name: string;
  identityConcept: string;
  candidateCount: number;
  visibilitySummary: string;
  finalActionCount: number;
  finalActionDisabled: boolean;
  createCalls: number;
  trainContentDirection: string;
  trainRailDisplay: string;
  trainReviewPosition: string;
  trainName: string;
  trainReviewSummary: string;
  trainFinalActionCount: number;
  trainFinalActionDisabled: boolean;
  updateCalls: number;
};

type BrowserResult = {
  initialFinalActionDisabled: boolean;
  snapshots: [WorkflowSnapshot, WorkflowSnapshot, WorkflowSnapshot];
};

const execFileAsync = promisify(execFile);

async function runCreateDjWorkflowInChrome(): Promise<BrowserResult> {
  const runner = path.join(
    __dirname,
    "browser",
    "run-create-dj-responsive-browser.cjs",
  );
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: path.resolve(__dirname, "../.."),
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90_000,
  });

  return JSON.parse(stdout) as BrowserResult;
}

describe("Create and Train DJ production workflows in Chromium", () => {
  jest.setTimeout(100_000);

  it("preserves real values and validation across compact to desktop to compact resize without submitting", async () => {
    const result = await runCreateDjWorkflowInChrome();
    const [compactBefore, desktop, compactAfter] = result.snapshots;

    expect(result.initialFinalActionDisabled).toBe(true);
    expect(compactBefore).toEqual(expect.objectContaining({
      viewportWidth: 390,
      contentDirection: "column",
      railDisplay: "none",
      reviewPosition: "relative",
      trainContentDirection: "column",
      trainRailDisplay: "none",
      trainReviewPosition: "relative",
    }));
    expect(desktop).toEqual(expect.objectContaining({
      viewportWidth: 1440,
      contentDirection: "row",
      railDisplay: "flex",
      reviewPosition: "sticky",
      trainContentDirection: "row",
      trainRailDisplay: "flex",
      trainReviewPosition: "sticky",
    }));
    expect(compactAfter).toEqual(expect.objectContaining({
      viewportWidth: 390,
      contentDirection: "column",
      railDisplay: "none",
      reviewPosition: "relative",
      trainContentDirection: "column",
      trainRailDisplay: "none",
      trainReviewPosition: "relative",
    }));

    for (const snapshot of result.snapshots) {
      expect(snapshot).toEqual(expect.objectContaining({
        name: "Night Cartographer",
        identityConcept:
          "A custom navigator mapping patient rhythms into luminous shared journeys.",
        candidateCount: 3,
        finalActionCount: 1,
        finalActionDisabled: false,
        createCalls: 0,
        trainName: "Lumen",
        trainFinalActionCount: 1,
        trainFinalActionDisabled: false,
        updateCalls: 0,
      }));
      expect(snapshot.visibilitySummary).toContain(
        "Anyone can discover this DJ.",
      );
      expect(snapshot.trainReviewSummary).toContain("Ambient");
      expect(snapshot.trainReviewSummary).toContain("Focus");
      expect(snapshot.trainReviewSummary).toContain("6/10");
    }
  });
});
