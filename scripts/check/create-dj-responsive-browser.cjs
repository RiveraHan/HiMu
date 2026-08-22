const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/creative-workflows-browser/run-create-dj-responsive-browser.cjs",
);

function assertSnapshot(snapshot, expectedLayout) {
  assert.equal(snapshot.viewportWidth, expectedLayout.viewportWidth);
  assert.equal(snapshot.contentDirection, expectedLayout.contentDirection);
  assert.equal(snapshot.railDisplay, expectedLayout.railDisplay);
  assert.equal(snapshot.reviewPosition, expectedLayout.reviewPosition);
  assert.equal(snapshot.trainContentDirection, expectedLayout.contentDirection);
  assert.equal(snapshot.trainRailDisplay, expectedLayout.railDisplay);
  assert.equal(snapshot.trainReviewPosition, expectedLayout.reviewPosition);
  assert.equal(snapshot.name, "Night Cartographer");
  assert.equal(
    snapshot.identityConcept,
    "A custom navigator mapping patient rhythms into luminous shared journeys.",
  );
  assert.equal(snapshot.candidateCount, 3);
  assert.equal(snapshot.finalActionCount, 1);
  assert.equal(snapshot.finalActionDisabled, false);
  assert.equal(snapshot.createCalls, 0);
  assert.equal(snapshot.trainName, "Lumen");
  assert.equal(snapshot.trainFinalActionCount, 1);
  assert.equal(snapshot.trainFinalActionDisabled, false);
  assert.equal(snapshot.updateCalls, 0);
  assert.match(snapshot.visibilitySummary, /Anyone can discover this DJ\./);
  assert.match(snapshot.trainReviewSummary, /Ambient/);
  assert.match(snapshot.trainReviewSummary, /Focus/);
  assert.match(snapshot.trainReviewSummary, /6\/10/);
}

async function main() {
  const { stdout } = await execFileAsync(process.execPath, [runner], {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90_000,
  });
  const result = JSON.parse(stdout);
  const [compactBefore, desktop, compactAfter] = result.snapshots;

  assert.equal(result.initialFinalActionDisabled, true);
  assertSnapshot(compactBefore, {
    viewportWidth: 390,
    contentDirection: "column",
    railDisplay: "none",
    reviewPosition: "relative",
  });
  assertSnapshot(desktop, {
    viewportWidth: 1440,
    contentDirection: "row",
    railDisplay: "flex",
    reviewPosition: "sticky",
  });
  assertSnapshot(compactAfter, {
    viewportWidth: 390,
    contentDirection: "column",
    railDisplay: "none",
    reviewPosition: "relative",
  });

  process.stdout.write(
    "Create/Train DJ browser check passed: production controllers preserve state and validation across 390→1440→390 without submission.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
