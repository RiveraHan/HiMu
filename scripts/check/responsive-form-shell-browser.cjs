const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../..");
const runner = path.join(
  projectRoot,
  "test-support/form-shell-browser/run-responsive-form-shell-browser.cjs",
);

async function main() {
  const runFixture = async (fixture, viewport) => {
    const { stdout } = await execFileAsync(process.execPath, [runner], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HIMU_BROWSER_FIXTURE: fixture,
        ...(viewport ? {
          HIMU_BROWSER_WIDTH: String(viewport.width),
          HIMU_BROWSER_HEIGHT: String(viewport.height),
        } : {}),
      },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60_000,
    });
    return JSON.parse(stdout);
  };
  const result = await runFixture("form");

  assert.deepEqual(result.productionTree, {
    shellInScroll: true,
    longFormInScroll: true,
    longReviewInScroll: true,
    footerInScroll: true,
    actionInFooter: true,
  });
  assert.deepEqual(result.viewport, {
    width: 720,
    height: 422,
    scrollRenderedWidth: 720,
    scrollRenderedHeight: 422,
  });
  assert.deepEqual(result.productionScrollCss, {
    overflowX: "scroll",
    overflowY: "scroll",
    flexGrow: "1",
    flexShrink: "1",
    flexBasis: "0%",
    contentFlexGrow: "1",
  });
  assert.deepEqual(result.beforeScroll, {
    scrollTop: 0,
    actionBelowViewport: true,
  });
  assert.equal(result.afterScroll.actionVisible, true);
  assert.equal(result.afterScroll.actionFocused, true);
  assert.equal(result.afterScroll.actionTabIndex, 0);
  assert.ok(result.afterScroll.scrollTop > 0);
  assert.deepEqual(result.compositeStyleForwarding, {
    direct: {
      height: "61px",
      minHeight: "61px",
      padding: "11px",
      gap: "7px",
    },
    glass: {
      height: "62px",
      minHeight: "62px",
      padding: "12px",
      gap: "8px",
    },
    canvas: {
      height: "64px",
      minHeight: "64px",
      padding: "16px",
      gap: "12px",
    },
    avatar: {
      width: "64px",
      height: "64px",
      borderRadius: "9999px",
    },
    image: {
      width: "73px",
      height: "53px",
      borderRadius: "17px",
    },
    imageNative: {
      width: "73px",
      height: "53px",
      position: "absolute",
    },
    equalizerBar: {
      width: "3px",
      height: "14px",
      borderRadius: "9999px",
    },
  });

  assert.deepEqual(await runFixture("image"), {
    frame: { width: "64px", height: "64px", borderRadius: "9999px" },
  });
  assert.deepEqual(await runFixture("animated"), {
    width: "3px",
    height: "14px",
    borderRadius: "9999px",
  });
  assert.deepEqual(await runFixture("canvas"), {
    height: "64px",
    minHeight: "64px",
    padding: "16px",
    gap: "12px",
  });
  assert.deepEqual(await runFixture("gesture"), {
    height: "63px",
    minHeight: "63px",
    padding: "13px",
    gap: "9px",
  });
  const login390 = await runFixture("login", { width: 390, height: 844 });
  const login768 = await runFixture("login", { width: 768, height: 1024 });
  const login1024 = await runFixture("login", { width: 1024, height: 1366 });
  const login1440 = await runFixture("login", { width: 1440, height: 900 });
  for (const compactLogin of [login390, login768]) {
    assert.ok(compactLogin.promise.height >= 180, "compact promise must keep its intrinsic height");
    assert.ok(compactLogin.signIn.top > compactLogin.promise.top);
    assert.ok(compactLogin.signIn.height <= 180, "compact sign-in must remain content-sized");
    assert.ok(compactLogin.action.top >= compactLogin.signIn.top);
    assert.ok(compactLogin.footer.bottom <= compactLogin.signIn.bottom + 1);
    assert.ok(
      compactLogin.footer.top - compactLogin.action.bottom <= 40,
      "compact sign-in must not contain a giant empty field",
    );
    assert.equal(compactLogin.signInStyle.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(compactLogin.signInStyle.backdropFilter, "none");
  }
  for (const [desktopLogin, viewportWidth] of [
    [login1024, 1024],
    [login1440, 1440],
  ]) {
    assert.ok(desktopLogin.signIn.height >= 360, "desktop sign-in must keep its designed minimum height");
    assert.ok(desktopLogin.signIn.width <= 440);
    assert.ok(
      Math.abs(desktopLogin.promise.top - desktopLogin.signIn.top) <= 1 &&
      Math.abs(desktopLogin.promise.bottom - desktopLogin.signIn.bottom) <= 1,
      "desktop promise and sign-in panels must share one vertical alignment",
    );
    assert.ok(
      Math.abs(
        (desktopLogin.promise.centerX + desktopLogin.signIn.centerX) / 2 -
        viewportWidth / 2,
      ) <= 1,
      "desktop login columns must be centered as one composition",
    );
    assert.notEqual(desktopLogin.signInStyle.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.notEqual(desktopLogin.signInStyle.backdropFilter, "none");
  }

  process.stdout.write(
    "Responsive form shell browser check passed: production scroll flow, focus, 200% zoom reachability, and GlassCard style forwarding.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
