const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/beta-onboarding-browser/run-public-intro-responsive-browser.cjs",
);
const {
  createIdempotentCleanup,
  installSignalCleanup,
  stopChild,
} = require(path.join(
  projectRoot,
  "test-support/beta-onboarding-browser/signal-cleanup.cjs",
));

const viewports = [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1023, 768],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [720, 422],
  [512, 384],
];

const headings = {
  en: [
    "From an emotion to a track",
    "Choose who shapes it",
    "Listen, save, and share",
  ],
  es: [
    "De una emoción a un track",
    "Elige quién le da forma",
    "Escucha, guarda y comparte",
  ],
};

function expectedKeyboardOrder(locale, primary) {
  const actionCopy = locale === "es"
    ? { back: "Atrás", existing: "Ya tengo una cuenta" }
    : { back: "Back", existing: "I already have an account" };
  const forward = [actionCopy.back, primary, actionCopy.existing];
  return {
    forward,
    reverse: [...forward].reverse(),
  };
}

function assertSnapshot(snapshot, locale, step, width, height) {
  assert.equal(snapshot.viewportWidth, width);
  assert.equal(snapshot.viewportHeight, height);
  assert.ok(
    snapshot.documentScrollWidth <= width,
    `${locale} ${width}x${height} step ${step} overflows horizontally: ${snapshot.documentScrollWidth}`,
  );
  assert.equal(snapshot.primaryCtaCount, 1);
  assert.equal(snapshot.primaryFocusable, true);
  assert.ok(snapshot.primaryRect.width >= 44);
  assert.ok(snapshot.primaryRect.height >= 44);
  assert.equal(snapshot.fixedObstructionCount, 0);
  assert.equal(snapshot.dialogCount, 0);
  assert.equal(snapshot.contentBeforeActions, true);
  assert.equal(snapshot.currentStep, step);
  assert.equal(snapshot.visibleHeading, headings[locale][step - 1]);
  const actionCopy = locale === "es"
    ? {
        back: "Atrás",
        continue: "Continuar",
        create: "Crear mi primer track",
        existing: "Ya tengo una cuenta",
      }
    : {
        back: "Back",
        continue: "Continue",
        create: "Create my first track",
        existing: "I already have an account",
      };
  assert.deepEqual(
    snapshot.actionOrder,
    step === 1
      ? [actionCopy.continue, actionCopy.existing]
      : [
          actionCopy.back,
          step === 3 ? actionCopy.create : actionCopy.continue,
          actionCopy.existing,
        ],
  );
  assert.deepEqual(snapshot.progress, {
    min: 1,
    max: 3,
    now: step,
    text: locale === "es" ? `Página ${step} de 3` : `Page ${step} of 3`,
  });
}

async function main() {
  let runnerChild;
  const cleanup = createIdempotentCleanup(() => stopChild(runnerChild));
  const signalCleanup = installSignalCleanup(cleanup);

  try {
    const { stdout } = await new Promise((resolve, reject) => {
      runnerChild = execFile(process.execPath, [runner], {
        cwd: projectRoot,
        maxBuffer: 32 * 1024 * 1024,
        timeout: 180_000,
      }, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
    const result = JSON.parse(stdout);
    assert.equal(result.fixture, "real-app-welcome-and-public-product-intro");
    assert.equal(result.cells.length, viewports.length * 2);

    const expectedCells = ["en", "es"].flatMap((locale) =>
      viewports.map(([width, height]) => `${locale}:${width}x${height}`),
    );
    assert.deepEqual(
      result.cells.map(({ locale, width, height }) => `${locale}:${width}x${height}`),
      expectedCells,
    );

    for (const cell of result.cells) {
      const { locale, width, height } = cell;
      assertSnapshot(cell.steps[0], locale, 1, width, height);
      assertSnapshot(cell.steps[1], locale, 2, width, height);
      assertSnapshot(cell.steps[2], locale, 3, width, height);
      assert.equal(cell.steps[1].focusedTestId, "public-intro-heading");
      assert.equal(cell.steps[2].focusedTestId, "public-intro-heading");
      const primaryCopy = locale === "es"
        ? { step2: "Continuar", step3: "Crear mi primer track" }
        : { step2: "Continue", step3: "Create my first track" };
      assert.deepEqual(
        cell.keyboard.step2,
        expectedKeyboardOrder(locale, primaryCopy.step2),
        `${locale} ${width}x${height} must traverse every step-2 action with real Tab and Shift+Tab input`,
      );
      assert.deepEqual(
        cell.keyboard.step3,
        expectedKeyboardOrder(locale, primaryCopy.step3),
        `${locale} ${width}x${height} must traverse every step-3 action with real Tab and Shift+Tab input`,
      );
      assert.deepEqual(cell.history, {
        afterBack: 2,
        afterSecondBack: 1,
        afterForward: 2,
        afterSecondForward: 3,
        pushedEntries: 2,
      });
      assertSnapshot(cell.reload, locale, 3, width, height);
      assert.deepEqual(cell.resizeSteps, [3, 3, 3]);
      assert.deepEqual(cell.replay, {
        introWrites: 0,
        intentWrites: 0,
        destination: "/(app)",
      });

      if (width === 512 && height === 384) {
        assert.deepEqual(cell.zoomReachability, {
          reachable: true,
          focused: true,
          tabIndex: 0,
        });
      } else {
        assert.equal(cell.zoomReachability, null);
      }
    }

    process.stdout.write(
      `Beta onboarding browser matrix passed: ${result.cells.length} locale/viewport cells, real CDP Tab/Shift+Tab order, history, reload/replay/resize, and 200% effective zoom reachability.\n`,
    );
  } finally {
    signalCleanup.dispose();
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
