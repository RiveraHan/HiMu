test("configures the theme before Expo Router evaluates app modules", () => {
  const evaluationOrder: string[] = [];
  jest.resetModules();
  jest.doMock("@/src/theme", () => {
    evaluationOrder.push("theme");
    return {};
  });
  jest.doMock("@/src/i18n", () => ({}));
  jest.doMock("expo-router/entry", () => {
    evaluationOrder.push("router");
    return {};
  });

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/index");
  });

  expect(evaluationOrder).toEqual(["theme", "router"]);
});
