require("react-native-reanimated").setUpTests();

jest.mock("react-native-unistyles", () => {
  const ReactNative = require("react-native");
  const { darkTheme } = require("./src/theme/theme");

  return {
    StyleSheet: {
      ...ReactNative.StyleSheet,
      create: (styles) =>
        typeof styles === "function" ? styles(darkTheme) : styles,
    },
    useUnistyles: () => ({ theme: darkTheme, rt: {} }),
  };
});
