const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../..");
const runnerArgument = process.argv.indexOf("--runner");
const runner = runnerArgument === -1
  ? path.join(projectRoot, "test-support/beta-visual-browser/run-beta-visual-browser.cjs")
  : path.resolve(process.argv[runnerArgument + 1] ?? "");

const requiredCells = new Map([
  ["320x640", { width: 320, height: 640, zoomPercent: 100 }],
  ["390x844", { width: 390, height: 844, zoomPercent: 100 }],
  ["768x1024", { width: 768, height: 1024, zoomPercent: 100 }],
  ["1024x768", { width: 1024, height: 768, zoomPercent: 100 }],
  ["1440x900", { width: 1440, height: 900, zoomPercent: 100 }],
  ["720x422", { width: 720, height: 422, zoomPercent: 100 }],
  ["200% zoom", { width: 720, height: 900, zoomPercent: 200 }],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Beta visual browser check failed: ${message}`);
}

function isExactReverse(forward, backward) {
  return Array.isArray(forward) &&
    Array.isArray(backward) &&
    forward.length === backward.length &&
    forward.every((entry, index) => entry === backward[backward.length - index - 1]);
}

function isNear(actual, expected, tolerance = 1) {
  return typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
}

function verifySurface(cell, surface) {
  const prefix = `${cell.label} ${surface?.name ?? "unknown surface"}`;
  const expectedScale = cell.zoomPercent / 100;
  const expectedVisualWidth = cell.width / expectedScale;
  const expectedVisualHeight = cell.height / expectedScale;
  const reportedEffectiveScale =
    surface?.visualViewport?.scale * surface?.visualViewport?.devicePixelRatio;
  invariant(
    isNear(surface?.visualViewport?.width, expectedVisualWidth) &&
      isNear(surface?.visualViewport?.height, expectedVisualHeight) &&
      isNear(reportedEffectiveScale, expectedScale, 0.01),
    `${prefix} did not report the effective visual viewport at ${cell.zoomPercent}% zoom: ` +
      `${JSON.stringify(surface?.visualViewport)}.`,
  );
  invariant(surface?.noHorizontalOverflow === true, `${prefix} has horizontal overflow.`);
  invariant(surface?.primaryActionVisible === true, `${prefix} primary action is not visible.`);
  invariant(surface?.primaryActionReachable === true, `${prefix} primary action is not reachable.`);
  invariant(
    surface?.primaryActionBoundedByVisualViewport === true,
    `${prefix} primary action is not bounded by the user-visible visual viewport: ` +
      `${JSON.stringify({ visualViewport: surface?.visualViewport, actionRect: surface?.actionRect })}.`,
  );
  invariant(
    surface?.focusForward?.includes("Back") && surface.focusForward.includes("Continue"),
    `${prefix} focus evidence must traverse Back through Continue.`,
  );
  invariant(
    isExactReverse(surface?.focusForward, surface?.focusBackward),
    `${prefix} reverse focus order does not mirror forward Tab order.`,
  );
  invariant(
    JSON.stringify(surface?.sourceOrder) === JSON.stringify(["header", "content", "state", "action"]),
    `${prefix} does not preserve header/content/state/action source order.`,
  );
  invariant(surface?.dialog?.bounded === true, `${prefix} dialog is not bounded by the viewport.`);
  invariant(
    surface?.dialog?.boundedByVisualViewport === true,
    `${prefix} dialog is not bounded by the user-visible visual viewport.`,
  );
  invariant(
    surface?.dialog?.focusForward?.includes("Done") &&
      surface.dialog.focusForward.some((entry) => /^Search\s/.test(entry)),
    `${prefix} dialog focus evidence must traverse Done and Search controls.`,
  );
  invariant(
    isExactReverse(surface?.dialog?.focusForward, surface?.dialog?.focusBackward),
    `${prefix} dialog reverse focus order does not mirror forward Tab order.`,
  );
  invariant(
    JSON.stringify(surface?.dialog?.sourceOrder) ===
      JSON.stringify(["title", "done", "search", "options"]),
    `${prefix} dialog source order is not title/done/search/options.`,
  );
}

function verifyReport(report) {
  invariant(Array.isArray(report?.matrix), "runner did not return a matrix array.");
  for (const [label, expected] of requiredCells) {
    const cell = report.matrix.find((candidate) => candidate?.label === label);
    invariant(cell, `missing required ${label} evidence.`);
    invariant(
      cell.width === expected.width &&
        cell.height === expected.height &&
        cell.zoomPercent === expected.zoomPercent,
      `${label} evidence used the wrong effective dimensions or zoom.`,
    );
    for (const surfaceName of ["activation", "primary"]) {
      const surface = cell.surfaces?.find((candidate) => candidate?.name === surfaceName);
      invariant(surface, `${label} is missing ${surfaceName} surface evidence.`);
      verifySurface(cell, surface);
    }
  }
}

async function main() {
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error("Beta visual browser check failed: runner did not return JSON evidence.");
  }
  verifyReport(report);
  process.stdout.write(
    "Beta visual browser matrix verified: compact, tablet, wide, low-height, and 200% zoom geometry/focus evidence passed.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
