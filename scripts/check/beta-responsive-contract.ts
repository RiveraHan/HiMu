import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(__dirname, "../..");

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Beta responsive contract failed: ${message}`);
}

async function source(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

function parse(relativePath: string, contents: string) {
  return ts.createSourceFile(
    relativePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function guardContainsBoth(sourceFile: ts.SourceFile, expression: ts.Expression) {
  const text = expression.getText(sourceFile);
  return (
    /\b__DEV__\b/.test(text) &&
    /process\.env\.EXPO_PUBLIC_BETA_SMOKE\s*===\s*["']1["']/.test(text)
  );
}

function isInside(node: ts.Node, ancestor: ts.Node) {
  return node.pos >= ancestor.pos && node.end <= ancestor.end;
}

function isDoublyGuarded(sourceFile: ts.SourceFile, node: ts.Node) {
  let current: ts.Node | undefined = node;
  while (current?.parent) {
    const parent = current.parent;
    if (
      ts.isConditionalExpression(parent) &&
      isInside(node, parent.whenTrue) &&
      guardContainsBoth(sourceFile, parent.condition)
    ) {
      return true;
    }
    if (
      ts.isIfStatement(parent) &&
      isInside(node, parent.thenStatement) &&
      guardContainsBoth(sourceFile, parent.expression)
    ) {
      return true;
    }
    current = parent;
  }
  return false;
}

function descendants(sourceFile: ts.SourceFile) {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodes;
}

function jsxAttributeValue(element: ts.JsxOpeningLikeElement, name: string) {
  const attribute = element.attributes.properties.find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText() === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function protectedGuard(sourceFile: ts.SourceFile, node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement.tagName.getText(sourceFile) === "Stack.Protected"
    ) {
      const guard = current.openingElement.attributes.properties.find(
        (candidate): candidate is ts.JsxAttribute =>
          ts.isJsxAttribute(candidate) && candidate.name.getText(sourceFile) === "guard",
      );
      if (
        guard?.initializer &&
        ts.isJsxExpression(guard.initializer) &&
        guard.initializer.expression
      ) {
        return guard.initializer.expression.getText(sourceFile);
      }
      return "";
    }
    current = current.parent;
  }
  return null;
}

async function verifyConfig() {
  const app = JSON.parse(await source("app.json")) as {
    expo?: {
      orientation?: string;
      ios?: { supportsTablet?: boolean };
      android?: { edgeToEdgeEnabled?: boolean; package?: string };
    };
  };
  invariant(
    app.expo?.orientation === "default",
    `expo.orientation must be "default" (received ${JSON.stringify(app.expo?.orientation)}).`,
  );
  invariant(app.expo?.ios?.supportsTablet === true, "expo.ios.supportsTablet must be true.");
  invariant(
    app.expo?.android?.edgeToEdgeEnabled === true,
    "expo.android.edgeToEdgeEnabled must be true.",
  );
  invariant(app.expo?.android?.package === "com.himu.app", "Android app id must remain com.himu.app.");
}

async function verifyRoutes() {
  const relativePath = "app/_layout.tsx";
  const contents = await source(relativePath);
  const sourceFile = parse(relativePath, contents);
  const routes = descendants(sourceFile)
    .filter(ts.isJsxSelfClosingElement)
    .filter((node) => node.tagName.getText(sourceFile) === "Stack.Screen")
    .map((node) => ({
      name: jsxAttributeValue(node, "name"),
      guard: protectedGuard(sourceFile, node),
    }));

  invariant(
    routes.some(({ name, guard }) => name === "welcome" && guard === null),
    "Welcome must be declared as a public Stack.Screen outside Stack.Protected.",
  );
  invariant(
    routes.some(({ name, guard }) => name === "(auth)" && guard?.replace(/\s/g, "") === "!session"),
    "The auth group must remain protected by !session.",
  );
  for (const routeName of ["(app)", "first-track", "create-dj", "create-track"]) {
    invariant(
      routes.some(
        ({ name, guard }) => name === routeName && guard?.replace(/\s/g, "") === "!!session",
      ),
      `${routeName} must remain protected by !!session.`,
    );
  }
}

async function verifySmokeBoundary() {
  const loginPath = "app/(auth)/login.tsx";
  const loginSource = parse(loginPath, await source(loginPath));
  const loginNodes = descendants(loginSource);
  const smokeLabels = loginNodes.filter(
    (node): node is ts.StringLiteral => ts.isStringLiteral(node) && node.text === "Continue beta smoke",
  );
  invariant(smokeLabels.length === 1, "Login must declare exactly one Continue beta smoke label.");
  invariant(
    smokeLabels.every((node) => isDoublyGuarded(loginSource, node)),
    "The beta-smoke Login render must be dominated by __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\".",
  );

  const smokeUsers = loginNodes.filter(
    (node): node is ts.StringLiteral =>
      ts.isStringLiteral(node) && node.text === "beta-smoke-local-user",
  );
  invariant(smokeUsers.length === 1, "Login must create exactly one synthetic local smoke user.");
  invariant(
    smokeUsers.every((node) => isDoublyGuarded(loginSource, node)),
    "The synthetic smoke session must be dominated by both beta-smoke guards.",
  );

  const sessionHandlers = loginNodes.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) && /\.setSession$/.test(node.expression.getText(loginSource)),
  );
  invariant(sessionHandlers.length === 1, "Login must expose exactly one local smoke-session handler.");
  invariant(
    sessionHandlers.every((node) => isDoublyGuarded(loginSource, node)),
    "The local smoke-session handler must be dominated by both beta-smoke guards.",
  );

  const guardedLoginText = smokeLabels[0]!.parent.parent.getText(loginSource);
  invariant(
    !/(service[_-]?role|access[_-]?token|refresh[_-]?token|client[_-]?secret|SUPABASE_SERVICE)/i.test(
      guardedLoginText,
    ),
    "The smoke boundary must not contain production or service credentials.",
  );

  const ownedPath = "src/hooks/use-owned-djs.ts";
  const ownedSource = parse(ownedPath, await source(ownedPath));
  const ownedNodes = descendants(ownedSource);
  const ownedSmokeUsers = ownedNodes.filter(
    (node): node is ts.StringLiteral =>
      ts.isStringLiteral(node) && node.text === "beta-smoke-local-user",
  );
  invariant(ownedSmokeUsers.length === 1, "Owned-DJ loading must declare one local smoke-user boundary.");
  invariant(
    ownedSmokeUsers.every((node) => isDoublyGuarded(ownedSource, node)),
    "The empty-owned-DJ override must be dominated by both beta-smoke guards.",
  );
  const guardedEmptyReturns = ownedNodes.filter(
    (node): node is ts.ReturnStatement =>
      ts.isReturnStatement(node) &&
      !!node.expression &&
      ts.isArrayLiteralExpression(node.expression) &&
      node.expression.elements.length === 0 &&
      isDoublyGuarded(ownedSource, node),
  );
  invariant(
    guardedEmptyReturns.length === 1,
    "The deterministic empty-owned-DJ fixture must exist exactly once under both guards.",
  );
}

async function verifyMaestroFlow() {
  const flow = await source(".maestro/himu-beta-onboarding-first-track.yaml");
  const required = [
    "appId: com.himu.app",
    'assertVisible: "From an emotion to a track"',
    'tapOn: "Create my first track"',
    'assertVisible: "Welcome to HiMu"',
    'tapOn: "Continue beta smoke"',
    'assertVisible: "Create your DJ"',
  ];
  let prior = -1;
  for (const marker of required) {
    const index = flow.indexOf(marker);
    invariant(index > prior, `Maestro flow is missing or misorders ${JSON.stringify(marker)}.`);
    prior = index;
  }
  invariant(!/^\s*-\s*back\s*$/m.test(flow), "The Task 7 Maestro flow must stop at Create your DJ.");
  invariant(
    (flow.match(/tapOn:\s*["']Continue["']/g) ?? []).length === 2,
    "The Maestro flow must advance through exactly two Continue actions.",
  );
  invariant(
    /setOrientation:\s*LANDSCAPE/.test(flow),
    "The Maestro flow must rotate once and keep asserting the current Create DJ screen.",
  );
  invariant(
    (flow.match(/assertVisible:\s*["']Create your DJ["']/g) ?? []).length === 2,
    "The Maestro flow must assert Create your DJ before and after rotation.",
  );
}

async function verifyBrowserFixtureContract() {
  const fixture = await source(
    "test-support/beta-onboarding-browser/PublicIntro-browser-fixture.tsx",
  );
  invariant(
    /from\s+["']\.\.\/\.\.\/app\/welcome["']/.test(fixture),
    "The browser fixture must render the real app/welcome route controller.",
  );
  invariant(
    !/jest\.mock|PublicProductIntro\s*:\s*\(/.test(fixture),
    "The browser fixture must not replace PublicProductIntro.",
  );
}

async function main() {
  await verifyConfig();
  await verifyRoutes();
  await verifySmokeBoundary();
  await verifyMaestroFlow();
  await verifyBrowserFixtureContract();
  console.log(
    "Beta responsive contract verified: orientation, tablet/edge-to-edge parity, route protection, guarded local smoke boundary, real browser fixture, and Maestro scope.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
