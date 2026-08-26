const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
const fixtureEntry = path.join(harnessDirectory, "PublicIntro-browser-fixture.tsx");
const routerStub = path.join(harnessDirectory, "expo-router-browser-stub.ts");
const authStub = path.join(harnessDirectory, "auth-store-browser-stub.ts");
const experienceStub = path.join(harnessDirectory, "experience-browser-stub.ts");

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

const copy = {
  en: {
    continue: "Continue",
    create: "Create my first track",
  },
  es: {
    continue: "Continuar",
    create: "Crear mi primer track",
  },
};

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function waitFor(check, message, timeout = 15_000) {
  const startedAt = Date.now();
  let lastValue;
  while (true) {
    lastValue = await check();
    if (lastValue) return lastValue;
    if (Date.now() - startedAt > timeout) {
      throw new Error(`${message}; last value: ${JSON.stringify(lastValue)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
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

async function resize(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    cdp,
    `new Promise((resolve) => {
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    })`,
  );
}

async function readStep(cdp, expectedStep, expectedWidth, expectedHeight, expectedFocus = false) {
  let lastState;
  try {
    return await waitFor(
      async () => {
        try {
          const state = await evaluate(
            cdp,
            `(() => {
              if (window.__HIMU_BROWSER_ERROR__) return { error: window.__HIMU_BROWSER_ERROR__ };
              if (!window.__HIMU_PUBLIC_INTRO_READY__ || !window.__HIMU_PUBLIC_INTRO_READ__) return null;
              return window.__HIMU_PUBLIC_INTRO_READ__();
            })()`,
          );
          lastState = state;
          if (state?.error) throw new Error(state.error);
          if (
            state?.currentStep !== expectedStep ||
            state?.viewportWidth !== expectedWidth ||
            state?.viewportHeight !== expectedHeight ||
            (expectedFocus && state?.focusedTestId !== "public-intro-heading")
          ) {
            return null;
          }
          return state;
        } catch (error) {
          if (String(error).includes("Execution context was destroyed")) return null;
          if (String(error).includes("Cannot find context with specified id")) return null;
          throw error;
        }
      },
      `Public intro did not reach step ${expectedStep} at ${expectedWidth}x${expectedHeight}; last state: ${JSON.stringify(lastState)}`,
    );
  } catch (error) {
    const diagnostic = await evaluate(
      cdp,
      `({
        href: window.location.href,
        readyState: document.readyState,
        fixtureReady: window.__HIMU_PUBLIC_INTRO_READY__,
        readType: typeof window.__HIMU_PUBLIC_INTRO_READ__,
        readJson: (() => {
          try { return JSON.stringify(window.__HIMU_PUBLIC_INTRO_READ__?.()); }
          catch (error) { return String(error && error.stack ? error.stack : error); }
        })(),
        browserError: window.__HIMU_BROWSER_ERROR__,
        rootText: document.querySelector('#root')?.textContent?.slice(0, 500),
        scripts: Array.from(document.scripts).map((script) => script.src || 'inline'),
      })`,
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)}; diagnostic: ${JSON.stringify(diagnostic)}`);
  }
}

async function navigate(cdp, url, expectedStep, width, height) {
  await resize(cdp, width, height);
  await cdp.send("Page.navigate", { url });
  const expectedUrl = new URL(url);
  await waitFor(
    async () => {
      try {
        return await evaluate(
          cdp,
          `window.location.pathname === ${JSON.stringify(expectedUrl.pathname)} &&
            window.location.search === ${JSON.stringify(expectedUrl.search)} &&
            document.readyState === 'complete'`,
        );
      } catch {
        return false;
      }
    },
    `Browser did not finish navigation to ${url}`,
  );
  return readStep(cdp, expectedStep, width, height);
}

async function clickLabel(cdp, label) {
  await evaluate(
    cdp,
    `(() => {
      const target = Array.from(document.querySelectorAll('[role="button"]')).find(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)}
      );
      if (!target) throw new Error('Missing production action: ' + ${JSON.stringify(label)});
      target.click();
    })()`,
  );
}

async function dispatchTab(cdp, shift = false) {
  const modifiers = shift ? 8 : 0;
  const key = {
    key: "Tab",
    code: "Tab",
    modifiers,
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  await evaluate(
    cdp,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

async function readFocusedAction(cdp, context) {
  const focused = await evaluate(
    cdp,
    `(() => {
      const active = document.activeElement;
      return {
        label: active?.getAttribute?.('aria-label') ?? active?.textContent?.trim() ?? null,
        role: active?.getAttribute?.('role') ?? null,
        testId: active?.getAttribute?.('data-testid') ?? null,
        tagName: active?.tagName ?? null,
      };
    })()`,
  );
  if (focused.role !== "button" || !focused.label) {
    throw new Error(
      `Keyboard traversal left the production action order at ${context}: ${JSON.stringify(focused)}`,
    );
  }
  return focused.label;
}

async function readKeyboardActionOrder(cdp, context) {
  const forward = [];
  for (let index = 0; index < 3; index += 1) {
    await dispatchTab(cdp);
    forward.push(await readFocusedAction(cdp, `${context} forward key ${index + 1}`));
  }

  const reverse = [forward[forward.length - 1]];
  for (let index = 1; index < 3; index += 1) {
    await dispatchTab(cdp, true);
    reverse.push(await readFocusedAction(cdp, `${context} reverse key ${index}`));
  }
  return { forward, reverse };
}

async function traverseHistory(cdp, direction, expectedStep, width, height) {
  await evaluate(cdp, `window.history.${direction}()`);
  return readStep(cdp, expectedStep, width, height);
}

async function reload(cdp, expectedStep, width, height) {
  await cdp.send("Page.reload", { ignoreCache: true });
  return readStep(cdp, expectedStep, width, height);
}

async function zoomReachability(cdp) {
  return evaluate(
    cdp,
    `(async () => {
      const scroll = document.querySelector('[data-testid="public-intro-scroll"]');
      const action = document.querySelector('[data-testid="public-intro-primary-action"]');
      if (!scroll || !action) throw new Error('Missing production zoom controls');
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'instant' });
      action.focus();
      action.scrollIntoView({ block: 'end' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scrollRect = scroll.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      return {
        reachable:
          actionRect.top >= Math.max(0, scrollRect.top) - 1 &&
          actionRect.bottom <= Math.min(window.innerHeight, scrollRect.bottom) + 1,
        focused: document.activeElement === action,
        tabIndex: action.tabIndex,
      };
    })()`,
  );
}

async function runCell(cdp, origin, locale, width, height, index) {
  const initialUrl = `${origin}/welcome?step=1&locale=${locale}&cell=${index}`;
  const initial = await navigate(cdp, initialUrl, 1, width, height);
  const historyStart = await evaluate(cdp, "window.__HIMU_ROUTER_PUSH_COUNT__ || 0");

  await clickLabel(cdp, copy[locale].continue);
  const step2 = await readStep(cdp, 2, width, height, true);
  const step2Keyboard = await readKeyboardActionOrder(
    cdp,
    `${locale} ${width}x${height} step 2`,
  );
  await clickLabel(cdp, copy[locale].continue);
  const step3 = await readStep(cdp, 3, width, height, true);
  const step3Keyboard = await readKeyboardActionOrder(
    cdp,
    `${locale} ${width}x${height} step 3`,
  );
  const pushedEntries =
    (await evaluate(cdp, "window.__HIMU_ROUTER_PUSH_COUNT__ || 0")) - historyStart;

  const afterBack = (await traverseHistory(cdp, "back", 2, width, height)).currentStep;
  const afterSecondBack = (await traverseHistory(cdp, "back", 1, width, height)).currentStep;
  const afterForward = (await traverseHistory(cdp, "forward", 2, width, height)).currentStep;
  const afterSecondForward = (await traverseHistory(cdp, "forward", 3, width, height)).currentStep;

  const reloaded = await reload(cdp, 3, width, height);
  await resize(cdp, 320, 640);
  const compactFirst = await readStep(cdp, 3, 320, 640);
  await resize(cdp, 1440, 900);
  const wide = await readStep(cdp, 3, 1440, 900);
  await resize(cdp, 320, 640);
  const compactAgain = await readStep(cdp, 3, 320, 640);
  await resize(cdp, width, height);
  await readStep(cdp, 3, width, height);

  const reachability = width === 512 && height === 384
    ? await zoomReachability(cdp)
    : null;

  const replayUrl = `${origin}/welcome?step=3&mode=replay&locale=${locale}&cell=${index}`;
  await navigate(cdp, replayUrl, 3, width, height);
  await clickLabel(cdp, copy[locale].create);
  const replay = await waitFor(
    async () => {
      try {
        const state = await evaluate(
          cdp,
          `({
            introWrites: window.__HIMU_INTRO_WRITES__ || 0,
            intentWrites: window.__HIMU_INTENT_WRITES__ || 0,
            destination: window.location.pathname,
          })`,
        );
        return state.destination === "/(app)" ? state : null;
      } catch {
        return null;
      }
    },
    `Replay isolation did not navigate for ${locale} ${width}x${height}`,
  );

  return {
    locale,
    width,
    height,
    steps: [initial, step2, step3],
    keyboard: {
      step2: step2Keyboard,
      step3: step3Keyboard,
    },
    history: {
      afterBack,
      afterSecondBack,
      afterForward,
      afterSecondForward,
      pushedEntries,
    },
    reload: reloaded,
    resizeSteps: [compactFirst.currentStep, wide.currentStep, compactAgain.currentStep],
    replay,
    zoomReachability: reachability,
  };
}

async function stopBrowser(browser) {
  if (!browser || browser.exitCode !== null) return;
  let exited = false;
  const onExit = () => {
    exited = true;
  };
  browser.once("exit", onExit);
  browser.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (!exited && browser.exitCode === null) {
    browser.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => browser.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
}

async function removeTemporaryDirectory(directory) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Beta onboarding browser integration requires Chrome");
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "himu-beta-onboarding-"));
  let browser;
  let cdp;
  let server;

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    metroConfig.resolver.blockList = metroConfig.resolver.blockList.filter(
      (pattern) => !pattern.test(fixtureEntry),
    );
    metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
      const webContext = platform === "web"
        ? {
            ...context,
            preferNativePlatform: false,
            mainFields: ["browser", "module", "main"],
          }
        : context;
      const target = moduleName === "expo-router"
        ? routerStub
        : moduleName === "@/src/stores/auth-store"
          ? authStub
          : moduleName === "@/src/experience"
            ? experienceStub
            : moduleName.startsWith("@/")
              ? path.join(projectRoot, moduleName.slice(2))
              : moduleName;
      return context.resolveRequest(webContext, target, platform);
    };

    await runBuild(metroConfig, {
      entry: fixtureEntry,
      platform: "web",
      dev: false,
      minify: false,
      out: bundlePath,
    });
    const bundle = fs.readFileSync(bundlePath);
    const fixtureHtml = `<!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        html, body, #root { display: flex; margin: 0; min-width: 0; width: 100%; height: 100%; overflow: hidden; }
        * { box-sizing: border-box; }
      </style></head><body><div id="root"></div><script>
        globalThis.process = { env: {} };
        window.addEventListener("error", (event) => {
          window.__HIMU_BROWSER_ERROR__ = event.error && event.error.stack
            ? event.error.stack
            : event.message;
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
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixtureHtml);
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Beta onboarding HTTP harness did not publish a port");
    }
    const origin = `http://127.0.0.1:${address.port}`;

    browser = spawn(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-breakpad",
        "--disable-crash-reporter",
        "--disable-background-networking",
        "--disable-component-update",
        "--no-first-run",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDirectory}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    const devToolsFile = path.join(profileDirectory, "DevToolsActivePort");
    const devTools = await waitFor(
      () => fs.existsSync(devToolsFile) && fs.readFileSync(devToolsFile, "utf8"),
      "Chrome did not publish its DevTools port",
    );
    const [port] = devTools.trim().split("\n");
    const pages = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      return targets.filter((target) => target.type === "page");
    }, "Chrome did not publish a page target");
    cdp = await connectCdp(pages[0].webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    const cells = [];
    let index = 0;
    for (const locale of ["en", "es"]) {
      for (const [width, height] of viewports) {
        cells.push(await runCell(cdp, origin, locale, width, height, index++));
      }
    }

    process.stdout.write(JSON.stringify({
      fixture: "real-app-welcome-and-public-product-intro",
      cells,
    }));
  } finally {
    cdp?.close();
    await stopBrowser(browser);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await removeTemporaryDirectory(outputDirectory);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
