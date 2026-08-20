import { Platform } from "react-native";

export const HIMU_FONTS = {
  "Manrope-Regular": require("../../assets/fonts/Manrope/Manrope-Regular.ttf"),
  "Manrope-SemiBold": require("../../assets/fonts/Manrope/Manrope-SemiBold.ttf"),
  "Manrope-Bold": require("../../assets/fonts/Manrope/Manrope-Bold.ttf"),
} as const;

export const HIMU_FONT_FAMILIES = {
  regular: Platform.select({
    web: '"Manrope-Regular", system-ui, sans-serif',
    default: "Manrope-Regular",
  }) ?? "Manrope-Regular",
  semiBold: Platform.select({
    web: '"Manrope-SemiBold", system-ui, sans-serif',
    default: "Manrope-SemiBold",
  }) ?? "Manrope-SemiBold",
  bold: Platform.select({
    web: '"Manrope-Bold", system-ui, sans-serif',
    default: "Manrope-Bold",
  }) ?? "Manrope-Bold",
} as const;
