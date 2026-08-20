import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle, View } from "react-native";
import { HimuImage, type HimuImageProps } from "./HimuImage";

type ArtworkProps = Omit<HimuImageProps, "fallback" | "style"> & {
  size: number;
  fallback?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A square artwork frame that preserves its dimensions before the image displays. */
export function Artwork({ size, fallback, style, ...props }: ArtworkProps) {
  return (
    <HimuImage
      {...props}
      fallback={fallback ?? <View />}
      style={[{ width: size, height: size, aspectRatio: 1 }, style]}
    />
  );
}

export type { ArtworkProps };
