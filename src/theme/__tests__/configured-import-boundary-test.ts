import fs from "node:fs";
import path from "node:path";

const sourceRoots = ["app", "src"];
const allowedDirectImport = path.normalize("src/theme/unistyles.ts");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(filePath);
    }

    return /\.[jt]sx?$/.test(entry.name) ? [filePath] : [];
  });
}

test("all runtime Unistyles imports pass through the configured theme boundary", () => {
  const directImports = sourceRoots
    .flatMap(sourceFiles)
    .filter((filePath) =>
      fs.readFileSync(filePath, "utf8").includes('from "react-native-unistyles"') ||
      fs.readFileSync(filePath, "utf8").includes("from 'react-native-unistyles'")
    )
    .map((filePath) => path.normalize(filePath));

  expect(directImports).toEqual([allowedDirectImport]);
});
