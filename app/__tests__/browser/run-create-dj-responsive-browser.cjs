const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../../..");
const fixtureEntry = path.join(
  harnessDirectory,
  "CreateDjWorkflow-browser-fixture.tsx",
);
const hookStub = path.join(harnessDirectory, "create-dj-browser-hooks.ts");
const routerStub = path.join(harnessDirectory, "expo-router-browser-stub.ts");
const supabaseStub = path.join(harnessDirectory, "supabase-browser-stub.ts");

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
  while (true) {
    const value = await check();
    if (value) return value;
    if (Date.now() - startedAt > timeout) throw new Error(message);
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
    throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  }
  return result.result.value;
}

async function readWorkflow(cdp, expectedDirection) {
  let lastState;
  try {
    return await waitFor(
      async () => {
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
        return state?.contentDirection === expectedDirection ? state : null;
      },
      `Production workflow did not reach ${expectedDirection} layout`,
    );
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; last state: ${JSON.stringify(lastState)}`,
    );
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Create DJ browser integration requires Chrome");
  process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://browser-fixture.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||= "browser-fixture-anon-key";
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "himu-create-dj-workflow-"),
  );
  let browser;
  let cdp;

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const htmlPath = path.join(outputDirectory, "fixture.html");
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
        ? {
            ...context,
            preferNativePlatform: false,
            mainFields: ["browser", "module", "main"],
          }
        : context;
      const isApiRelativeSupabase =
        moduleName === "./supabase" &&
        context.originModulePath?.includes(
          `${path.sep}src${path.sep}api${path.sep}`,
        );
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
    fs.writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><style>
        html, body, #root { display: flex; margin: 0; width: 100%; height: 100%; overflow: hidden; }
      </style></head><body><div id="root"></div><script>
        globalThis.process = {
          env: {
            EXPO_PUBLIC_SUPABASE_URL: "https://browser-fixture.supabase.co",
            EXPO_PUBLIC_SUPABASE_KEY: "browser-fixture-anon-key"
          }
        };
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

    browser = spawn(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      `file://${htmlPath}`,
    ], { stdio: "ignore" });

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
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.reload", { ignoreCache: true });
    const compactBefore = await readWorkflow(cdp, "column");
    const initialFinalActionDisabled = await evaluate(
      cdp,
      "window.__HIMU_INITIAL_FINAL_DISABLED__",
    );

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const desktop = await readWorkflow(cdp, "row");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const compactAfter = await readWorkflow(cdp, "column");

    process.stdout.write(JSON.stringify({
      initialFinalActionDisabled,
      snapshots: [compactBefore, desktop, compactAfter],
    }));
  } finally {
    cdp?.close();
    if (browser && browser.exitCode === null) {
      browser.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => browser.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (browser.exitCode === null) {
        browser.kill("SIGKILL");
        await new Promise((resolve) => browser.once("exit", resolve));
      }
    }
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
