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
  const runFixture = async (fixture) => {
    const { stdout } = await execFileAsync(process.execPath, [runner], {
      cwd: projectRoot,
      env: { ...process.env, HIMU_BROWSER_FIXTURE: fixture },
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
  const compactLogin = await runFixture("login");
  assert.ok(compactLogin.promise.height >= 180, "compact promise must keep its intrinsic height");
  assert.ok(compactLogin.signIn.top > compactLogin.promise.top);
  assert.ok(compactLogin.action.top >= compactLogin.signIn.top);
  assert.ok(compactLogin.action.bottom <= compactLogin.signIn.bottom);

  process.stdout.write(
    "Responsive form shell browser check passed: production scroll flow, focus, 200% zoom reachability, and GlassCard style forwarding.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
