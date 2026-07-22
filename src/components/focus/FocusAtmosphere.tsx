import { LinearGradient } from "expo-linear-gradient";
import { View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function FocusAtmosphere() {
  const { theme } = useUnistyles();
  const { width, height } = useWindowDimensions();

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[
          theme.colors.surfaceContainerLowest,
          theme.colors.surfaceDim,
          theme.colors.surfaceContainerLow,
        ]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="orb1" cx="15%" cy="22%" r="55%">
            <Stop offset="0" stopColor="#bdc2ff" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#bdc2ff" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="orb2" cx="88%" cy="85%" r="65%">
            <Stop offset="0" stopColor="#b67af1" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#b67af1" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#orb1)" />
        <Rect width={width} height={height} fill="url(#orb2)" />
      </Svg>
    </View>
  );
}
