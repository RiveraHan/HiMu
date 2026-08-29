const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");
const {
  createIdempotentCleanup,
  installSignalCleanup,
  stopChild,
} = require("../beta-onboarding-browser/signal-cleanup.cjs");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
const fixtureEntry = path.join(
  harnessDirectory,
  "CreateDjWorkflow-browser-fixture.tsx",
);
const hookStub = path.join(harnessDirectory, "create-dj-browser-hooks.ts");
const routerStub = path.join(harnessDirectory, "expo-router-browser-stub.ts");
const supabaseStub = path.join(harnessDirectory, "supabase-browser-stub.ts");

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
    editGenres: "Edit Genres",
    editMoods: "Edit Moods",
    genreGroup: "Chill & Ambient",
    genre: "Ambient",
    moodGroup: "Calm",
    mood: "Focus",
    searchGenres: "Search Genres",
    searchMoods: "Search Moods",
    continue: "Continue",
    custom: "Write my own",
    name: "DJ name",
    concept: "Identity concept",
    submit: "Bring my DJ to life",
    save: "Save changes",
    vibePlaceholder: "e.g. late-night rooftop textures",
  },
  es: {
    editGenres: "Edit Géneros",
    editMoods: "Edit Estados de ánimo",
    genreGroup: "Relajado y ambiental",
    genre: "Ambiental",
    moodGroup: "Calma",
    mood: "Concentración",
    searchGenres: "Search Géneros",
    searchMoods: "Search Estados de ánimo",
    continue: "Continuar",
    custom: "Escribir la mía",
    name: "Nombre del DJ",
    concept: "Concepto de identidad",
    submit: "Dar vida a mi DJ",
    save: "Guardar cambios",
    vibePlaceholder: "p. ej., texturas de azotea nocturna",
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

async function readWorkflow(cdp, predicate, context) {
  let lastState;
  try {
    return await waitFor(
      async () => {
        try {
          const state = await evaluate(
            cdp,
            `(() => {
              if (window.__HIMU_BROWSER_ERROR__) return { error: window.__HIMU_BROWSER_ERROR__ };
              if (!window.__HIMU_WORKFLOW_READY__ || !window.__HIMU_WORKFLOW_READ__) return null;
              return window.__HIMU_WORKFLOW_READ__();
            })()`,
          );
          lastState = state;
          if (state?.error) throw new Error(state.error);
          return state && predicate(state) ? state : null;
        } catch (error) {
          if (String(error).includes("Execution context was destroyed")) return null;
          if (String(error).includes("Cannot find context with specified id")) return null;
          throw error;
        }
      },
      context,
    );
  } catch (error) {
    throw new Error(`${error.message}; last state: ${JSON.stringify(lastState)}`);
  }
}

async function navigate(cdp, url, flow, width, height) {
  await resize(cdp, width, height);
  await cdp.send("Page.navigate", { url });
  await waitFor(
    async () => {
      try {
        return await evaluate(cdp, "document.readyState === 'complete'");
      } catch {
        return false;
      }
    },
    `Browser did not finish navigation to ${url}`,
  );
  return readWorkflow(
    cdp,
    (state) =>
      state.flow === flow &&
      state.viewportWidth === width &&
      state.viewportHeight === height,
    `${flow} fixture did not become ready at ${width}x${height}`,
  );
}

async function clickLabel(cdp, wanted) {
  await evaluate(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(wanted)};
      const target = Array.from(document.querySelectorAll('button, [role="button"], [role="checkbox"], [role="radio"]')).find(
        (element) => element.getAttribute('aria-label') === wanted || element.textContent?.trim() === wanted
      );
      if (!target) throw new Error('Missing production control: ' + wanted);
      target.focus();
      target.click();
    })()`,
  );
  await evaluate(
    cdp,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

async function setInput(cdp, labelOrPlaceholder, value) {
  await evaluate(
    cdp,
    `(() => {
      const wanted = ${JSON.stringify(labelOrPlaceholder)};
      const input = Array.from(document.querySelectorAll('input, textarea')).find(
        (element) => element.getAttribute('aria-label') === wanted || element.getAttribute('placeholder') === wanted
      );
      if (!input) throw new Error('Missing production input: ' + wanted);
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (!setter) throw new Error('Browser input value setter is unavailable');
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`,
  );
  await evaluate(
    cdp,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

async function dispatchKey(cdp, key, shift = false) {
  const code = key === "Escape" ? "Escape" : "Tab";
  const virtualKeyCode = key === "Escape" ? 27 : 9;
  const event = {
    key,
    code,
    modifiers: shift ? 8 : 0,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...event });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
  await evaluate(
    cdp,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

async function focusBoundary(cdp, boundary) {
  return evaluate(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) throw new Error('Missing production dialog');
      const focusables = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const target = ${JSON.stringify(boundary)} === 'first' ? focusables[0] : focusables.at(-1);
      if (!target) throw new Error('Missing dialog focus boundary');
      target.focus();
      return target.getAttribute('aria-label') ?? target.textContent?.trim() ?? target.tagName;
    })()`,
  );
}

async function activeLabel(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const active = document.activeElement;
      return active?.getAttribute?.('aria-label') ?? active?.textContent?.trim() ?? active?.tagName ?? null;
    })()`,
  );
}

async function readProgressiveSelection(cdp, item) {
  return evaluate(
    cdp,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const checkbox = Array.from(dialog?.querySelectorAll('[role="checkbox"]') ?? []).find(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(item)}
      );
      if (!dialog || !checkbox) throw new Error('Missing progressive catalog item: ' + ${JSON.stringify(item)});
      const removableSelection = Array.from(dialog.querySelectorAll('[role="button"][aria-label]')).some(
        (element) => {
          const label = element.getAttribute('aria-label') ?? '';
          return (
            (label.startsWith('Remove ') || label.startsWith('Eliminar ')) &&
            label.endsWith(${JSON.stringify(item)})
          );
        }
      );
      const limitAnnouncement = dialog.textContent?.includes('Choose at least 1')
        ? 'Choose at least 1'
        : '';
      return {
        checked: removableSelection,
        limitAnnouncement,
      };
    })()`,
  );
}

async function exerciseDialog(cdp, opener, searchLabel, group, item, progressiveMode) {
  await clickLabel(cdp, opener);
  const opened = await readWorkflow(
    cdp,
    (state) => state.dialogCount === 1 && state.dialogFocus === searchLabel,
    `${opener} did not autofocus its search field`,
  );
  const first = await focusBoundary(cdp, "first");
  await dispatchKey(cdp, "Tab", true);
  const reverseWrap = await activeLabel(cdp);
  const last = await focusBoundary(cdp, "last");
  await dispatchKey(cdp, "Tab");
  const forwardWrap = await activeLabel(cdp);
  await dispatchKey(cdp, "Escape");
  const escaped = await readWorkflow(
    cdp,
    (state) => state.dialogCount === 0 && state.dialogFocus === opener,
    `${opener} did not restore focus after Escape`,
  );

  let progressive = null;
  if (progressiveMode) {
    await clickLabel(cdp, opener);
    await readWorkflow(cdp, (state) => state.dialogCount === 1, `${opener} did not reopen`);
    await clickLabel(cdp, group);
    await clickLabel(cdp, group);
    const before = await readProgressiveSelection(cdp, item);
    await clickLabel(cdp, item);
    const after = await readProgressiveSelection(cdp, item);
    if (
      (progressiveMode === "select" && !after.checked) ||
      (progressiveMode === "retain" && (!after.checked || !after.limitAnnouncement))
    ) {
      throw new Error(`${opener} controlled selection mismatch: ${JSON.stringify({ before, after })}`);
    }
    progressive = {
      mode: progressiveMode,
      checkedBefore: before.checked,
      checkedAfter: after.checked,
      limitAnnouncement: after.limitAnnouncement,
    };
    await clickLabel(cdp, "Done");
    await readWorkflow(cdp, (state) => state.dialogCount === 0, `${opener} did not close`);
  }

  return { opened, escaped, first, last, reverseWrap, forwardWrap, progressive };
}

async function actionReachability(cdp, actionLabel, scrollTestId, pageScaleFactor = 1) {
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor });
  const state = await evaluate(
    cdp,
    `(async () => {
      const action = Array.from(document.querySelectorAll('[role="button"]')).find(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(actionLabel)}
      );
      const scroll = document.querySelector('[data-testid=${JSON.stringify(scrollTestId)}]') ?? document.scrollingElement;
      if (!action || !scroll) throw new Error('Missing production zoom controls');
      scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'instant' });
      action.focus();
      action.scrollIntoView({ block: 'end' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bounds = action.getBoundingClientRect();
      const visualTop = window.visualViewport?.offsetTop ?? 0;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageScaleFactor: ${JSON.stringify(pageScaleFactor)},
        visualHeight,
        visualTop,
        actionRect: { top: bounds.top, bottom: bounds.bottom },
        actionVisible:
          bounds.bottom <= visualTop + visualHeight + 1 &&
          bounds.top >= visualTop - 1,
        actionFocused: document.activeElement === action,
        actionTabIndex: action.tabIndex,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    })()`,
  );
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  return state;
}

async function traverseHistory(cdp, direction, expectedStep, context) {
  await evaluate(cdp, `window.history.${direction}()`);
  return readWorkflow(
    cdp,
    (state) => state.activeStep === expectedStep && state.routeStep === ["sound", "identity", "review"][expectedStep - 1],
    `${context} did not reach step ${expectedStep}`,
  );
}

async function runCreateCell(cdp, origin, locale, width, height, index) {
  const labels = copy[locale];
  const url = `${origin}/create-dj?flow=create&locale=${locale}&cell=${index}`;
  const initial = await navigate(cdp, url, "create", width, height);
  const historyStart = initial.pushCalls;
  const genresDialog = await exerciseDialog(
    cdp,
    labels.editGenres,
    labels.searchGenres,
    labels.genreGroup,
    labels.genre,
    "select",
  );
  const moodsDialog = await exerciseDialog(
    cdp,
    labels.editMoods,
    labels.searchMoods,
    labels.moodGroup,
    labels.mood,
    "select",
  );
  const soundReady = await readWorkflow(
    cdp,
    (state) => state.actionCount === 1 && state.actionDisabled === false,
    `${locale} ${width}x${height} Sound did not become valid`,
  );
  await clickLabel(cdp, labels.continue);
  const identity = await readWorkflow(
    cdp,
    (state) =>
      state.activeStep === 2 &&
      state.candidateCount === 3 &&
      state.identityRequestCount === 1,
    `${locale} ${width}x${height} Identity did not render three candidates once`,
  );
  await clickLabel(cdp, labels.custom);
  await setInput(cdp, labels.name, "Night Cartographer");
  await setInput(
    cdp,
    labels.concept,
    "Maps patient rhythms into luminous shared journeys.",
  );
  await clickLabel(cdp, labels.continue);
  const review = await readWorkflow(
    cdp,
    (state) => state.activeStep === 3 && state.actionCount === 1 && !state.actionDisabled,
    `${locale} ${width}x${height} Review did not become ready`,
  );

  const originalSize = [width, height];
  const resizeSnapshots = [];
  for (const [nextWidth, nextHeight] of [[390, 844], [1440, 900], [390, 844]]) {
    await resize(cdp, nextWidth, nextHeight);
    resizeSnapshots.push(await readWorkflow(
      cdp,
      (state) => state.viewportWidth === nextWidth && state.viewportHeight === nextHeight,
      `Create resize did not settle at ${nextWidth}x${nextHeight}`,
    ));
  }
  await resize(cdp, ...originalSize);
  const restored = await readWorkflow(
    cdp,
    (state) => state.viewportWidth === width && state.viewportHeight === height,
    `Create viewport did not restore to ${width}x${height}`,
  );
  const historyEnd = restored.pushCalls;
  const afterBack = await traverseHistory(cdp, "back", 2, `${locale} ${width}x${height} browser Back`);
  const afterSecondBack = await traverseHistory(cdp, "back", 1, `${locale} ${width}x${height} second browser Back`);
  const afterForward = await traverseHistory(cdp, "forward", 2, `${locale} ${width}x${height} browser Forward`);
  const afterSecondForward = await traverseHistory(cdp, "forward", 3, `${locale} ${width}x${height} second browser Forward`);
  const reachability = await actionReachability(
    cdp,
    labels.submit,
    "create-dj-wizard-scroll-view",
  );
  const zoom = width === 512 && height === 384
    ? await actionReachability(cdp, labels.submit, "create-dj-wizard-scroll-view", 2)
    : null;
  await clickLabel(cdp, labels.submit);
  await clickLabel(cdp, labels.submit).catch(() => undefined);
  const submitted = await readWorkflow(
    cdp,
    (state) => state.createCalls === 1,
    `${locale} ${width}x${height} final press did not submit exactly once`,
  );

  return {
    initial,
    genresDialog,
    moodsDialog,
    soundReady,
    identity,
    review,
    resizeSnapshots,
    restored,
    submitted,
    history: {
      entriesAdded: historyEnd - historyStart,
      afterBack: afterBack.activeStep,
      afterSecondBack: afterSecondBack.activeStep,
      afterForward: afterForward.activeStep,
      afterSecondForward: afterSecondForward.activeStep,
      createCalls: [
        afterBack.createCalls,
        afterSecondBack.createCalls,
        afterForward.createCalls,
        afterSecondForward.createCalls,
      ],
    },
    reachability,
    zoom,
  };
}

async function runTrainCell(cdp, origin, locale, width, height, index) {
  const labels = copy[locale];
  const url = `${origin}/train-dj/dj-browser?flow=train&locale=${locale}&cell=${index}`;
  const initial = await navigate(cdp, url, "train", width, height);
  const genresDialog = await exerciseDialog(
    cdp,
    labels.editGenres,
    labels.searchGenres,
    labels.genreGroup,
    labels.genre,
    "retain",
  );
  const moodsDialog = await exerciseDialog(
    cdp,
    labels.editMoods,
    labels.searchMoods,
    labels.moodGroup,
    labels.mood,
    "retain",
  );
  await setInput(cdp, labels.vibePlaceholder, "Patient aurora drive");
  const edited = await readWorkflow(
    cdp,
    (state) => state.reviewText.includes("Patient aurora drive") && state.updateCalls === 0,
    `${locale} ${width}x${height} Train non-intensity edit did not reach review`,
  );
  const reachability = await actionReachability(
    cdp,
    labels.save,
    "responsive-form-scroll-view",
  );
  const zoom = width === 512 && height === 384
    ? await actionReachability(cdp, labels.save, "responsive-form-scroll-view", 2)
    : null;
  await clickLabel(cdp, labels.save);
  const saved = await readWorkflow(
    cdp,
    (state) => state.updateCalls === 1,
    `${locale} ${width}x${height} Train save was not captured`,
  );
  return { initial, genresDialog, moodsDialog, edited, saved, reachability, zoom };
}

async function runReloadFallback(cdp, origin, locale) {
  const url = `${origin}/create-dj?flow=create&locale=${locale}&step=review&direct=1`;
  return navigate(cdp, url, "create", 390, 844).then(() =>
    readWorkflow(
      cdp,
      (state) => state.activeStep === 1 && state.routeStep === "sound",
      `${locale} direct Review URL did not fall back to Sound`,
    ));
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
  if (!chrome) throw new Error("Create DJ browser integration requires Chrome");
  process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://browser-fixture.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||= "browser-fixture-anon-key";
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "himu-create-dj-workflow-"));
  let browser;
  let cdp;
  let server;
  let chromeStderr = "";
  const cleanup = createIdempotentCleanup(async () => {
    cdp?.close();
    await stopChild(browser);
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await removeTemporaryDirectory(outputDirectory);
  });
  const signalCleanup = installSignalCleanup(cleanup);

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const profileDirectory = path.join(outputDirectory, "chrome-profile");
    const metroConfig = getDefaultConfig(projectRoot);
    const hookModules = new Set([
      "@/src/hooks/use-create-dj",
      "@/src/hooks/use-creative-draft",
      "@/src/hooks/use-auth",
      "@/src/hooks/use-dj",
      "@/src/hooks/use-online-status",
      "@/src/hooks/use-phase-rotation",
      "@/src/hooks/use-tab-bar-padding",
      "@/src/hooks/use-update-dj",
    ]);

    metroConfig.resolver.blockList = metroConfig.resolver.blockList.filter(
      (pattern) => !pattern.test(fixtureEntry),
    );
    metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
      const webContext = platform === "web"
        ? { ...context, preferNativePlatform: false, mainFields: ["browser", "module", "main"] }
        : context;
      const isApiRelativeSupabase = moduleName === "./supabase" &&
        context.originModulePath?.includes(`${path.sep}src${path.sep}api${path.sep}`);
      const target = hookModules.has(moduleName)
        ? hookStub
        : moduleName === "expo-router"
          ? routerStub
          : moduleName === "@/src/api/supabase" || isApiRelativeSupabase
            ? supabaseStub
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
        globalThis.process = { env: {
          EXPO_PUBLIC_SUPABASE_URL: "https://browser-fixture.supabase.co",
          EXPO_PUBLIC_SUPABASE_KEY: "browser-fixture-anon-key"
        } };
        window.addEventListener("error", (event) => {
          window.__HIMU_BROWSER_ERROR__ = event.error && event.error.stack ? event.error.stack : event.message;
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
      throw new Error("Create DJ HTTP harness did not publish a port");
    }
    const origin = `http://127.0.0.1:${address.port}`;

    browser = spawn(chrome, [
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
    ], { stdio: ["ignore", "ignore", "pipe"] });
    browser.stderr.on("data", (chunk) => {
      chromeStderr = `${chromeStderr}${chunk}`.slice(-4000);
    });

    const devToolsFile = path.join(profileDirectory, "DevToolsActivePort");
    let devTools;
    try {
      devTools = await waitFor(
        () => fs.existsSync(devToolsFile) && fs.readFileSync(devToolsFile, "utf8"),
        "Chrome did not publish its DevTools port",
      );
    } catch (error) {
      throw new Error(`${error.message}; Chrome stderr: ${chromeStderr || "<empty>"}`);
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

    const cells = [];
    let index = 0;
    for (const locale of ["en", "es"]) {
      for (const [width, height] of viewports) {
        cells.push({
          locale,
          width,
          height,
          create: await runCreateCell(cdp, origin, locale, width, height, index),
          train: await runTrainCell(cdp, origin, locale, width, height, index),
        });
        index += 1;
      }
    }
    const reloadFallback = {
      en: await runReloadFallback(cdp, origin, "en"),
      es: await runReloadFallback(cdp, origin, "es"),
    };

    process.stdout.write(JSON.stringify({
      fixture: "real-create-and-train-dj-production-screens",
      cells,
      reloadFallback,
    }));
  } finally {
    signalCleanup.dispose();
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
