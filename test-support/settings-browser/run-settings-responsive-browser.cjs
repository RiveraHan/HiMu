const { spawn } = require("node:child_process");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
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
const authScopeStub = path.join(
  harnessDirectory,
  "settings-auth-scope-browser-stub.ts",
);
const secureStorageStub = path.join(
  harnessDirectory,
  "settings-secure-storage-browser-stub.ts",
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

async function navigate(cdp, url, route, direction) {
  await cdp.send("Page.navigate", { url });
  await waitFor(async () => {
    try {
      return await evaluate(
        cdp,
        `window.location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`,
      );
    } catch {
      return false;
    }
  }, `Browser did not navigate to ${route}`);
  return readSettings(cdp, route, direction);
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

async function chooseAdjacentSelectOptionByKeyboard(cdp, testID, key) {
  const windowsVirtualKeyCode = key === "ArrowUp" ? 38 : 40;
  const point = await evaluate(
    cdp,
    `(() => {
      const target = document.querySelector('[data-testid=${JSON.stringify(testID)}]');
      if (!target) throw new Error('Missing production select: ${testID}');
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
  );
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    x: point.x,
    y: point.y,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    x: point.x,
    y: point.y,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code: key,
    windowsVirtualKeyCode,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code: key,
    windowsVirtualKeyCode,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
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
  let server;

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    const hookModules = new Set([
      "@/src/audio/use-player",
      "@/src/hooks/use-auth",
      "@/src/hooks/use-music-preferences",
      "@/src/hooks/use-online-status",
      "@/src/hooks/use-profile",
      "@/src/hooks/use-settings",
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
          : moduleName === "@/src/api/auth-scope"
            ? authScopeStub
            : moduleName === "@/src/lib/secure-storage"
              ? secureStorageStub
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
    const fixtureHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
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
      </script><script src="/fixture.js"></script></body></html>`;
    const bundle = fs.readFileSync(bundlePath);
    server = http.createServer((request, response) => {
      if (request.url === "/fixture.js") {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(bundle);
        return;
      }
      if (request.url === "/preferences" || request.url === "/account-settings") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(fixtureHtml);
        return;
      }
      response.writeHead(404);
      response.end("Not found");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const serverAddress = server.address();
    if (!serverAddress || typeof serverAddress === "string") {
      throw new Error("Settings HTTP harness did not publish a port");
    }
    const origin = `http://127.0.0.1:${serverAddress.port}`;

    browser = spawn(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDirectory}`,
        `${origin}/preferences`,
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
    await waitFor(async () => {
      try {
        return await evaluate(
          cdp,
          `window.location.pathname === '/preferences' && document.readyState === 'complete'`,
        );
      } catch {
        return false;
      }
    }, "Initial preferences route did not finish loading");
    await resize(cdp, 390, 844);
    await readSettings(cdp, "/preferences", "column");
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
      const state = await readSettings(cdp, "/preferences", "column");
      return state.preferenceGenres.includes("Ambient") ? state : null;
    }, "Preference save did not settle");
    const compactPreferencesScreenshot = await capture(
      cdp,
      "preferences",
      390,
      844,
    );

    await resize(cdp, 1440, 900);
    const desktopPreferences = await readSettings(cdp, "/preferences", "row");
    const desktopPreferencesScreenshot = await capture(
      cdp,
      "preferences",
      1440,
      900,
    );

    const desktopAccount = await navigate(
      cdp,
      `${origin}/account-settings`,
      "/account-settings",
      "row",
    );
    const desktopAccountScreenshot = await capture(cdp, "account", 1440, 900);

    await evaluate(
      cdp,
      `window.localStorage.setItem('himu.browser.fail-language-once', 'true')`,
    );
    await chooseAdjacentSelectOptionByKeyboard(
      cdp,
      "language-preference-select",
      "ArrowDown",
    );
    const failedLanguageAccount = await waitFor(async () => {
      const state = await readSettings(cdp, "/account-settings", "row");
      return state.languagePreference === "en" &&
        state.languageSaveErrorVisible &&
        state.counters.languageFailures === 1
        ? state
        : null;
    }, "Language failure state did not expose owner-backed recovery");
    await clickLabel(cdp, "Retry");
    const savedLanguageAccount = await waitFor(async () => {
      const state = await readSettings(cdp, "/account-settings", "row");
      const stored = state.storedLanguageState
        ? JSON.parse(state.storedLanguageState)
        : null;
      return state.languagePreference === "en" &&
        !state.languageDisabled &&
        !state.languageSaveErrorVisible &&
        state.remoteLanguagePreference === "en" &&
        stored?.preference === "en" &&
        stored?.pendingSync === false
        ? state
        : null;
    }, "Language retry did not persist through the actual locale owner");

    await chooseAdjacentSelectOptionByKeyboard(
      cdp,
      "language-preference-select",
      "ArrowDown",
    );
    const spanishLanguageAccount = await waitFor(async () => {
      const state = await readSettings(cdp, "/account-settings", "row");
      return state.languagePreference === "es" &&
        state.remoteLanguagePreference === "es" &&
        state.documentLanguage === "es"
        ? state
        : null;
    }, "Live Spanish selection did not update the HTML language");
    await chooseAdjacentSelectOptionByKeyboard(
      cdp,
      "language-preference-select",
      "ArrowUp",
    );
    const restoredEnglishLanguageAccount = await waitFor(async () => {
      const state = await readSettings(cdp, "/account-settings", "row");
      return state.languagePreference === "en" &&
        state.remoteLanguagePreference === "en" &&
        state.documentLanguage === "en"
        ? state
        : null;
    }, "Live English selection did not restore the HTML language");

    await resize(cdp, 390, 844);
    const compactAccount = await readSettings(cdp, "/account-settings", "column");
    const compactAccountScreenshot = await capture(cdp, "account", 390, 844);

    const remountedPreferences = await navigate(
      cdp,
      `${origin}/preferences`,
      "/preferences",
      "column",
    );
    if (!remountedPreferences.preferenceGenres.includes("Ambient")) {
      throw new Error("Music preference did not survive pathname navigation");
    }
    const remountedAccount = await navigate(
      cdp,
      `${origin}/account-settings`,
      "/account-settings",
      "column",
    );
    if (remountedAccount.languagePreference !== "en") {
      throw new Error("Language preference did not survive route remount");
    }

    const beforeSession = remountedAccount.counters;
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
    const afterCancel = await readSettings(cdp, "/account-settings", "column");
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
      const state = await readSettings(cdp, "/account-settings", "column");
      return state.counters.signOuts === 1 && state.counters.redirects === 1
        ? state
        : null;
    }, "Confirmed sign out did not flush and redirect");

    await resize(cdp, 720, 422);
    await readSettings(cdp, "/account-settings", "column");
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
          failedLanguageAccount,
          savedLanguageAccount,
          spanishLanguageAccount,
          restoredEnglishLanguageAccount,
          remountedPreferences,
          remountedAccount,
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
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
