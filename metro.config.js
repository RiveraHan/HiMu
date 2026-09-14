const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function descendantPattern(directory) {
  const absoluteDirectory = escapeRegExp(path.resolve(projectRoot, directory));
  return new RegExp(`^${absoluteDirectory}[\\\\/].*`);
}

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [
  ...defaultBlockList,
  descendantPattern(".worktrees"),
  descendantPattern("android/app/build"),
];

module.exports = config;
