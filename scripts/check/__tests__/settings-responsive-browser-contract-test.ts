import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../..");

async function source(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

describe("Task 6 settings release harness contract", () => {
  it("uses the production three-section preference model without retired controls", async () => {
    const [fixture, hooks, checker] = await Promise.all([
      source("test-support/settings-browser/SettingsWorkflow-browser-fixture.tsx"),
      source("test-support/settings-browser/settings-browser-hooks.ts"),
      source("scripts/check/settings-responsive-browser.cjs"),
    ]);

    expect(hooks).toContain('atmosphere: "balanced"');
    expect(`${fixture}\n${hooks}\n${checker}`).not.toMatch(
      /preferences-settings-grid|preference-vibe-zone|vibeMapping|aiFrequency|discoveryDepth|ambientSelected/,
    );
    expect(fixture).toMatch(/preferenceSectionOrder/);
    expect(fixture).toMatch(/atmosphereRadioCount/);
    expect(fixture).toMatch(/documentScrollWidth/);
    expect(fixture).toMatch(/saveStatus/);
  });

  it("covers both locales and every required effective viewport", async () => {
    const runner = await source(
      "test-support/settings-browser/run-settings-responsive-browser.cjs",
    );

    expect(runner).toMatch(/const locales\s*=\s*\["en",\s*"es"\]/);
    for (const cell of [
      "320, 640",
      "390, 844",
      "768, 1024",
      "1023, 768",
      "1024, 768",
      "1440, 900",
      "1920, 1080",
      "720, 422",
      "512, 384",
    ]) {
      expect(runner).toContain(cell);
    }
    expect(runner).toMatch(/focusDialogEndpoint/);
    expect(runner).toMatch(/runPlayerCell/);
    expect(runner).toContain('call.href === "/preferences"');
  });

  it("uses concrete localized Maestro labels and records the manual Android gate", async () => {
    const flow = await source(".maestro/himu-beta-onboarding-first-track.yaml");

    expect(flow).toContain('tapOn: "Edit Favorite genres"');
    expect(flow).toContain('tapOn: "Edit Moods to avoid"');
    expect(flow).toContain('tapOn: "Balanced"');
    expect(flow).toContain('assertVisible: "Saved"');
    expect(flow).toContain("Pending manual Android release gate");
    expect((flow.match(/tapOn:\s*["']Continue["']/g) ?? [])).toHaveLength(2);
  });
});
