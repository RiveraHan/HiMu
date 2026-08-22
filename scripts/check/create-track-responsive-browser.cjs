const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/creative-workflows-browser/run-create-track-responsive-browser.cjs",
);

function assertDraft(snapshot, expectedLayout) {
  assert.equal(snapshot.viewportWidth, expectedLayout.viewportWidth);
  assert.equal(snapshot.phase, "draft");
  assert.equal(snapshot.contentDirection, expectedLayout.contentDirection);
  assert.equal(snapshot.railDisplay, expectedLayout.railDisplay);
  assert.equal(snapshot.reviewPosition, expectedLayout.reviewPosition);
  assert.equal(snapshot.title, "Owner's New Horizon");
  assert.equal(
    snapshot.direction,
    "Build patiently from a private pulse into a bright shared release.",
  );
  assert.equal(snapshot.lyricsLength, 1000);
  assert.equal(snapshot.finalActionCount, 1);
  assert.equal(snapshot.generateCalls, 0);
  assert.match(snapshot.reviewText, /Owner's New Horizon/);
  assert.match(snapshot.reviewText, /Vocal · Private/);
}

function assertConfirmed(snapshot, expectedLayout) {
  assert.equal(snapshot.viewportWidth, expectedLayout.viewportWidth);
  assert.equal(snapshot.phase, "confirmed");
  assert.equal(snapshot.contentDirection, expectedLayout.contentDirection);
  assert.equal(snapshot.railDisplay, expectedLayout.railDisplay);
  assert.equal(snapshot.reviewPosition, expectedLayout.reviewPosition);
  assert.equal(snapshot.title, null);
  assert.equal(snapshot.direction, null);
  assert.equal(snapshot.lyricsLength, null);
  assert.match(snapshot.reviewText, /Confirm your track/);
  assert.match(snapshot.reviewText, /Owner's New Horizon/);
  assert.match(snapshot.reviewText, /Vocal · Private/);
  assert.equal(snapshot.finalActionCount, 1);
  assert.equal(snapshot.generateCalls, 0);
}

function assertInOrder(values, expected) {
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
    timeout: 90_000,
  });
  const result = JSON.parse(stdout);
  const [compactDraft, desktopDraft, desktopConfirmed, compactConfirmed] = result.snapshots;

  assert.equal(result.privateSeedPreserved, true);
  assertDraft(compactDraft, {
    viewportWidth: 390,
    contentDirection: "column",
    railDisplay: "none",
    reviewPosition: "relative",
  });
  assertDraft(desktopDraft, {
    viewportWidth: 1440,
    contentDirection: "row",
    railDisplay: "flex",
    reviewPosition: "sticky",
  });
  assertConfirmed(desktopConfirmed, {
    viewportWidth: 1440,
    contentDirection: "row",
    railDisplay: "flex",
    reviewPosition: "sticky",
  });
  assertConfirmed(compactConfirmed, {
    viewportWidth: 390,
    contentDirection: "column",
    railDisplay: "none",
    reviewPosition: "relative",
  });
  assertInOrder(desktopDraft.focusLabels, [
    "Track title",
    "Creative direction",
    "Lyrics",
    "Review generation",
  ]);
  assert.equal(result.zoomReachability.viewportWidth, 720);
  assert.equal(result.zoomReachability.viewportHeight, 422);
  assert.equal(result.zoomReachability.actionVisible, true);
  assert.equal(result.zoomReachability.actionFocused, true);
  assert.equal(result.zoomReachability.actionTabIndex, 0);
  assert.equal(result.zoomReachability.generateCalls, 0);

  process.stdout.write(
    "Create Track browser check passed: production draft/confirmation state, focus order, and 200% zoom reachability.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
