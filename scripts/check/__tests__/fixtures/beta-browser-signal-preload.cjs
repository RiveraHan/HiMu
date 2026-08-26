const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const Module = require("node:module");
const childProcess = require("node:child_process");

const kind = process.env.HIMU_SIGNAL_FIXTURE_KIND;
const readyPath = process.env.HIMU_SIGNAL_FIXTURE_READY;
const logPath = process.env.HIMU_SIGNAL_FIXTURE_LOG;

if (!kind || !readyPath || !logPath) {
  throw new Error("Missing beta browser signal fixture configuration");
}

function controlledChild(callback) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  const keepAlive = setInterval(() => undefined, 1_000);

  child.kill = (signal) => {
    fs.appendFileSync(logPath, `kill:${signal}\n`);
    if (child.exitCode !== null || child.signalCode !== null) return false;
    child.signalCode = signal;
    setTimeout(() => {
      clearInterval(keepAlive);
      child.emit("exit", null, signal);
      child.emit("close", null, signal);
      callback?.(null, "", "");
    }, 75);
    return true;
  };

  fs.writeFileSync(readyPath, "ready");
  return child;
}

if (kind === "wrapper") {
  childProcess.execFile = (...args) => {
    const callback = typeof args.at(-1) === "function" ? args.at(-1) : undefined;
    return controlledChild(callback);
  };
} else if (kind === "runner") {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === "node:http") {
      return {
        createServer: () => {
          const server = new EventEmitter();
          server.listening = false;
          server.listen = (_port, _host, callback) => {
            server.listening = true;
            process.nextTick(callback);
          };
          server.address = () => ({ address: "127.0.0.1", family: "IPv4", port: 43210 });
          server.close = (callback) => {
            server.listening = false;
            process.nextTick(callback);
          };
          return server;
        },
      };
    }
    if (request === "@expo/metro-config") {
      return {
        getDefaultConfig: () => ({
          resolver: {
            blockList: [],
            resolveRequest: () => undefined,
          },
        }),
      };
    }
    if (request === "@expo/metro/metro") {
      return {
        runBuild: async (_config, options) => {
          fs.writeFileSync(options.out, "");
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  childProcess.spawn = () => controlledChild();
} else {
  throw new Error(`Unknown beta browser signal fixture kind: ${kind}`);
}
