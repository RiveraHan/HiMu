const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
const fixtureEntry = path.join(harnessDirectory, "SettingsWorkflow-browser-fixture.tsx");
const hookStub = path.join(harnessDirectory, "settings-browser-hooks.ts");
const authStub = path.join(harnessDirectory, "settings-auth-browser-stub.ts");
const routerStub = path.join(harnessDirectory, "settings-expo-router-browser-stub.ts");
const authScopeStub = path.join(harnessDirectory, "settings-auth-scope-browser-stub.ts");
const secureStorageStub = path.join(harnessDirectory, "settings-secure-storage-browser-stub.ts");
const experienceStub = path.join(harnessDirectory, "settings-experience-browser-stub.ts");

const locales = ["en", "es"];
const preferenceCells = [
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
const playerCells = [
  [390, 844],
  [768, 1024],
  [1440, 900],
];

const copy = {
  en: {
    balanced: "Balanced",
    intense: "Intense",
    genreEdit: "Edit genres",
    genreSearch: "Search Favorite genres",
    genreGroup: "Chill & Ambient",
    genreItem: "Ambient",
    moodEdit: "Edit moods",
    moodSearch: "Search Moods to avoid",
    done: "Done",
    saving: "Saving",
    saved: "Saved",
    play: "Play",
    choose: "Choose my preferences",
    dismiss: "Not now",
  },
  es: {
    balanced: "Equilibrada",
    intense: "Intensa",
    genreEdit: "Editar géneros",
    genreSearch: "Buscar Géneros favoritos",
    genreGroup: "Relajado y ambiental",
    genreItem: "Ambiental",
    moodEdit: "Editar estados de ánimo",
    moodSearch: "Buscar Estados de ánimo que evitar",
    done: "Listo",
    saving: "Guardando",
    saved: "Guardado",
    play: "Reproducir",
    choose: "Elegir mis preferencias",
    dismiss: "Ahora no",
  },
};

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

async function resize(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(cdp, `new Promise((resolve) => {
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
}

async function readSnapshot(cdp, route, locale) {
  let lastState;
  return waitFor(async () => {
    const state = await evaluate(cdp, `(() => {
      if (window.__HIMU_BROWSER_ERROR__) return { error: window.__HIMU_BROWSER_ERROR__ };
      if (!window.__HIMU_SETTINGS_READY__ || !window.__HIMU_SETTINGS_READ__) return null;
      return window.__HIMU_SETTINGS_READ__();
    })()`);
    lastState = state;
    if (state?.error) throw new Error(state.error);
    return state?.route === route && state?.documentLanguage === locale ? state : null;
  }, `Production ${route} did not settle in ${locale}; last state ${JSON.stringify(lastState)}`);
}

async function navigate(cdp, url, route, locale) {
  await cdp.send("Page.navigate", { url });
  await waitFor(async () => {
    try {
      return await evaluate(cdp, `document.readyState === 'complete' && window.location.pathname === ${JSON.stringify(route)}`);
    } catch {
      return false;
    }
  }, `Browser did not navigate to ${route}`);
  return readSnapshot(cdp, route, locale);
}

async function clickLabel(cdp, label) {
  await evaluate(cdp, `(() => {
    const target = Array.from(document.querySelectorAll('[aria-label]')).find(
      (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)}
    );
    if (!target) throw new Error('Missing production control: ${label}');
    target.focus();
    target.click();
  })()`);
}

async function hasLabel(cdp, label) {
  return evaluate(cdp, `Array.from(document.querySelectorAll('[aria-label]')).some(
    (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)}
  )`);
}

async function clickText(cdp, text) {
  await evaluate(cdp, `(() => {
    const target = Array.from(document.querySelectorAll('button, [role="button"]')).find(
      (element) => element.textContent.trim() === ${JSON.stringify(text)}
    );
    if (!target) throw new Error('Missing production text control: ${text}');
    target.focus();
    target.click();
  })()`);
}

async function dispatchKey(cdp, key, modifiers = 0) {
  const keyCodes = { Tab: 9, Escape: 27, ArrowRight: 39 };
  const code = key === "Escape" ? "Escape" : key;
  const windowsVirtualKeyCode = keyCodes[key];
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    modifiers,
    windowsVirtualKeyCode,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    modifiers,
    windowsVirtualKeyCode,
  });
}

async function focusDialogEndpoint(cdp, endpoint) {
  await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[data-testid="catalog-picker-dialog"]');
    const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    const target = ${endpoint === "first" ? "controls[0]" : "controls.at(-1)"};
    if (!target) throw new Error('Dialog has no ${endpoint} focus endpoint');
    target.focus();
  })()`);
}

async function runPreferenceCell(cdp, origin, locale, width, height) {
  const labels = copy[locale];
  await resize(cdp, width, height);
  const base = await navigate(
    cdp,
    `${origin}/preferences?locale=${locale}&reset=1`,
    "/preferences",
    locale,
  );

  await clickLabel(cdp, labels.balanced);
  await dispatchKey(cdp, "ArrowRight");
  let saving;
  const arrowed = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    if (state.saveStatus === labels.saving) saving = state;
    return state.selectedAtmosphereLabel === labels.intense &&
      state.selectedAtmosphereTabIndex === 0 &&
      state.activeLabel === labels.intense
      ? state
      : null;
  }, `${locale} ${width}x${height} ArrowRight did not move the atmosphere radio focus and selection`);
  saving ??= await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.saveStatus === labels.saving ? state : null;
  }, `${locale} ${width}x${height} never exposed Saving`);

  await clickLabel(cdp, labels.genreEdit);
  const genreDialog = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.dialog?.activeLabel === labels.genreSearch ? state : null;
  }, `${locale} ${width}x${height} genre search did not autofocus`);

  await focusDialogEndpoint(cdp, "first");
  await dispatchKey(cdp, "Tab", 8);
  const backwardTrap = await readSnapshot(cdp, "/preferences", locale);
  await focusDialogEndpoint(cdp, "last");
  await dispatchKey(cdp, "Tab");
  const forwardTrap = await readSnapshot(cdp, "/preferences", locale);

  if (!(await hasLabel(cdp, labels.genreItem))) {
    await clickLabel(cdp, labels.genreGroup);
  }
  await clickLabel(cdp, labels.genreItem);
  await clickText(cdp, labels.done);
  const afterDone = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.dialog === null && state.activeLabel === labels.genreEdit ? state : null;
  }, `${locale} ${width}x${height} Done did not restore genre opener focus`);

  await clickLabel(cdp, labels.moodEdit);
  const moodDialog = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.dialog?.activeLabel === labels.moodSearch ? state : null;
  }, `${locale} ${width}x${height} mood search did not autofocus`);
  await dispatchKey(cdp, "Escape");
  const afterEscape = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.dialog === null && state.activeLabel === labels.moodEdit ? state : null;
  }, `${locale} ${width}x${height} Escape did not restore mood opener focus`);

  const saved = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/preferences", locale);
    return state.saveStatus === labels.saved &&
      state.preferences.atmosphere === "intense" &&
      !state.preferences.genres.includes("Ambient")
      ? state
      : null;
  }, `${locale} ${width}x${height} preference save did not settle`);
  const remounted = await navigate(
    cdp,
    `${origin}/preferences?locale=${locale}`,
    "/preferences",
    locale,
  );

  return {
    locale,
    width,
    height,
    base,
    arrowed,
    saving,
    genreDialog,
    backwardTrap,
    forwardTrap,
    afterDone,
    moodDialog,
    afterEscape,
    saved,
    remounted,
  };
}

async function runPlayerCell(cdp, origin, locale, width, height) {
  const labels = copy[locale];
  await resize(cdp, width, height);
  const shown = await navigate(
    cdp,
    `${origin}/player?locale=${locale}&reset=1`,
    "/player",
    locale,
  );
  await clickLabel(cdp, labels.play);
  const afterPlay = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/player", locale);
    return state.counters.playerToggles === 1 ? state : null;
  }, `${locale} ${width}x${height} Play was not reachable with the nudge shown`);
  await clickLabel(cdp, labels.choose);
  const accepted = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/player", locale);
    return state.routeCalls.some(
      (call) => call.method === "push" && call.href === "/preferences",
    ) ? state : null;
  }, `${locale} ${width}x${height} nudge acceptance did not route to Preferences`);
  await clickLabel(cdp, labels.dismiss);
  const dismissed = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/player", locale);
    return !state.nudgeVisible ? state : null;
  }, `${locale} ${width}x${height} nudge dismissal did not settle`);
  const dismissedRemount = await navigate(
    cdp,
    `${origin}/player?locale=${locale}`,
    "/player",
    locale,
  );
  await evaluate(cdp, `window.__HIMU_SETTINGS_SET_NUDGE__('completed')`);
  const completed = await waitFor(async () => {
    const state = await readSnapshot(cdp, "/player", locale);
    return !state.nudgeVisible ? state : null;
  }, `${locale} ${width}x${height} completed nudge did not remain absent`);
  const completedRemount = await navigate(
    cdp,
    `${origin}/player?locale=${locale}`,
    "/player",
    locale,
  );
  return {
    locale,
    width,
    height,
    shown,
    afterPlay,
    accepted,
    dismissed,
    dismissedRemount,
    completed,
    completedRemount,
  };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Settings browser integration requires Chrome");
  process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://browser-fixture.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||= "browser-fixture-anon-key";
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "himu-settings-release-"));
  let browser;
  let cdp;
  let server;
  let chromeStderr = "";

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    const hookModules = new Set([
      "@/src/audio/use-player",
      "@/src/hooks/use-auth",
      "@/src/hooks/use-favorites",
      "@/src/hooks/use-home",
      "@/src/hooks/use-music-preferences",
      "@/src/hooks/use-online-status",
      "@/src/hooks/use-profile",
      "@/src/hooks/use-settings",
      "@/src/hooks/use-tab-bar-padding",
      "@/src/hooks/use-toast",
      "@/src/hooks/use-track-private-details",
      "@/src/experience/experience-state",
      "@/src/experience/product-analytics",
    ]);
    metroConfig.resolver.blockList = metroConfig.resolver.blockList.filter(
      (pattern) => !pattern.test(fixtureEntry),
    );
    metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
      const webContext = platform === "web"
        ? { ...context, preferNativePlatform: false, mainFields: ["browser", "module", "main"] }
        : context;
      const target = hookModules.has(moduleName)
        ? hookStub
        : moduleName === "@/src/experience"
          ? experienceStub
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
      html, body, #root { display:flex; margin:0; width:100%; height:100%; overflow:hidden; }
    </style></head><body><div id="root"></div><script>
      globalThis.process = { env: {
        EXPO_PUBLIC_SUPABASE_URL: "https://browser-fixture.supabase.co",
        EXPO_PUBLIC_SUPABASE_KEY: "browser-fixture-anon-key"
      } };
      window.addEventListener("error", (event) => {
        window.__HIMU_BROWSER_ERROR__ = event.error?.stack ?? event.message;
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
      if (request.url?.startsWith("/preferences") || request.url?.startsWith("/player")) {
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
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Settings HTTP harness did not publish a port");
    }
    const origin = `http://127.0.0.1:${address.port}`;

    browser = spawn(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      `${origin}/preferences?locale=en&reset=1`,
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
    await waitFor(async () => {
      try {
        return await evaluate(
          cdp,
          "document.readyState === 'complete' && window.__HIMU_SETTINGS_READY__ === true",
        );
      } catch {
        return false;
      }
    }, "Initial settings fixture did not finish loading");

    const preferences = [];
    for (const locale of locales) {
      for (const [width, height] of preferenceCells) {
        preferences.push(await runPreferenceCell(cdp, origin, locale, width, height));
      }
    }
    const players = [];
    for (const locale of locales) {
      for (const [width, height] of playerCells) {
        players.push(await runPlayerCell(cdp, origin, locale, width, height));
      }
    }
    process.stdout.write(JSON.stringify({ preferences, players }));
  } finally {
    cdp?.close();
    if (browser && browser.exitCode === null) {
      browser.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (browser.exitCode === null) browser.kill("SIGKILL");
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(outputDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
