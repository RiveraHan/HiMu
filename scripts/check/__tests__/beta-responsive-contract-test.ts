import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "../../..");
const checker = path.join(projectRoot, "scripts/check/beta-responsive-contract.ts");

const BOTH_GUARDS = '__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE === "1"';

type FixtureOptions = {
  loginGuard?: string;
  ownedGuard?: string;
  ownedUserId?: string;
  unguardedEmptyReturn?: boolean;
};

async function writeFixtureFile(root: string, relativePath: string, contents: string) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function createFixture(options: FixtureOptions = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "himu-beta-responsive-contract-"));
  const loginGuard = options.loginGuard ?? BOTH_GUARDS;
  const ownedGuard = options.ownedGuard ?? BOTH_GUARDS;
  const ownedUserId = options.ownedUserId ?? "beta-smoke-local-user";

  await Promise.all([
    writeFixtureFile(
      fixtureRoot,
      "app.json",
      JSON.stringify({
        expo: {
          orientation: "default",
          ios: { supportsTablet: true },
          android: { edgeToEdgeEnabled: true, package: "com.himu.app" },
        },
      }),
    ),
    writeFixtureFile(
      fixtureRoot,
      "app/_layout.tsx",
      `export function Layout() {
        return <>
          <Stack.Screen name="welcome" />
          <Stack.Protected guard={!session}><Stack.Screen name="(auth)" /></Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="first-track" />
            <Stack.Screen name="create-dj" />
            <Stack.Screen name="create-track" />
          </Stack.Protected>
        </>;
      }`,
    ),
    writeFixtureFile(
      fixtureRoot,
      "app/(auth)/login.tsx",
      `export function Login() {
        return ${loginGuard} ? (
          <Button
            label="Continue beta smoke"
            onPress={() => {
              useAuthStore.getState().setSession({
                user: { id: "beta-smoke-local-user" },
              });
            }}
          />
        ) : null;
      }`,
    ),
    writeFixtureFile(
      fixtureRoot,
      "src/hooks/use-owned-djs.ts",
      `export function useOwnedDjs(userId: string) {
        return {
          queryFn: async () => {
            ${options.unguardedEmptyReturn ? 'if (userId === "unguarded-user") return [];' : ""}
            if (${ownedGuard}) {
              if (userId === ${JSON.stringify(ownedUserId)}) return [];
            }
            return fetchOwnedDjs(userId);
          },
        };
      }`,
    ),
    writeFixtureFile(
      fixtureRoot,
      ".maestro/himu-beta-onboarding-first-track.yaml",
      `appId: com.himu.app
---
- assertVisible: "From an emotion to a track"
- tapOn: "Create my first track"
- assertVisible: "Welcome to HiMu"
- tapOn: "Continue beta smoke"
- assertVisible: "Create your DJ"
- tapOn: "Continue"
- tapOn: "Continue"
- setOrientation: LANDSCAPE
- assertVisible: "Create your DJ"
`,
    ),
    writeFixtureFile(
      fixtureRoot,
      "test-support/beta-onboarding-browser/PublicIntro-browser-fixture.tsx",
      `import WelcomeScreen from "../../app/welcome";
       export default WelcomeScreen;`,
    ),
  ]);

  return fixtureRoot;
}

async function runChecker(fixtureRoot: string) {
  return execFileAsync(
    process.execPath,
    ["--import", "tsx", checker, "--project-root", fixtureRoot],
    { cwd: projectRoot },
  );
}

async function withFixture(
  options: FixtureOptions,
  assertion: (fixtureRoot: string) => Promise<void>,
) {
  const fixtureRoot = await createFixture(options);
  try {
    await assertion(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

describe("beta responsive smoke-boundary checker", () => {
  it("accepts exact positive conjunctive smoke guards and the exact local user", async () => {
    await withFixture({}, async (fixtureRoot) => {
      await expect(runChecker(fixtureRoot)).resolves.toMatchObject({
        stdout: expect.stringContaining("Beta responsive contract verified"),
      });
    });
  });

  it.each([
    ["OR", '__DEV__ || process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["only __DEV__", "__DEV__"],
    ["only the environment flag", 'process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["negated development", '!__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["negated environment", '__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE !== "1"'],
    ["ternary", '__DEV__ ? process.env.EXPO_PUBLIC_BETA_SMOKE === "1" : true'],
  ])("rejects a %s login guard", async (_label, loginGuard) => {
    await withFixture({ loginGuard }, async (fixtureRoot) => {
      await expect(runChecker(fixtureRoot)).rejects.toThrow(/positive conjunctive/i);
    });
  });

  it.each([
    ["OR", '__DEV__ || process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["only __DEV__", "__DEV__"],
    ["only the environment flag", 'process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["negated development", '!__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE === "1"'],
    ["negated environment", '__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE !== "1"'],
    ["ternary", '__DEV__ ? process.env.EXPO_PUBLIC_BETA_SMOKE === "1" : true'],
  ])("rejects a %s owned-DJ guard", async (_label, ownedGuard) => {
    await withFixture({ ownedGuard }, async (fixtureRoot) => {
      await expect(runChecker(fixtureRoot)).rejects.toThrow(/positive conjunctive/i);
    });
  });

  it("rejects an empty-owned override for the wrong local user", async () => {
    await withFixture({ ownedUserId: "not-the-smoke-user" }, async (fixtureRoot) => {
      await expect(runChecker(fixtureRoot)).rejects.toThrow(/exact smoke user/i);
    });
  });

  it("rejects any unguarded empty-owned return", async () => {
    await withFixture({ unguardedEmptyReturn: true }, async (fixtureRoot) => {
      await expect(runChecker(fixtureRoot)).rejects.toThrow(/unguarded empty-owned/i);
    });
  });
});
