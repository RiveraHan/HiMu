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
});
