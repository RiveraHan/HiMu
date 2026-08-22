/** @jest-environment node */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

type BrowserResult = {
  viewport: {
    width: number;
    height: number;
    scrollRenderedWidth: number;
    scrollRenderedHeight: number;
  };
  productionScrollCss: {
    overflowX: string;
    overflowY: string;
    flexGrow: string;
    flexShrink: string;
    flexBasis: string;
    contentFlexGrow: string;
  };
  productionTree: {
    shellInScroll: boolean;
    longFormInScroll: boolean;
    longReviewInScroll: boolean;
    footerInScroll: boolean;
    actionInFooter: boolean;
  };
  beforeScroll: {
    scrollTop: number;
    actionBelowViewport: boolean;
  };
  afterScroll: {
    scrollTop: number;
    actionVisible: boolean;
    actionFocused: boolean;
    actionTabIndex: number;
  };
};

const execFileAsync = promisify(execFile);

async function renderProductionShellInChrome(): Promise<BrowserResult> {
  const harnessPath = path.join(
    __dirname,
    "browser",
    "run-responsive-form-shell-browser.cjs",
  );
  const { stdout } = await execFileAsync(process.execPath, [harnessPath], {
    cwd: path.resolve(__dirname, "../../../.."),
    maxBuffer: 20 * 1024 * 1024,
    timeout: 60_000,
  });

  return JSON.parse(stdout) as BrowserResult;
}

describe("ResponsiveFormShell in Chromium", () => {
  jest.setTimeout(70_000);

  it("keeps the real footer action focusable and reachable in the production scroll flow at 200 percent zoom", async () => {
    const result = await renderProductionShellInChrome();

    expect(result.productionTree).toEqual({
      shellInScroll: true,
      longFormInScroll: true,
      longReviewInScroll: true,
      footerInScroll: true,
      actionInFooter: true,
    });
    expect(result.viewport).toEqual({
      width: 720,
      height: 422,
      scrollRenderedWidth: 720,
      scrollRenderedHeight: 422,
    });
    expect(result.productionScrollCss).toEqual({
      overflowX: "scroll",
      overflowY: "scroll",
      flexGrow: "1",
      flexShrink: "1",
      flexBasis: "0%",
      contentFlexGrow: "1",
    });
    expect(result.beforeScroll).toEqual({
      scrollTop: 0,
      actionBelowViewport: true,
    });
    expect(result.afterScroll).toEqual({
      scrollTop: expect.any(Number),
      actionVisible: true,
      actionFocused: true,
      actionTabIndex: 0,
    });
    expect(result.afterScroll.scrollTop).toBeGreaterThan(0);
  });
});
