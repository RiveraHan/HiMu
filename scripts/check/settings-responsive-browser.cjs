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

const expected = {
  en: {
    sections: ["Favorite genres", "Usual atmosphere", "Moods to avoid"],
    balanced: "Balanced",
    firstGenre: "Ambient",
    removedGenre: "Ambient",
    firstMood: "Focus",
    transport: ["Previous track", "Play", "Next"],
  },
  es: {
    sections: ["Géneros favoritos", "Atmósfera habitual", "Estados de ánimo que evitar"],
    balanced: "Equilibrada",
    firstGenre: "Ambiente",
    removedGenre: "Ambient",
    firstMood: "Concentración",
    transport: ["Pista anterior", "Reproducir", "Siguiente"],
  },
};

function assertNoHorizontalOverflow(snapshot, context) {
  assert.ok(
    snapshot.documentScrollWidth <= snapshot.documentClientWidth,
    `${context} horizontally overflowed: ${snapshot.documentScrollWidth} > ${snapshot.documentClientWidth}`,
  );
}

function assertTargetSizes(targets, context) {
  for (const target of targets) {
    assert.ok(target.rect, `${context} ${target.label} has no rectangle`);
    assert.ok(
      target.rect.width >= 44 && target.rect.height >= 44,
      `${context} ${target.label} is ${target.rect.width}x${target.rect.height}`,
    );
    assert.ok(
      target.role === "radio" ? target.tabIndex >= -1 : target.tabIndex >= 0,
      `${context} ${target.label} is not focusable`,
    );
  }
}

function assertDialog(snapshot, context) {
  const dialog = snapshot.dialog;
  assert.ok(dialog?.rect, `${context} dialog is missing`);
  assert.ok(dialog.rect.left >= 0, `${context} dialog escaped left viewport`);
  assert.ok(dialog.rect.top >= 0, `${context} dialog escaped top viewport`);
  assert.ok(dialog.rect.right <= snapshot.viewportWidth, `${context} dialog escaped right viewport`);
  assert.ok(dialog.rect.bottom <= snapshot.viewportHeight, `${context} dialog escaped bottom viewport`);
  assert.ok(dialog.focusableCount >= 3, `${context} dialog has too few focusable controls`);
  assertTargetSizes(dialog.targetRects, `${context} dialog target`);
}

function assertOnePreferenceColumn(snapshot, context) {
  assert.equal(snapshot.sectionRects.length, 3, `${context} did not expose three section rectangles`);
  const [first, second, third] = snapshot.sectionRects;
  for (const section of snapshot.sectionRects) assert.ok(section, `${context} section rectangle is missing`);
  assert.ok(first.top < second.top && second.top < third.top, `${context} sections are not vertically ordered`);
  assert.ok(
    Math.max(first.left, second.left, third.left) - Math.min(first.left, second.left, third.left) <= 1,
    `${context} sections do not share one readable column`,
  );
  assert.ok(
    Math.max(first.width, second.width, third.width) - Math.min(first.width, second.width, third.width) <= 1,
    `${context} section widths diverge`,
  );
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function main() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(process.execPath, [runner], {
      cwd: projectRoot,
      maxBuffer: 40 * 1024 * 1024,
      timeout: 300_000,
    }));
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nRunner stderr:\n${error?.stderr || "<empty>"}`,
    );
  }
  const result = JSON.parse(stdout);

  assert.equal(result.preferences.length, 18, "Expected the complete EN/ES preference viewport matrix");
  for (const cell of result.preferences) {
    const labels = expected[cell.locale];
    const context = `${cell.locale} ${cell.width}x${cell.height}`;
    assert.equal(cell.base.viewportWidth, cell.width, `${context} width mismatch`);
    assert.equal(cell.base.viewportHeight, cell.height, `${context} height mismatch`);
    assert.deepEqual(cell.base.preferenceSectionOrder, labels.sections, `${context} section order mismatch`);
    assert.deepEqual(cell.base.visibleLegacyLabels, [], `${context} rendered a retired preference label`);
    assert.equal(cell.base.atmosphereRadioCount, 3, `${context} atmosphere count mismatch`);
    assert.equal(cell.base.selectedAtmosphereLabel, labels.balanced, `${context} did not default to Balanced`);
    assert.equal(cell.base.selectedAtmosphereTabIndex, 0, `${context} checked radio left the roving tab stop`);
    assert.equal(cell.arrowed.selectedAtmosphereLabel, cell.locale === "en" ? "Intense" : "Intensa", `${context} ArrowRight did not select the next atmosphere`);
    assert.equal(cell.arrowed.selectedAtmosphereTabIndex, 0, `${context} ArrowRight left the roving tab stop behind`);
    assert.equal(cell.arrowed.activeLabel, cell.locale === "en" ? "Intense" : "Intensa", `${context} ArrowRight did not move focus to the checked radio`);
    assert.deepEqual(
      cell.base.preferences.genres,
      ["Ambient", "Drone", "Lo-Fi", "Chillhop", "Downtempo", "Trip-Hop"],
      `${context} truncated/reordered the over-limit genre row`,
    );
    assert.deepEqual(
      cell.base.preferences.excludedMoods,
      ["Focus", "Relax", "Dreamy", "Meditate"],
      `${context} truncated/reordered the over-limit mood row`,
    );
    assertNoHorizontalOverflow(cell.base, context);
    assertOnePreferenceColumn(cell.base, context);
    assertTargetSizes(cell.base.targetRects, `${context} preference target`);
    assert.equal(cell.saving.saveStatus, cell.locale === "en" ? "Saving" : "Guardando");
    assertDialog(cell.genreDialog, `${context} genre`);
    assert.equal(
      cell.backwardTrap.dialog.activeLabel ?? cell.backwardTrap.dialog.activeText,
      cell.backwardTrap.dialog.lastLabel,
      `${context} Shift+Tab did not wrap to the dialog end`,
    );
    assert.equal(
      cell.forwardTrap.dialog.activeLabel ?? cell.forwardTrap.dialog.activeText,
      cell.forwardTrap.dialog.firstLabel,
      `${context} Tab did not wrap to the dialog start`,
    );
    assertDialog(cell.moodDialog, `${context} mood`);
    assert.equal(cell.afterDone.dialog, null, `${context} Done left the dialog mounted`);
    assert.equal(cell.afterEscape.dialog, null, `${context} Escape left the dialog mounted`);
    assert.equal(cell.saved.preferences.atmosphere, "intense", `${context} atmosphere did not persist`);
    assert.ok(!cell.saved.preferences.genres.includes(labels.removedGenre), `${context} real picker action did not persist`);
    assert.ok(cell.saved.counters.preferenceSaves >= 1, `${context} did not call the preference persistence seam`);
    assert.deepEqual(cell.remounted.preferences, cell.saved.preferences, `${context} save did not survive remount`);
  }

  assert.equal(result.players.length, 6, "Expected narrow/medium/wide Player checks in EN/ES");
  for (const cell of result.players) {
    const labels = expected[cell.locale];
    const context = `${cell.locale} player ${cell.width}x${cell.height}`;
    assertNoHorizontalOverflow(cell.shown, context);
    assert.equal(cell.shown.nudgeVisible, true, `${context} did not show track-first nudge`);
    assert.ok(cell.shown.nudgeRect, `${context} nudge has no rectangle`);
    assert.notEqual(cell.shown.nudgePosition, "fixed", `${context} nudge became a fixed overlay`);
    assert.notEqual(cell.shown.nudgePosition, "sticky", `${context} nudge became sticky`);
    const coreControls = labels.transport.map((label) => {
      const control = cell.shown.playbackControlRects.find((candidate) => candidate.label === label);
      assert.ok(control, `${context} is missing ${label}`);
      return control;
    });
    assertTargetSizes(coreControls, `${context} transport`);
    for (const control of coreControls) {
      assert.equal(intersects(cell.shown.nudgeRect, control.rect), false, `${context} nudge covers ${control.label}`);
    }
    assert.equal(cell.afterPlay.counters.playerToggles, 1, `${context} Play was blocked`);
    assert.ok(
      cell.accepted.routeCalls.some((call) => call.method === "push" && call.href === "/preferences"),
      `${context} acceptance did not route to Preferences`,
    );
    for (const terminal of [
      cell.dismissed,
      cell.dismissedRemount,
      cell.completed,
      cell.completedRemount,
    ]) {
      assert.equal(terminal.nudgeVisible, false, `${context} terminal nudge reappeared`);
    }
  }

  process.stdout.write(
    "Settings release browser check passed: EN/ES preference matrix, low-height and 200%-effective cells, dialogs/focus/save, and non-blocking Player nudge.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
