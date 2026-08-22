const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig } = require("@expo/metro-config");
const { runBuild } = require("@expo/metro/metro");

const harnessDirectory = path.dirname(path.resolve(process.argv[1]));
const projectRoot = path.resolve(harnessDirectory, "../..");
const fixtureEntries = {
  form: "ResponsiveFormShell-browser-fixture.tsx",
  image: "HimuImage-boundary-browser-fixture.tsx",
  animated: "Animated-boundary-browser-fixture.tsx",
  canvas: "ScreenCanvas-boundary-browser-fixture.tsx",
  gesture: "GestureRoot-boundary-browser-fixture.tsx",
  login: "LoginHero-boundary-browser-fixture.tsx",
};
const fixtureKey = process.env.HIMU_BROWSER_FIXTURE || "form";
if (!Object.hasOwn(fixtureEntries, fixtureKey)) {
  throw new Error(`Unsupported browser fixture: ${fixtureKey}`);
}
const fixtureEntry = path.join(harnessDirectory, fixtureEntries[fixtureKey]);
const viewport = fixtureKey === "login"
  ? { width: 390, height: 844 }
  : { width: 720, height: 422 };

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function readBrowserResult(dom) {
  const match = dom.match(
    /<pre id="browser-test-result"[^>]*>(\{.*\})<\/pre>/,
  );

  if (!match) {
    throw new Error(`Chromium did not publish a fixture result.\n${dom.slice(-4000)}`);
  }

  return JSON.parse(match[1]);
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error(
      "ResponsiveFormShell browser integration requires Chrome or Chromium",
    );
  }

  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "himu-responsive-form-shell-"),
  );

  try {
    const bundlePath = path.join(outputDirectory, "fixture.js");
    const htmlPath = path.join(outputDirectory, "fixture.html");
    const metroConfig = getDefaultConfig(projectRoot);
    metroConfig.resetCache = true;
    metroConfig.cacheVersion = `responsive-form-shell-${Date.now()}`;

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

      return context.resolveRequest(
        webContext,
        moduleName.startsWith("@/")
          ? path.join(projectRoot, moduleName.slice(2))
          : moduleName,
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

    fs.writeFileSync(
      htmlPath,
      `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; overflow: hidden; width: ${viewport.width}px; height: ${viewport.height}px; }
      #root { display: flex; width: ${viewport.width}px; height: ${viewport.height}px; }
      #browser-test-result { display: none; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <pre id="browser-test-result"></pre>
    <script>
      window.addEventListener("error", (event) => {
        document.querySelector("#browser-test-result").textContent = JSON.stringify({
          browserError: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error && event.error.stack
        });
      });
      window.addEventListener("unhandledrejection", (event) => {
        document.querySelector("#browser-test-result").textContent = JSON.stringify({
          browserError: String(event.reason)
        });
      });
    </script>
    <script src="${path.basename(bundlePath)}"></script>
  </body>
</html>`,
    );

    const browser = spawnSync(
      chrome,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--dump-dom",
        "--virtual-time-budget=10000",
        `--window-size=${viewport.width},${viewport.height}`,
        `file://${htmlPath}`,
      ],
      {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30_000,
      },
    );

    if (browser.error || browser.status !== 0) {
      throw new Error(
        `Chromium failed (${browser.status ?? "no status"}): ${
          browser.error?.message ?? browser.stderr
        }`,
      );
    }

    process.stdout.write(JSON.stringify(readBrowserResult(browser.stdout)));
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
