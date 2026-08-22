import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(__dirname, "../../..");
const sourceRoots = ["app", "src/components"] as const;
const maxDepth = 8;
const maxFiles = 800;
const maxSourceBytes = 256 * 1024;

function boundedTsxFiles(): string[] {
  const files: string[] = [];
  const visit = (directory: string, depth: number) => {
    if (depth > maxDepth) throw new Error(`Boundary audit exceeded depth ${maxDepth}: ${directory}`);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Boundary audit refuses symlink: ${filePath}`);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") visit(filePath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !filePath.endsWith(".tsx")) continue;
      if (fs.statSync(filePath).size > maxSourceBytes) {
        throw new Error(`Boundary audit refuses source over ${maxSourceBytes} bytes: ${filePath}`);
      }
      files.push(filePath);
      if (files.length > maxFiles) throw new Error(`Boundary audit exceeded ${maxFiles} files`);
    }
  };

  for (const root of sourceRoots) visit(path.join(projectRoot, root), 0);
  return files.sort();
}

function jsxTagName(node: ts.JsxTagNameExpression): string {
  return ts.isPropertyAccessExpression(node)
    ? `${jsxTagName(node.expression as ts.JsxTagNameExpression)}.${node.name.text}`
    : node.getText();
}

describe("Unistyles host-boundary audit", () => {
  it("adapts generated styles at the expo-blur composite boundary", () => {
    const violations: string[] = [];

    for (const filePath of boundedTsxFiles()) {
      const source = fs.readFileSync(filePath, "utf8");
      if (!source.includes("@/src/theme/react-native-unistyles")) continue;
      const parsed = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = jsxTagName(node.tagName);
          const style = node.attributes.properties.find(
            (attribute): attribute is ts.JsxAttribute =>
              ts.isJsxAttribute(attribute) && attribute.name.getText() === "style",
          );
          const expression = style?.initializer && ts.isJsxExpression(style.initializer)
            ? style.initializer.expression?.getText(parsed) ?? ""
            : "";

          if (tag === "BlurView" && /\bstyles\./.test(expression)) {
            const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
            violations.push(`${path.relative(projectRoot, filePath)}:${line + 1} ${tag}`);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(parsed);
    }

    expect(violations).toEqual([]);
  });

  it("keeps the supported adapter limited to the proven composite boundary", () => {
    const adapterFiles = boundedTsxFiles()
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("withUnistyles("))
      .map((filePath) => path.relative(projectRoot, filePath));

    expect(adapterFiles).toEqual([
      "src/components/GlassView.tsx",
      "src/components/UnistylesGestureHandlerRootView.tsx",
    ]);

    const glassView = fs.readFileSync(
      path.join(projectRoot, "src/components/GlassView.tsx"),
      "utf8",
    );
    expect(glassView).toContain("withUnistyles(BlurView)");
    expect(glassView).toContain("<UnistylesBlurView");
    expect(glassView).not.toContain("<BlurView");

    const rootAdapter = fs.readFileSync(
      path.join(projectRoot, "src/components/UnistylesGestureHandlerRootView.tsx"),
      "utf8",
    );
    expect(rootAdapter).toContain("withUnistyles(GestureHandlerRootView)");
    const rootLayout = fs.readFileSync(path.join(projectRoot, "app/_layout.tsx"), "utf8");
    expect(rootLayout).toContain("<UnistylesGestureHandlerRootView");
    expect(rootLayout).not.toContain("<GestureHandlerRootView");
  });
});
