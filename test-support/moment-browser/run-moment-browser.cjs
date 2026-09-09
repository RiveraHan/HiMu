const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");
const { installSignalCleanup, stopChild } = require("../beta-onboarding-browser/signal-cleanup.cjs");

const root = path.resolve(__dirname, "../..");
const fixture = path.join(__dirname, "Moment-browser-fixture.tsx");
const routerStub = path.join(__dirname, "expo-router-browser-stub.ts");
const publicStub = path.join(__dirname, "public-track-browser-stub.ts");
const analyticsStub = path.join(__dirname, "product-analytics-browser-stub.ts");
const cells = [["320x640", 320, 640, 100], ["390x844", 390, 844, 100], ["768x1024", 768, 1024, 100], ["1024x768", 1024, 768, 100], ["1440x900", 1440, 900, 100], ["720x422", 720, 422, 100], ["200% zoom", 720, 900, 200]];
const chrome = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((candidate) => candidate && fs.existsSync(candidate));
const originalShareOrigin = process.env.EXPO_PUBLIC_SHARE_ORIGIN;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, message) {
  for (let i = 0; i < 300; i += 1) {
    const value = await fn();
    if (value) return value;
    await delay(50);
  }
  throw new Error(message);
}

async function cdpConnect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(String(event.data));
    if (!data.id) return;
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result);
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const next = ++id;
        pending.set(next, { resolve, reject });
        socket.send(JSON.stringify({ id: next, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function resize(cdp, width, height, zoom) {
  const scale = zoom / 100;
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: Math.round(width / scale), height: Math.round(height / scale), deviceScaleFactor: scale, mobile: false });
}

async function navigate(cdp, origin, route) {
  await cdp.send("Page.navigate", { url: `${origin}${route}` });
  try {
    await waitFor(async () => await evaluate(cdp, "document.readyState === 'complete' && window.__HIMU_MOMENT_READY__ === true"), `Moment fixture did not settle at ${route}`);
  } catch (error) {
    const state = await evaluate(cdp, "({ready:document.readyState,error:window.__HIMU_BROWSER_ERROR__,text:document.body.textContent?.slice(0,500)})");
    throw new Error(`${error.message}; ${JSON.stringify(state)}`);
  }
}

async function read(cdp) {
  return evaluate(cdp, "window.__HIMU_BROWSER_ERROR__ ? Promise.reject(new Error(window.__HIMU_BROWSER_ERROR__)) : window.__HIMU_MOMENT_READ__()");
}

async function click(cdp, id) {
  await evaluate(cdp, `(() => { const el=document.querySelector('[data-testid="${id}"]'); if(!el) throw new Error('Missing ${id}'); el.focus(); el.click(); })()`);
  await delay(25);
}

async function tab(cdp, shift = false) {
  const modifiers = shift ? 8 : 0;
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", modifiers, windowsVirtualKeyCode: 9 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", modifiers, windowsVirtualKeyCode: 9 });
  await delay(20);
}

async function installShare(cdp, mode) {
  await evaluate(cdp, `(() => { window.__momentShareCalls=0; window.__momentCopyCalls=0; Object.defineProperty(navigator,'share',{configurable:true,value:${mode === "share" ? "async () => { window.__momentShareCalls += 1; }" : "undefined"}}); Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:${mode === "denied" ? "async () => { window.__momentCopyCalls += 1; throw new Error('denied'); }" : "async () => { window.__momentCopyCalls += 1; }"}}}); })()`);
}

async function confirmPublic(cdp) {
  try {
    await waitFor(async () => await evaluate(cdp, "Boolean(document.querySelector('[role=dialog]'))"), "Moment publish confirmation did not open");
  } catch (error) {
    throw new Error(`${error.message}; ${JSON.stringify(await read(cdp))}`);
  }
  await evaluate(cdp, "(() => { const el=Array.from(document.querySelectorAll('[role=dialog] *')).find((item)=>item.getAttribute('aria-label')==='Make public'||item.textContent?.trim()==='Make public'); if (!el) throw new Error('missing publish confirm'); el.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; })()");
}

async function scenario(cdp, origin) {
  await navigate(cdp, origin, "/moment");
  await click(cdp, "moment-publish");
  let state = await read(cdp);
  const privateConfirmation = { role: state.dialog?.role, opened: Boolean(state.dialog), title: state.dialog?.title };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await delay(30);
  state = await read(cdp);
  privateConfirmation.escapeCancelled = state.dialog === null;
  privateConfirmation.focusReturned = state.activeTestId === "moment-publish";

  await navigate(cdp, origin, "/moment");
  await evaluate(cdp, "document.querySelector('[data-testid=moment-publish]').focus()");
  await tab(cdp);
  privateConfirmation.tabForward = (await read(cdp)).activeLabel;
  await tab(cdp, true);
  privateConfirmation.shiftTabReturn = (await read(cdp)).activeTestId;

  await navigate(cdp, origin, "/moment");
  await installShare(cdp, "share");
  await click(cdp, "moment-publish");
  await confirmPublic(cdp);
  await waitFor(async () => await evaluate(cdp, "Boolean(document.querySelector('[data-testid=moment-share]'))"), "Moment did not publish");
  const publicShare = { shareCalls: await evaluate(cdp, "window.__momentShareCalls"), visible: Boolean((await read(cdp)).momentVisible) };

  await navigate(cdp, origin, "/moment");
  await installShare(cdp, "copy");
  await click(cdp, "moment-publish");
  await confirmPublic(cdp);
  await waitFor(async () => await evaluate(cdp, "Boolean(document.querySelector('[data-testid=moment-share]'))"), "Moment did not publish for clipboard");
  const clipboardFallback = { copyCalls: await evaluate(cdp, "window.__momentCopyCalls") };

  await navigate(cdp, origin, "/moment");
  await installShare(cdp, "denied");
  await click(cdp, "moment-publish");
  await confirmPublic(cdp);
  await waitFor(async () => await evaluate(cdp, "Boolean(document.querySelector('[data-testid=moment-share]'))"), "Moment did not publish for denied clipboard");
  await waitFor(async () => await evaluate(cdp, "document.body.textContent.includes('copy the link below')"), "Clipboard denial did not show a selectable fallback");
  const clipboardDenied = { copyCalls: await evaluate(cdp, "window.__momentCopyCalls"), recovery: await evaluate(cdp, "document.body.textContent.includes('copy the link below')") };

  await navigate(cdp, origin, "/moment-invalid-origin");
  const invalidOrigin = {
    publishDisabled: await evaluate(cdp, "document.querySelector('[data-testid=moment-publish]').getAttribute('aria-disabled') === 'true'"),
    sharePresent: await evaluate(cdp, "Boolean(document.querySelector('[data-testid=moment-share]'))"),
  };

  const unavailable = [];
  for (const id of ["private", "missing"]) {
    await navigate(cdp, origin, `/track/${id}`);
    unavailable.push(await read(cdp));
  }
  return {
    privateConfirmation,
    publicShare,
    clipboardFallback,
    clipboardDenied,
    invalidOrigin,
    publicUnavailable: { privateBody: unavailable[0].body, missingBody: unavailable[1].body, same: unavailable[0].body === unavailable[1].body },
  };
}

function configureResolver(config) {
  config.resolver.resolveRequest = (context, name, platform) => {
    if (name === "expo-router") return { filePath: routerStub, type: "sourceFile" };
    if (name === "@/src/hooks/use-public-track") return { filePath: publicStub, type: "sourceFile" };
    if (name === "@/src/experience/product-analytics") return { filePath: analyticsStub, type: "sourceFile" };
    return context.resolveRequest(
      { ...context, preferNativePlatform: platform !== "web", mainFields: ["browser", "module", "main"] },
      name.startsWith("@/") ? path.join(root, name.slice(2)) : name,
      platform,
    );
  };
}

async function buildFixture(name, output, shareOrigin) {
  process.env.EXPO_PUBLIC_SHARE_ORIGIN = shareOrigin;
  const config = getDefaultConfig(root);
  config.resetCache = true;
  config.cacheVersion = `moment-${name}-${Date.now()}`;
  configureResolver(config);
  await runBuild(config, { entry: fixture, platform: "web", dev: false, minify: false, out: output });
}

async function main() {
  if (!chrome) throw new Error("Moment browser integration requires Chrome or Chromium");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "himu-moment-browser-"));
  let browser;
  let cdp;
  let server;
  let signals;
  const cleanup = async () => {
    cdp?.close();
    if (browser) await stopChild(browser);
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    if (originalShareOrigin === undefined) delete process.env.EXPO_PUBLIC_SHARE_ORIGIN;
    else process.env.EXPO_PUBLIC_SHARE_ORIGIN = originalShareOrigin;
  };
  try {
    signals = installSignalCleanup(cleanup);
    const bundles = { valid: path.join(tmp, "fixture.js"), invalid: path.join(tmp, "fixture-invalid-origin.js") };
    await buildFixture("valid", bundles.valid, "https://himu.test");
    await buildFixture("invalid", bundles.invalid, "https://himu.test/path");
    const html = "<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html,body,#root{margin:0;width:100%;min-width:0;min-height:100%;}body{overflow:auto}</style><div id=\"root\"></div><script>window.addEventListener('error',e=>window.__HIMU_BROWSER_ERROR__=e.error?.stack||e.message)</script><script src=\"__FIXTURE__\"></script>";
    server = http.createServer((req, res) => {
      if (req.url === "/fixture.js" || req.url === "/fixture-invalid-origin.js") {
        const bundle = req.url === "/fixture.js" ? bundles.valid : bundles.invalid;
        res.writeHead(200, { "content-type": "text/javascript" });
        res.end(fs.readFileSync(bundle));
        return;
      }
      const fixtureUrl = req.url?.startsWith("/moment-invalid-origin") ? "/fixture-invalid-origin.js" : "/fixture.js";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html.replace("__FIXTURE__", fixtureUrl));
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const profile = path.join(tmp, "chrome");
    browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, `${origin}/moment`], { stdio: "ignore" });
    const port = (await waitFor(() => fs.existsSync(path.join(profile, "DevToolsActivePort")) && fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8"), "Chrome CDP unavailable")).trim().split("\n")[0];
    const pages = await waitFor(async () => {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      return targets.filter((target) => target.type === "page");
    }, "No Chrome page");
    cdp = await cdpConnect(pages[0].webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    const matrix = [];
    for (const [label, width, height, zoomPercent] of cells) {
      await navigate(cdp, origin, "/moment");
      await resize(cdp, width, height, zoomPercent);
      const snapshot = await read(cdp);
      matrix.push({ label, width, height, zoomPercent, noHorizontalOverflow: snapshot.noHorizontalOverflow, momentVisible: snapshot.momentVisible, visualViewport: snapshot.visualViewport });
    }
    const cases = await scenario(cdp, origin);
    process.stdout.write(JSON.stringify({ matrix, cases, locales: ["en", "es"] }));
  } finally {
    signals?.dispose();
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
