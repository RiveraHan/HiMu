const { spawn } = require("node:child_process");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../../..");
const fixtureEntry = path.join(
  harnessDirectory,
  "SettingsWorkflow-browser-fixture.tsx",
);
const hookStub = path.join(harnessDirectory, "settings-browser-hooks.ts");
const authStub = path.join(
  harnessDirectory,
  "settings-auth-browser-stub.ts",
);
const routerStub = path.join(
  harnessDirectory,
  "settings-expo-router-browser-stub.ts",
);
const evidenceDirectory = path.join(
  projectRoot,
  ".superpowers/sdd/2026-08-20-web-workflows-plan/task-4-evidence",
);

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

async function readSettings(cdp, route, direction) {
  let lastState;
  try {
    return await waitFor(
      async () => {
        const state = await evaluate(
          cdp,
          `(() => {
            if (window.__HIMU_BROWSER_ERROR__) return { error: window.__HIMU_BROWSER_ERROR__ };
            if (!window.__HIMU_SETTINGS_READY__ || !window.__HIMU_SETTINGS_READ__) return null;
            return window.__HIMU_SETTINGS_READ__();
          })()`,
        );
        lastState = state;
        if (state?.error) throw new Error(state.error);
        return state?.route === route && state?.direction === direction ? state : null;
      },
      `Production ${route} settings did not reach ${direction}`,
    );
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; last state: ${JSON.stringify(lastState)}`,
    );
  }
}

async function clickLabel(cdp, label, index = 0) {
  await evaluate(
    cdp,
    `(() => {
      const matches = Array.from(document.querySelectorAll('[aria-label]')).filter(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)}
      );
      const target = matches[${index}];
      if (!target) throw new Error('Missing production control: ${label}');
      target.click();
    })()`,
  );
}

async function capture(cdp, route, width, height) {
  const capture = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const filePath = path.join(
    evidenceDirectory,
    `${route}-${width}x${height}.png`,
  );
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(capture.data, "base64"));
  return { filePath, bytes: fs.statSync(filePath).size };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Settings browser integration requires Chrome");
  process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://browser-fixture.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||= "browser-fixture-anon-key";
  process.env.EXPO_PUBLIC_TERMS_URL = "https://himu.app/terms";
  process.env.EXPO_PUBLIC_PRIVACY_URL = "https://himu.app/privacy";
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "himu-settings-workflow-"),
  );
  let browser;
  let cdp;

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const htmlPath = path.join(outputDirectory, "fixture.html");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    const hookModules = new Set([
      "@/src/audio/use-player",
      "@/src/hooks/use-auth",
      "@/src/hooks/use-music-preferences",
      "@/src/hooks/use-online-status",
      "@/src/hooks/use-profile",
      "@/src/hooks/use-tab-bar-padding",
      "@/src/hooks/use-toast",
    ]);

    metroConfig.resolver.blockList = metroConfig.resolver.blockList.filter(
      (pattern) => !pattern.test(fixtureEntry),
    );
    metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
      const webContext =
        platform === "web"
          ? {
              ...context,
              preferNativePlatform: false,
              mainFields: ["browser", "module", "main"],
            }
          : context;
      const target = hookModules.has(moduleName)
        ? hookStub
        : moduleName === "@/src/api/auth"
          ? authStub
          : moduleName === "expo-router"
            ? routerStub
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
    fs.writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><style>
        html, body, #root { display: flex; margin: 0; width: 100%; height: 100%; overflow: hidden; }
      </style></head><body><div id="root"></div><script>
        globalThis.process = { env: {
          EXPO_PUBLIC_SUPABASE_URL: "https://browser-fixture.supabase.co",
          EXPO_PUBLIC_SUPABASE_KEY: "browser-fixture-anon-key",
          EXPO_PUBLIC_TERMS_URL: "https://himu.app/terms",
          EXPO_PUBLIC_PRIVACY_URL: "https://himu.app/privacy"
        } };
        window.addEventListener("error", (event) => {
          window.__HIMU_BROWSER_ERROR__ = event.error && event.error.stack
            ? event.error.stack
            : event.message;
        });
        window.addEventListener("unhandledrejection", (event) => {
          window.__HIMU_BROWSER_ERROR__ = String(event.reason);
        });
      </script><script src="${path.basename(bundlePath)}"></script></body></html>`,
    );

    browser = spawn(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDirectory}`,
        `file://${htmlPath}`,
      ],
      { stdio: "ignore" },
    );

    const devToolsFile = path.join(profileDirectory, "DevToolsActivePort");
    const devTools = await waitFor(
      () =>
        fs.existsSync(devToolsFile) &&
        fs.readFileSync(devToolsFile, "utf8"),
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
    await resize(cdp, 390, 844);
    await cdp.send("Page.reload", { ignoreCache: true });

    await readSettings(cdp, "preferences", "column");
    await clickLabel(cdp, "Chill & Ambient");
    await waitFor(
      async () =>
        evaluate(
          cdp,
          `Array.from(document.querySelectorAll('[aria-label]')).some(
            (element) => element.getAttribute('aria-label') === 'Ambient'
          )`,
        ),
      "Ambient preference did not expand",
    );
    await clickLabel(cdp, "Ambient");
    const compactPreferences = await waitFor(async () => {
      const state = await readSettings(cdp, "preferences", "column");
      return state.preferenceGenres.includes("Ambient") ? state : null;
    }, "Preference save did not settle");
    const compactPreferencesScreenshot = await capture(
      cdp,
      "preferences",
      390,
      844,
    );

    await resize(cdp, 1440, 900);
    const desktopPreferences = await readSettings(cdp, "preferences", "row");
    const desktopPreferencesScreenshot = await capture(
      cdp,
      "preferences",
      1440,
      900,
    );

    await evaluate(cdp, `window.__HIMU_SETTINGS_ROUTE__('account')`);
    const desktopAccount = await readSettings(cdp, "account", "row");
    const desktopAccountScreenshot = await capture(cdp, "account", 1440, 900);

    await resize(cdp, 390, 844);
    const compactAccount = await readSettings(cdp, "account", "column");
    const compactAccountScreenshot = await capture(cdp, "account", 390, 844);

    await evaluate(cdp, `window.__HIMU_SETTINGS_SET_LOCALE_SAVING__(true)`);
    const savingAccount = await waitFor(async () => {
      const state = await readSettings(cdp, "account", "column");
      return state.languageDisabled ? state : null;
    }, "Language save state did not disable the production row");
    await evaluate(cdp, `window.__HIMU_SETTINGS_SET_LOCALE_SAVING__(false)`);
    await waitFor(async () => {
      const state = await readSettings(cdp, "account", "column");
      return !state.languageDisabled ? state : null;
    }, "Language row did not recover from save state");

    const beforeSession = compactAccount.counters;
    await clickLabel(cdp, "Sign Out");
    await waitFor(
      async () =>
        evaluate(
          cdp,
          `Array.from(document.querySelectorAll('[aria-label]')).some(
            (element) => element.getAttribute('aria-label') === 'Cancel'
          )`,
        ),
      "Sign-out confirmation did not render",
    );
    await clickLabel(cdp, "Cancel");
    const afterCancel = await readSettings(cdp, "account", "column");
    await clickLabel(cdp, "Sign Out");
    await waitFor(
      async () =>
        evaluate(
          cdp,
          `Array.from(document.querySelectorAll('[aria-label]')).filter(
            (element) => element.getAttribute('aria-label') === 'Sign Out'
          ).length === 2`,
        ),
      "Destructive confirmation action did not render",
    );
    await clickLabel(cdp, "Sign Out", 1);
    const afterConfirm = await waitFor(async () => {
      const state = await readSettings(cdp, "account", "column");
      return state.counters.signOuts === 1 && state.counters.redirects === 1
        ? state
        : null;
    }, "Confirmed sign out did not flush and redirect");

    await resize(cdp, 720, 422);
    await readSettings(cdp, "account", "column");
    const zoomReachability = await evaluate(
      cdp,
      `(async () => {
        const scroll = document.querySelector('[data-testid="account-settings-scroll"]');
        const action = Array.from(document.querySelectorAll('[aria-label]')).find(
          (element) => element.getAttribute('aria-label') === 'Sign Out'
        );
        if (!scroll || !action) throw new Error('Missing production zoom controls');
        scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'instant' });
        action.focus();
        action.scrollIntoView({ block: 'center' });
        await new Promise((resolve) => requestAnimationFrame(
          () => requestAnimationFrame(() => resolve())
        ));
        const scrollRect = scroll.getBoundingClientRect();
        const actionRect = action.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollTop: scroll.scrollTop,
          actionVisible: actionRect.top >= scrollRect.top && actionRect.bottom <= scrollRect.bottom,
          actionFocused: document.activeElement === action,
          actionTabIndex: action.tabIndex,
        };
      })()`,
    );

    process.stdout.write(
      JSON.stringify({
        snapshots: {
          compactPreferences,
          desktopPreferences,
          desktopAccount,
          compactAccount,
          savingAccount,
        },
        session: { beforeSession, afterCancel: afterCancel.counters, afterConfirm: afterConfirm.counters },
        zoomReachability,
        screenshots: [
          compactPreferencesScreenshot,
          desktopPreferencesScreenshot,
          compactAccountScreenshot,
          desktopAccountScreenshot,
        ],
      }),
    );
  } finally {
    cdp?.close();
    if (browser && browser.exitCode === null) {
      const gracefulExit = new Promise((resolve) =>
        browser.once("exit", resolve),
      );
      browser.kill("SIGTERM");
      await Promise.race([
        gracefulExit,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (browser.exitCode === null) {
        const forcedExit = new Promise((resolve) =>
          browser.once("exit", resolve),
        );
        browser.kill("SIGKILL");
        await Promise.race([
          forcedExit,
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    fs.rmSync(outputDirectory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
