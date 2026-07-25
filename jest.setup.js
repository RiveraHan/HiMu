require("react-native-reanimated").setUpTests();

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [
    {
      languageCode: "en",
      languageTag: "en-US",
      regionCode: "US",
      textDirection: "ltr",
      digitGroupingSeparator: ",",
      decimalSeparator: ".",
      measurementSystem: "us",
      temperatureUnit: "fahrenheit",
      currencyCode: "USD",
      currencySymbol: "$",
    },
  ]),
}));

const i18n = require("./src/i18n").default;

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

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
