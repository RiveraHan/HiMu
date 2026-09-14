const SIGNAL_EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
};

function createIdempotentCleanup(cleanup) {
  let cleanupPromise = null;
  return () => {
    if (!cleanupPromise) {
      cleanupPromise = Promise.resolve().then(cleanup);
    }
    return cleanupPromise;
  };
}

function installSignalCleanup(cleanup, processLike = process) {
  const runCleanup = createIdempotentCleanup(cleanup);
  let shutdownPromise = null;
  const handlers = new Map();

  const shutdown = (signal) => {
    if (!shutdownPromise) {
      shutdownPromise = runCleanup().then(
        () => processLike.exit(SIGNAL_EXIT_CODES[signal]),
        (error) => {
          processLike.stderr.write(`${error?.stack ?? error}\n`);
          processLike.exit(1);
        },
      );
    }
    return shutdownPromise;
  };

  for (const signal of Object.keys(SIGNAL_EXIT_CODES)) {
    const handler = () => {
      void shutdown(signal);
    };
    handlers.set(signal, handler);
    processLike.on(signal, handler);
  }

  return {
    shutdown,
    dispose() {
      for (const [signal, handler] of handlers) {
        processLike.removeListener(signal, handler);
      }
    },
  };
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

async function stopChild(child, { graceMs = 2_000, killMs = 5_000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const gracefulExit = waitForChildExit(child, graceMs);
  child.kill("SIGTERM");
  if (await gracefulExit) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  const forcedExit = waitForChildExit(child, killMs);
  child.kill("SIGKILL");
  await forcedExit;
}

module.exports = {
  createIdempotentCleanup,
  installSignalCleanup,
  stopChild,
};
