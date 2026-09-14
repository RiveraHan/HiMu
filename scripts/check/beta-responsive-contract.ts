import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRootArgument = process.argv.indexOf("--project-root");
const projectRoot = projectRootArgument === -1
  ? path.resolve(__dirname, "../..")
  : path.resolve(process.argv[projectRootArgument + 1] ?? "");

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

function isInside(node: ts.Node, ancestor: ts.Node) {
  return node.pos >= ancestor.pos && node.end <= ancestor.end;
}

type SmokeGuardFact = "development" | "smoke-flag" | "smoke-user";

function unparenthesized(expression: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(expression)
    ? unparenthesized(expression.expression)
    : expression;
}

function isSmokeEnvironmentAccess(expression: ts.Expression) {
  const candidate = unparenthesized(expression);
  return (
    ts.isPropertyAccessExpression(candidate) &&
    candidate.name.text === "EXPO_PUBLIC_BETA_SMOKE" &&
    ts.isPropertyAccessExpression(candidate.expression) &&
    candidate.expression.name.text === "env" &&
    ts.isIdentifier(candidate.expression.expression) &&
    candidate.expression.expression.text === "process"
  );
}

function isStringLiteral(expression: ts.Expression, value: string) {
  const candidate = unparenthesized(expression);
  return ts.isStringLiteral(candidate) && candidate.text === value;
}

function equalityFact(expression: ts.BinaryExpression): SmokeGuardFact | null {
  if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) return null;

  if (
    (isSmokeEnvironmentAccess(expression.left) && isStringLiteral(expression.right, "1")) ||
    (isStringLiteral(expression.left, "1") && isSmokeEnvironmentAccess(expression.right))
  ) {
    return "smoke-flag";
  }

  const isUserId = (candidate: ts.Expression) => {
    const unwrapped = unparenthesized(candidate);
    return ts.isIdentifier(unwrapped) && unwrapped.text === "userId";
  };
  if (
    (isUserId(expression.left) && isStringLiteral(expression.right, "beta-smoke-local-user")) ||
    (isStringLiteral(expression.left, "beta-smoke-local-user") && isUserId(expression.right))
  ) {
    return "smoke-user";
  }

  return null;
}

function positiveConjunctiveFacts(expression: ts.Expression): Set<SmokeGuardFact> {
  const candidate = unparenthesized(expression);
  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return new Set([
      ...positiveConjunctiveFacts(candidate.left),
      ...positiveConjunctiveFacts(candidate.right),
    ]);
  }
  if (ts.isIdentifier(candidate) && candidate.text === "__DEV__") {
    return new Set(["development"]);
  }
  if (ts.isBinaryExpression(candidate)) {
    const fact = equalityFact(candidate);
    if (fact) return new Set([fact]);
  }
  return new Set();
}

function dominatingSmokeFacts(node: ts.Node) {
  const facts = new Set<SmokeGuardFact>();
  let current: ts.Node | undefined = node;
  while (current?.parent) {
    const parent = current.parent;
    if (
      ts.isConditionalExpression(parent) &&
      isInside(node, parent.whenTrue)
    ) {
      positiveConjunctiveFacts(parent.condition).forEach((fact) => facts.add(fact));
    }
    if (
      ts.isIfStatement(parent) &&
      isInside(node, parent.thenStatement)
    ) {
      positiveConjunctiveFacts(parent.expression).forEach((fact) => facts.add(fact));
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      isInside(node, parent.right)
    ) {
      positiveConjunctiveFacts(parent.left).forEach((fact) => facts.add(fact));
    }
    current = parent;
  }
  return facts;
}

function hasPositiveSmokeDominance(node: ts.Node) {
  const facts = dominatingSmokeFacts(node);
  return facts.has("development") && facts.has("smoke-flag");
}

function hasExactSmokeUserDominance(node: ts.Node) {
  return dominatingSmokeFacts(node).has("smoke-user");
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
  const smokeButtons = loginNodes.filter(
    (node): node is ts.JsxSelfClosingElement | ts.JsxOpeningElement =>
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(loginSource) === "Button" &&
      jsxAttributeValue(node, "label") === "Continue beta smoke",
  );
  invariant(smokeButtons.length === 1, "Login must render exactly one Continue beta smoke Button.");
  invariant(
    smokeButtons.every(hasPositiveSmokeDominance),
    "The beta-smoke Login render and label require positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance.",
  );

  const smokeButton = smokeButtons[0]!;
  const onPressAttributes = smokeButton.attributes.properties.filter(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText(loginSource) === "onPress",
  );
  invariant(
    onPressAttributes.length === 1 &&
      !!onPressAttributes[0]!.initializer &&
      ts.isJsxExpression(onPressAttributes[0]!.initializer) &&
      !!onPressAttributes[0]!.initializer.expression,
    "The beta-smoke Button must declare exactly one executable onPress handler.",
  );
  const onPress = (onPressAttributes[0]!.initializer as ts.JsxExpression).expression!;
  invariant(
    hasPositiveSmokeDominance(onPress),
    "The beta-smoke Login handler requires positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance.",
  );

  const sessionHandlers = loginNodes.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) && /\.setSession$/.test(node.expression.getText(loginSource)),
  );
  invariant(sessionHandlers.length === 1, "Login must expose exactly one local smoke-session handler.");
  invariant(
    sessionHandlers.every(
      (node) => isInside(node, onPress) && hasPositiveSmokeDominance(node),
    ),
    "The local smoke session requires positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance inside the guarded handler.",
  );

  const smokeUsers = loginNodes.filter(
    (node): node is ts.StringLiteral =>
      ts.isStringLiteral(node) &&
      node.text === "beta-smoke-local-user" &&
      isInside(node, sessionHandlers[0]!),
  );
  invariant(smokeUsers.length === 1, "Login must create exactly one synthetic local smoke user.");
  invariant(
    smokeUsers.every(hasPositiveSmokeDominance),
    "The synthetic smoke session requires positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance.",
  );

  const guardedLoginText = smokeButton.getText(loginSource);
  invariant(
    !/(service[_-]?role|access[_-]?token|refresh[_-]?token|client[_-]?secret|SUPABASE_SERVICE)/i.test(
      guardedLoginText,
    ),
    "The smoke boundary must not contain production or service credentials.",
  );

  const ownedPath = "src/hooks/use-owned-djs.ts";
  const ownedSource = parse(ownedPath, await source(ownedPath));
  const ownedNodes = descendants(ownedSource);
  const emptyReturns = ownedNodes.filter(
    (node): node is ts.ReturnStatement =>
      ts.isReturnStatement(node) &&
      !!node.expression &&
      ts.isArrayLiteralExpression(node.expression) &&
      node.expression.elements.length === 0,
  );
  invariant(emptyReturns.length > 0, "The deterministic empty-owned-DJ fixture must exist.");
  invariant(
    emptyReturns.every(hasPositiveSmokeDominance),
    "An unguarded empty-owned-DJ override is forbidden; every empty return requires positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance.",
  );
  invariant(
    emptyReturns.every(hasExactSmokeUserDominance),
    "Every empty-owned-DJ override must be additionally dominated by the exact smoke user id.",
  );
  invariant(
    emptyReturns.length === 1,
    "The deterministic empty-owned-DJ fixture must exist exactly once.",
  );

  const ownedSmokeUsers = ownedNodes.filter(
    (node): node is ts.StringLiteral =>
      ts.isStringLiteral(node) && node.text === "beta-smoke-local-user",
  );
  invariant(ownedSmokeUsers.length === 1, "Owned-DJ loading must declare one local smoke-user boundary.");
  invariant(
    ownedSmokeUsers.every(hasPositiveSmokeDominance),
    "The exact smoke-user comparison requires positive conjunctive __DEV__ and EXPO_PUBLIC_BETA_SMOKE === \"1\" dominance.",
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

async function verifyVisualPolishMaestroFlow() {
  const flow = await source(".maestro/himu-beta-visual-polish.yaml");
  const required = [
    "appId: com.himu.app",
    'assertVisible: "Music Preferences"',
    'tapOn: "Edit genres"',
    'assertVisible: "Favorite genres"',
    'tapOn: "Done"',
    "pressKey: BACK",
    'assertVisible: "Personalized Library"',
    'tapOn: "Editar géneros"',
    'assertVisible: "Géneros favoritos"',
    'tapOn: "Listo"',
  ];
  let prior = -1;
  for (const marker of required) {
    const index = flow.indexOf(marker);
    invariant(index > prior, `Visual-polish Maestro flow is missing or misorders ${JSON.stringify(marker)}.`);
    prior = index;
  }
  invariant(
    /EXTERNAL_ANDROID_GATE/.test(flow) &&
      /physical phone and tablet/i.test(flow) &&
      /font scale 1\.5\/2\.0/i.test(flow) &&
      /TalkBack/i.test(flow),
    "Visual-polish Maestro flow must state the unavailable external Android phone/tablet, font-scale, and TalkBack gate.",
  );
  invariant(
    !/tapOn:\s*["']Choose genres["']/.test(flow),
    'Visual-polish Maestro flow must use the current "Edit genres" label.',
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
  await verifyVisualPolishMaestroFlow();
  await verifyBrowserFixtureContract();
  console.log(
    "Beta responsive contract verified: orientation, tablet/edge-to-edge parity, route protection, guarded local smoke boundary, real browser fixture, and Maestro scope.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
