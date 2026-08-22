import { transformFileSync, type TransformOptions } from "@babel/core";
import path from "node:path";

describe("web Babel transform", () => {
  it("removes import.meta from dependencies served by Metro as classic scripts", () => {
    const middlewarePath = path.join(
      process.cwd(),
      "node_modules/zustand/esm/middleware.mjs",
    );
    const caller = {
      name: "metro",
      platform: "web",
      isDev: true,
      isServer: false,
      supportsStaticESM: false,
      supportsDynamicImport: false,
      supportsExportNamespaceFrom: false,
    } as unknown as NonNullable<TransformOptions["caller"]>;
    const result = transformFileSync(middlewarePath, { caller });

    expect(result?.code).toContain("__ExpoImportMetaRegistry");
    expect(result?.code).not.toContain("import.meta");
  });

  it("emits Unistyles dependency metadata for app route styles", () => {
    const nodeEnv = jest.replaceProperty(process.env, "NODE_ENV", "development");
    const createBabelConfig = jest.requireActual(
      path.join(process.cwd(), "babel.config.js"),
    ) as (api: { cache: (enabled: boolean) => void }) => TransformOptions;
    const config = createBabelConfig({ cache: () => undefined });

    let output: string | null | undefined;
    try {
      output = transformFileSync(
        path.join(process.cwd(), "app/(auth)/login.tsx"),
        {
          ...config,
          babelrc: false,
          configFile: false,
          caller: {
            name: "metro",
            platform: "web",
            isDev: true,
            isServer: false,
            supportsStaticESM: false,
            supportsDynamicImport: false,
            supportsExportNamespaceFrom: false,
          } as unknown as NonNullable<TransformOptions["caller"]>,
        },
      )?.code;
    } finally {
      nodeEnv.restore();
    }

    expect(output).toContain("uni__dependencies");
  });
});
