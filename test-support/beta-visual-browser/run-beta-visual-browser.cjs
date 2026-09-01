const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");
const {
  installSignalCleanup,
  stopChild,
} = require("../beta-onboarding-browser/signal-cleanup.cjs");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
const fixtureEntry = path.join(harnessDirectory, "BetaVisual-browser-fixture.tsx");
const cells = [
  ["320x640", 320, 640, 100],
  ["390x844", 390, 844, 100],
  ["768x1024", 768, 1024, 100],
  ["1024x768", 1024, 768, 100],
  ["1440x900", 1440, 900, 100],
  ["720x422", 720, 422, 100],
  ["200% zoom", 720, 900, 200],
];

function findChrome() {
  return [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

async function waitFor(check, message, timeout = 20_000) {
  const startedAt = Date.now();
  let lastValue;
  while (true) {
    lastValue = await check();
    if (lastValue) return lastValue;
    if (Date.now() - startedAt > timeout) {
      throw new Error(`${message}; last value: ${JSON.stringify(lastValue)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Browser evaluation failed",
    );
  }
  return result.result.value;
}

async function dispatchTab(cdp, shift = false) {
  const modifiers = shift ? 8 : 0;
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    modifiers,
    windowsVirtualKeyCode: 9,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    modifiers,
    windowsVirtualKeyCode: 9,
  });
}

async function resize(cdp, width, height, zoomPercent) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: zoomPercent / 100 });
}

async function navigate(cdp, origin, route) {
  await cdp.send("Page.navigate", { url: `${origin}/${route}` });
  let lastNavigationState;
  try {
    await waitFor(async () => {
      try {
        lastNavigationState = await evaluate(cdp, `({
          readyState: document.readyState,
          pathname: window.location.pathname,
          fixtureReady: window.__HIMU_BETA_VISUAL_READY__ === true,
          browserError: window.__HIMU_BROWSER_ERROR__ ?? null,
          bodyText: document.body.textContent.slice(0, 500),
        })`);
        return lastNavigationState.readyState === "complete" &&
          lastNavigationState.pathname === `/${route}` &&
          lastNavigationState.fixtureReady === true;
      } catch (error) {
        lastNavigationState = { evaluationError: error?.stack ?? String(error) };
        return false;
      }
    }, `${route} visual fixture did not settle`);
  } catch (error) {
    throw new Error(`${error.message}; state ${JSON.stringify(lastNavigationState)}`);
  }
}

async function read(cdp) {
  const value = await evaluate(cdp, `(() => {
    if (window.__HIMU_BROWSER_ERROR__) throw new Error(window.__HIMU_BROWSER_ERROR__);
    return window.__HIMU_BETA_VISUAL_READ__();
  })()`);
  return value;
}

async function focusByLabel(cdp, requestedLabel, rootSelector = "body") {
  await evaluate(cdp, `(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    const target = Array.from(root.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')).find(
      (element) => (element.getAttribute('aria-label') ?? element.textContent.trim()) === ${JSON.stringify(requestedLabel)}
    );
    if (!target) throw new Error("Missing focus target: ${requestedLabel}");
    target.focus();
  })()`);
}

async function tabSequence(cdp, controls, shift) {
  const sequence = [];
  await focusByLabel(cdp, shift ? controls.at(-1) : controls[0]);
  sequence.push((await read(cdp)).activeLabel);
  for (let index = 1; index < controls.length; index += 1) {
    await dispatchTab(cdp, shift);
    sequence.push((await read(cdp)).activeLabel);
  }
  return sequence;
}

async function dialogSequence(cdp, controls, shift) {
  const sequence = [];
  await focusByLabel(
    cdp,
    shift ? controls.at(-1) : controls[0],
    '[data-testid="catalog-picker-dialog"]',
  );
  sequence.push((await read(cdp)).dialog.activeLabel);
  for (let index = 1; index < controls.length; index += 1) {
    await dispatchTab(cdp, shift);
    sequence.push((await read(cdp)).dialog.activeLabel);
  }
  return sequence;
}

async function runSurface(cdp, origin, surfaceName) {
  await navigate(cdp, origin, surfaceName);
  await evaluate(cdp, `(() => {
    const action = document.querySelector('[data-testid="beta-visual-primary-action"]');
    action.scrollIntoView({ block: "nearest", inline: "nearest" });
    action.focus();
  })()`);
  const reached = await read(cdp);
  const controls = reached.controls;
  const focusForward = await tabSequence(cdp, controls, false);
  const focusBackward = await tabSequence(cdp, controls, true);

  await focusByLabel(cdp, "Edit genres");
  await evaluate(cdp, `document.activeElement.click()`);
  const opened = await waitFor(async () => {
    const snapshot = await read(cdp);
    return snapshot.dialog ? snapshot : null;
  }, `${surfaceName} catalog dialog did not open`);
  const dialogControls = opened.dialog.controls;
  const dialogFocusForward = await dialogSequence(cdp, dialogControls, false);
  const dialogFocusBackward = await dialogSequence(cdp, dialogControls, true);
  const withDialog = await read(cdp);
  await focusByLabel(cdp, "Done", '[data-testid="catalog-picker-dialog"]');
  await evaluate(cdp, `document.activeElement.click()`);

  return {
    name: surfaceName,
    noHorizontalOverflow: reached.noHorizontalOverflow,
    primaryActionVisible: reached.primaryActionVisible,
    primaryActionReachable: reached.primaryActionReachable,
    focusForward,
    focusBackward,
    sourceOrder: reached.sourceOrder,
    dialog: {
      bounded: withDialog.dialog.bounded,
      focusForward: dialogFocusForward,
      focusBackward: dialogFocusBackward,
      sourceOrder: withDialog.dialog.sourceOrder,
    },
  };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Beta visual browser integration requires Chrome or Chromium");
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "himu-beta-visual-"));
  let browser;
  let cdp;
  let server;
  let signalCleanup;
  let chromeStderr = "";

  const cleanup = async () => {
    cdp?.close();
    if (browser) await stopChild(browser);
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(outputDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  try {
    signalCleanup = installSignalCleanup(cleanup);
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    metroConfig.resetCache = true;
    metroConfig.cacheVersion = `beta-visual-${Date.now()}`;
    metroConfig.resolver.blockList = metroConfig.resolver.blockList.filter(
      (pattern) => !pattern.test(fixtureEntry),
    );
    metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
      const webContext = platform === "web"
        ? { ...context, preferNativePlatform: false, mainFields: ["browser", "module", "main"] }
        : context;
      return context.resolveRequest(
        webContext,
        moduleName.startsWith("@/") ? path.join(projectRoot, moduleName.slice(2)) : moduleName,
        platform,
      );
    };
    await runBuild(metroConfig, {
      entry: fixtureEntry,
      platform: "web",
      dev: false,
      minify: false,
      out: bundlePath,
    });
    const bundle = fs.readFileSync(bundlePath);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html, body, #root { margin: 0; width: 100%; min-width: 0; height: 100%; }
      body { overflow: hidden; }
      #root { display: flex; }
    </style></head><body><div id="root"></div><script>
      window.addEventListener("error", (event) => {
        window.__HIMU_BROWSER_ERROR__ = event.error?.stack ?? event.message;
      });
      window.addEventListener("unhandledrejection", (event) => {
        window.__HIMU_BROWSER_ERROR__ = String(event.reason);
      });
    </script><script src="/fixture.js"></script></body></html>`;
    server = http.createServer((request, response) => {
      if (request.url === "/fixture.js") {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(bundle);
        return;
      }
      if (request.url === "/activation" || request.url === "/primary") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }
      response.writeHead(404);
      response.end("Not found");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Visual fixture did not publish a port");
    const origin = `http://127.0.0.1:${address.port}`;

    browser = spawn(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      `${origin}/activation`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    browser.stderr.on("data", (chunk) => {
      chromeStderr = `${chromeStderr}${String(chunk)}`.slice(-16_000);
    });
    const devToolsFile = path.join(profileDirectory, "DevToolsActivePort");
    let devTools;
    try {
      devTools = await waitFor(
        () => fs.existsSync(devToolsFile) && fs.readFileSync(devToolsFile, "utf8"),
        "Chrome did not publish its DevTools port",
      );
    } catch (error) {
      throw new Error(`${error.message}\nChrome stderr:\n${chromeStderr || "<empty>"}`);
    }
    const [port] = devTools.trim().split("\n");
    const pages = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      return targets.filter((target) => target.type === "page");
    }, "Chrome did not publish a page target");
    cdp = await connectCdp(pages[0].webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    const matrix = [];
    for (const [label, width, height, zoomPercent] of cells) {
      await resize(cdp, width, height, zoomPercent);
      matrix.push({
        label,
        width,
        height,
        zoomPercent,
        surfaces: [
          await runSurface(cdp, origin, "activation"),
          await runSurface(cdp, origin, "primary"),
        ],
      });
    }
    process.stdout.write(JSON.stringify({ matrix }));
  } finally {
    signalCleanup?.dispose();
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
