import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, type ViewStyle, View } from "react-native";
import { HimuImage, type HimuImageProps } from "./HimuImage";

type ArtworkProps = Omit<HimuImageProps, "fallback" | "style"> & {
  size: number;
  fallback?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A square artwork frame that preserves its dimensions before the image displays. */
export function Artwork({ size, fallback, style, ...props }: ArtworkProps) {
  const {
    aspectRatio: _aspectRatio,
    height: _height,
    maxHeight: _maxHeight,
    maxWidth: _maxWidth,
    minHeight: _minHeight,
    minWidth: _minWidth,
    width: _width,
    ...decorationStyle
  } = StyleSheet.flatten(style) ?? {};

  return (
    <HimuImage
      {...props}
      fallback={fallback ?? <View />}
      style={[decorationStyle, { width: size, height: size, aspectRatio: 1 }]}
    />
  );
}

export type { ArtworkProps };
