import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../..");
const preload = path.join(
  __dirname,
  "fixtures/beta-browser-signal-preload.cjs",
);

async function waitForFile(file: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await access(file);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function waitForExit(child: ReturnType<typeof spawn>) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Signal cleanup subprocess did not exit"));
      }, 5_000);
      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal });
      });
    },
  );
}

async function exerciseSignalCleanup(kind: "runner" | "wrapper", script: string) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "himu-browser-signal-"));
  const readyPath = path.join(fixtureRoot, "ready");
  const logPath = path.join(fixtureRoot, "signals.log");
  const child = spawn(process.execPath, [script], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CHROME_BIN: "/bin/true",
      HIMU_SIGNAL_FIXTURE_KIND: kind,
      HIMU_SIGNAL_FIXTURE_LOG: logPath,
      HIMU_SIGNAL_FIXTURE_READY: readyPath,
      NODE_OPTIONS: `--require=${preload}`,
    },
    stdio: "ignore",
  });

  try {
    await waitForFile(readyPath);
    const exited = waitForExit(child);
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 10));
    child.kill("SIGINT");
    await exited;

    const signals = (await readFile(logPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(signals).toEqual(["kill:SIGTERM"]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

describe("beta onboarding browser signal cleanup", () => {
  it("stops the browser child once when the runner receives repeated termination signals", async () => {
    await exerciseSignalCleanup(
      "runner",
      path.join(
        projectRoot,
        "test-support/beta-onboarding-browser/run-public-intro-responsive-browser.cjs",
      ),
    );
  });

  it("stops the runner child once when the wrapper receives repeated termination signals", async () => {
    await exerciseSignalCleanup(
      "wrapper",
      path.join(projectRoot, "scripts/check/beta-onboarding-responsive-browser.cjs"),
    );
  });
});
