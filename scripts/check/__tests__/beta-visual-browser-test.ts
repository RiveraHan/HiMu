import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../../..");
const checker = path.join(projectRoot, "scripts/check/beta-visual-browser.cjs");

const requiredCells = [
  ["320x640", 320, 640, 100],
  ["390x844", 390, 844, 100],
  ["768x1024", 768, 1024, 100],
  ["1024x768", 1024, 768, 100],
  ["1440x900", 1440, 900, 100],
  ["720x422", 720, 422, 100],
  ["200% zoom", 720, 900, 200],
] as const;

function surface(
  name: "activation" | "primary",
  visualViewport: { width: number; height: number; scale: number; devicePixelRatio: number },
) {
  return {
    name,
    visualViewport,
    noHorizontalOverflow: true,
    primaryActionVisible: true,
    primaryActionReachable: true,
    primaryActionBoundedByVisualViewport: true,
    focusForward: ["Back", "Edit genres", "Continue"],
    focusBackward: ["Continue", "Edit genres", "Back"],
    sourceOrder: ["header", "content", "state", "action"],
    dialog: {
      bounded: true,
      boundedByVisualViewport: true,
      focusForward: ["Search Genres", "Done"],
      focusBackward: ["Done", "Search Genres"],
      sourceOrder: ["title", "done", "search", "options"],
    },
  };
}

function validReport() {
  return {
    matrix: requiredCells.map(([label, width, height, zoomPercent]) => ({
      label,
      width,
      height,
      zoomPercent,
      surfaces: [
        surface("activation", {
          width: width / (zoomPercent / 100),
          height: height / (zoomPercent / 100),
          scale: 1,
          devicePixelRatio: zoomPercent / 100,
        }),
        surface("primary", {
          width: width / (zoomPercent / 100),
          height: height / (zoomPercent / 100),
          scale: 1,
          devicePixelRatio: zoomPercent / 100,
        }),
      ],
    })),
  };
}

async function runWithReport(report: unknown) {
  const directory = await mkdtemp(path.join(tmpdir(), "himu-beta-visual-check-"));
  const runner = path.join(directory, "runner.cjs");
  await writeFile(runner, `process.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`);
  try {
    return await execFileAsync(process.execPath, [checker, "--runner", runner], {
      cwd: projectRoot,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("beta visual browser evidence checker", () => {
  it("accepts complete compact, tablet, wide, low-height, and 200% zoom evidence", async () => {
    await expect(runWithReport(validReport())).resolves.toMatchObject({
      stdout: expect.stringContaining("Beta visual browser matrix verified"),
    });
  });

  it("rejects a matrix that omits the low-height 720x422 cell", async () => {
    const report = validReport();
    report.matrix = report.matrix.filter((cell) => cell.label !== "720x422");
    await expect(runWithReport(report)).rejects.toThrow(/720x422/);
  });

  it.each(["390x844", "1024x768"])(
    "rejects a matrix that omits the mandatory %s cell",
    async (missingLabel) => {
      const report = validReport();
      report.matrix = report.matrix.filter((cell) => cell.label !== missingLabel);
      await expect(runWithReport(report)).rejects.toThrow(new RegExp(missingLabel));
    },
  );

  it("rejects 200% evidence measured only against the layout viewport", async () => {
    const report = validReport();
    const zoom = report.matrix.find((cell) => cell.label === "200% zoom")!;
    for (const evidence of zoom.surfaces) {
      evidence.visualViewport = { width: 720, height: 900, scale: 1, devicePixelRatio: 1 };
    }
    await expect(runWithReport(report)).rejects.toThrow(/visual viewport|200%/i);
  });

  it("rejects clipped actions and dialogs even with correct 200% visual viewport metrics", async () => {
    const report = validReport();
    const zoom = report.matrix.find((cell) => cell.label === "200% zoom")!;
    for (const evidence of zoom.surfaces) {
      evidence.primaryActionBoundedByVisualViewport = false;
      evidence.dialog.boundedByVisualViewport = false;
    }
    await expect(runWithReport(report)).rejects.toThrow(/bounded.*user-visible visual viewport/i);
  });

  it("rejects overflow, unreachable actions, and broken reverse focus order", async () => {
    const report = validReport();
    const compact = report.matrix[0]!.surfaces[0]!;
    compact.noHorizontalOverflow = false;
    compact.primaryActionReachable = false;
    compact.focusBackward = ["Back", "Edit genres", "Continue"];
    await expect(runWithReport(report)).rejects.toThrow(/horizontal overflow|reachable|reverse focus/i);
  });

  it("rejects empty focus arrays that would turn browser evidence into a fake pass", async () => {
    const report = validReport();
    const compact = report.matrix[0]!.surfaces[0]!;
    compact.focusForward = [];
    compact.focusBackward = [];
    compact.dialog.focusForward = [];
    compact.dialog.focusBackward = [];
    await expect(runWithReport(report)).rejects.toThrow(/Back.*Continue|dialog.*Done.*Search/i);
  });
});
