test("configures the theme before the static HTML shell loads Router helpers", () => {
  const evaluationOrder: string[] = [];
  jest.resetModules();
  jest.doMock("@/src/theme", () => {
    evaluationOrder.push("theme");
    return {};
  });
  jest.doMock("expo-router/html", () => {
    evaluationOrder.push("router-html");
    return { ScrollViewStyleReset: () => null };
  });

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/app/+html");
  });

  expect(evaluationOrder).toEqual(["theme", "router-html"]);
});
