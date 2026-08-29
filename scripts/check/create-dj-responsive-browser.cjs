const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/creative-workflows-browser/run-create-dj-responsive-browser.cjs",
);

const viewports = [
  [320, 640, "compact", "column"],
  [390, 844, "compact", "column"],
  [768, 1024, "medium", "column"],
  [1023, 768, "medium", "column"],
  [1024, 768, "wide", "row"],
  [1440, 900, "wide", "row"],
  [1920, 1080, "wide", "row"],
  [720, 422, "compact", "column"],
  [512, 384, "compact", "column"],
];

const copy = {
  en: {
    genre: "Ambient",
    mood: "Focus",
    searchGenres: "Search Genres",
    searchMoods: "Search Moods",
    editGenres: "Edit Genres",
    editMoods: "Edit Moods",
    review: "Review your DJ",
  },
  es: {
    genre: "Ambiental",
    mood: "Concentración",
    searchGenres: "Search Géneros",
    searchMoods: "Search Estados de ánimo",
    editGenres: "Edit Géneros",
    editMoods: "Edit Estados de ánimo",
    review: "Revisa tu DJ",
  },
};

function assertTargets(snapshot, context) {
  assert.ok(snapshot.targetRects.length > 0, `${context} has no observed targets`);
  for (const target of snapshot.targetRects) {
    assert.ok(Number.isFinite(target.width) && Number.isFinite(target.height));
    assert.ok(
      target.width >= 44 && target.height >= 44,
      `${context} target ${JSON.stringify(target.label)} is ${target.width}x${target.height}`,
    );
    if (!target.disabled) {
      assert.equal(
        target.focusable,
        true,
        `${context} enabled target ${JSON.stringify(target.label)} is not focusable`,
      );
    }
  }
}

function assertCommon(snapshot, locale, width, height, context) {
  assert.equal(snapshot.locale, locale);
  assert.equal(snapshot.viewportWidth, width);
  assert.equal(snapshot.viewportHeight, height);
  assert.ok(
    snapshot.documentScrollWidth <= snapshot.documentClientWidth,
    `${context} overflows horizontally: ${snapshot.documentScrollWidth}/${snapshot.documentClientWidth}`,
  );
  assert.equal(snapshot.dialogCount, 0);
  assert.equal(snapshot.activeEditorCount, 1);
  assertTargets(snapshot, context);
}

function assertCreateCell(cell, mode) {
  const { locale, width, height, create } = cell;
  const context = `Create ${locale} ${width}x${height}`;
  assertCommon(create.initial, locale, width, height, `${context} initial`);
  assert.equal(create.initial.contentMode, mode);
  assert.equal(create.initial.lowHeight, height <= 599);
  assert.equal(create.initial.activeStep, 1);
  assert.equal(create.initial.actionCount, 1);
  assert.equal(create.initial.actionDisabled, true);
  assert.equal(create.initial.identityRequestCount, 0);
  assert.equal(create.initial.createCalls, 0);

  for (const [name, dialog, search, opener] of [
    ["Genres", create.genresDialog, copy[locale].searchGenres, copy[locale].editGenres],
    ["Moods", create.moodsDialog, copy[locale].searchMoods, copy[locale].editMoods],
  ]) {
    assert.equal(dialog.opened.dialogCount, 1);
    assert.equal(dialog.opened.dialogFocus, search);
    assert.equal(dialog.reverseWrap, dialog.last, `${context} ${name} reverse trap failed`);
    assert.equal(dialog.forwardWrap, dialog.first, `${context} ${name} forward trap failed`);
    assert.equal(dialog.escaped.dialogCount, 0);
    assert.equal(dialog.escaped.dialogFocus, opener);
    assertTargets(dialog.opened, `${context} ${name} dialog`);
    assert.equal(dialog.progressive.checkedBefore, false);
    assert.equal(dialog.progressive.checkedAfter, true);
    assert.equal(dialog.progressive.limitAnnouncement, "");
  }

  assertCommon(create.soundReady, locale, width, height, `${context} Sound`);
  assert.equal(create.soundReady.actionCount, 1);
  assert.equal(create.soundReady.actionDisabled, false);
  assert.equal(create.soundReady.createCalls, 0);
  assert.ok(create.soundReady.selectedValues.some((value) => value.includes(copy[locale].genre)));
  assert.ok(create.soundReady.selectedValues.some((value) => value.includes(copy[locale].mood)));

  assertCommon(create.identity, locale, width, height, `${context} Identity`);
  assert.equal(create.identity.activeStep, 2);
  assert.equal(create.identity.actionCount, 1);
  assert.equal(create.identity.candidateCount, 3);
  assert.equal(create.identity.identityRequestCount, 1);
  assert.equal(create.identity.createCalls, 0);

  assertCommon(create.review, locale, width, height, `${context} Review`);
  assert.equal(create.review.activeStep, 3);
  assert.equal(create.review.actionCount, 1);
  assert.equal(create.review.actionDisabled, false);
  assert.equal(create.review.identityRequestCount, 1);
  assert.equal(create.review.createCalls, 0);
  assert.match(create.review.reviewText, /Night Cartographer/);
  assert.match(create.review.reviewText, /Maps patient rhythms into luminous shared journeys\./);
  assert.match(create.review.reviewText, new RegExp(copy[locale].review));
  assert.match(create.review.reviewText, new RegExp(copy[locale].genre));
  assert.match(create.review.reviewText, new RegExp(copy[locale].mood));

  const expectedResizeModes = ["compact", "wide", "compact"];
  create.resizeSnapshots.forEach((snapshot, index) => {
    assert.equal(snapshot.contentMode, expectedResizeModes[index]);
    assert.equal(snapshot.activeStep, 3);
    assert.equal(snapshot.identityRequestCount, 1);
    assert.equal(snapshot.createCalls, 0);
    assert.match(snapshot.reviewText, /Night Cartographer/);
  });
  assert.equal(create.restored.contentMode, mode);
  assert.equal(create.restored.activeStep, 3);
  assert.equal(create.restored.identityRequestCount, 1);
  assert.equal(create.restored.createCalls, 0);
  assert.equal(create.submitted.createCalls, 1);
  assert.deepEqual(create.history, {
    entriesAdded: 2,
    afterBack: 2,
    afterSecondBack: 1,
    afterForward: 2,
    afterSecondForward: 3,
    createCalls: [0, 0, 0, 0],
  });
  assert.equal(create.reachability.actionVisible, true);
  assert.equal(create.reachability.actionFocused, true);
  assert.ok(create.reachability.actionTabIndex >= 0);

  if (create.zoom) {
    assert.equal(create.zoom.viewportWidth, 512);
    assert.equal(create.zoom.viewportHeight, 384);
    assert.equal(create.zoom.actionVisible, true);
    assert.equal(create.zoom.actionFocused, true);
    assert.ok(create.zoom.actionTabIndex >= 0);
    assert.ok(create.zoom.documentScrollWidth <= 512);
  }
}

function assertTrainCell(cell, direction) {
  const { locale, width, height, train } = cell;
  const context = `Train ${locale} ${width}x${height}`;
  for (const [name, snapshot] of [["initial", train.initial], ["edited", train.edited]]) {
    assertCommon(snapshot, locale, width, height, `${context} ${name}`);
    assert.equal(snapshot.contentDirection, direction);
    assert.equal(snapshot.railDisplay, direction === "row" ? "flex" : "none");
    assert.equal(snapshot.reviewPosition, direction === "row" ? "sticky" : "relative");
    assert.equal(snapshot.actionCount, 1);
    assert.equal(snapshot.actionDisabled, false);
    assert.equal(snapshot.updateCalls, 0);
    assert.match(snapshot.reviewText, /7\/10/);
  }
  for (const [dialog, opener] of [
    [train.genresDialog, copy[locale].editGenres],
    [train.moodsDialog, copy[locale].editMoods],
  ]) {
    assert.equal(dialog.opened.dialogCount, 1);
    assert.equal(dialog.reverseWrap, dialog.last);
    assert.equal(dialog.forwardWrap, dialog.first);
    assert.equal(dialog.escaped.dialogFocus, opener);
    assertTargets(dialog.opened, `${context} dialog`);
    assert.equal(dialog.progressive.checkedBefore, true);
    assert.equal(dialog.progressive.checkedAfter, true);
    assert.match(dialog.progressive.limitAnnouncement, /Choose at least 1/);
  }
  assert.equal(train.saved.updateCalls, 1);
  assert.equal(train.saved.updateInput.energy, 7);
  assert.equal(train.saved.updateInput.vibe, "Patient aurora drive");
  assert.equal(train.saved.updateInput.regenerateAvatar, false);
  assert.match(train.saved.reviewText, /7\/10/);
  assert.equal(train.reachability.actionVisible, true);
  assert.equal(train.reachability.actionFocused, true);
  assert.ok(train.reachability.actionTabIndex >= 0);
  if (train.zoom) {
    assert.equal(train.zoom.actionVisible, true);
    assert.equal(train.zoom.actionFocused, true);
    assert.ok(train.zoom.actionTabIndex >= 0);
    assert.ok(train.zoom.documentScrollWidth <= 512);
  }
}

async function runRunner() {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [runner], {
      cwd: projectRoot,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 420_000,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => child.kill(signal));
    }
  });
}

async function main() {
  const { stdout } = await runRunner();
  const result = JSON.parse(stdout);
  assert.equal(result.fixture, "real-create-and-train-dj-production-screens");
  assert.equal(result.cells.length, viewports.length * 2);
  assert.deepEqual(
    result.cells.map(({ locale, width, height }) => `${locale}:${width}x${height}`),
    ["en", "es"].flatMap((locale) =>
      viewports.map(([width, height]) => `${locale}:${width}x${height}`)),
  );

  for (const cell of result.cells) {
    const expected = viewports.find(
      ([width, height]) => width === cell.width && height === cell.height,
    );
    assert.ok(expected);
    assertCreateCell(cell, expected[2]);
    assertTrainCell(cell, expected[3]);
  }

  for (const locale of ["en", "es"]) {
    const fallback = result.reloadFallback[locale];
    assert.equal(fallback.activeStep, 1);
    assert.equal(fallback.routeStep, "sound");
    assert.equal(fallback.actionCount, 1);
    assert.equal(fallback.actionDisabled, true);
    assert.equal(fallback.selectedValues.length, 0);
    assert.equal(fallback.identityRequestCount, 0);
    assert.equal(fallback.createCalls, 0);
    assert.ok(fallback.setParamsCalls >= 1);
    assert.equal(fallback.pushCalls, 0);
  }

  process.stdout.write(
    "Create/Train DJ browser matrix passed for 18 locale/viewport cells: real production dialogs, progressive selection, focus traps, overflow/targets, every-cell CTA reachability, Back/Forward step history, reload fallback, submit gating, and Train energy 7 parity.\n",
  );
}

main().catch((error) => {
  if (error.stderr) process.stderr.write(error.stderr);
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
