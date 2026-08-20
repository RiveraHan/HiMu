import { Image, type ImageProps } from "expo-image";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type StyleProp,
  StyleSheet,
  type ViewStyle,
  View,
} from "react-native";

type Status = "idle" | "loading" | "loaded" | "error";

type HimuImageProps = Omit<
  ImageProps,
  | "source"
  | "style"
  | "onLoadStart"
  | "onDisplay"
  | "onError"
  | "accessibilityLabel"
  | "alt"
  | "testID"
> & {
  source?: ImageProps["source"];
  fallback?: ReactNode;
  accessibilityLabel?: string;
  eager?: boolean;
  retryKey?: string | number | null;
  onRetry?: () => void;
  componentLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function hasSource(source: ImageProps["source"]): boolean {
  return Array.isArray(source) ? source.length > 0 : source != null && source !== "";
}

function sourceIdentity(source: ImageProps["source"]): string | object | null | undefined {
  if (source == null) return source;
  if (typeof source === "string" || typeof source === "number") {
    return `resource:${source}`;
  }
  if (Array.isArray(source)) {
    return source.map((item) => sourceIdentity(item)).join("|");
  }
  if ("uri" in source) {
    return `uri:${source.uri ?? ""}|cache:${source.cacheKey ?? ""}`;
  }
  return source;
}

function sourceHost(source: ImageProps["source"]): string | undefined {
  const candidate = Array.isArray(source) ? source[0] : source;
  const uri =
    typeof candidate === "string"
      ? candidate
      : candidate && typeof candidate === "object" && "uri" in candidate
        ? candidate.uri
        : undefined;

  if (!uri) return undefined;

  try {
    return new URL(uri).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Renders remote artwork without letting loading or error states collapse its layout.
 * A retry is initiated by changing `retryKey`; each source gets at most one retry.
 */
export function HimuImage({
  source,
  fallback,
  accessibilityLabel,
  eager = false,
  retryKey = null,
  onRetry,
  componentLabel = "image",
  style,
  testID = "himu-image",
  ...imageProps
}: HimuImageProps) {
  const initialHasSource = hasSource(source);
  const [status, setStatus] = useState<Status>(
    initialHasSource ? "loading" : "idle",
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const sourceIsPresent = hasSource(source);
  const sourceKey = sourceIdentity(source);
  const previousSource = useRef(sourceKey);
  const previousRetryKey = useRef(retryKey);
  const retryCount = useRef(0);

  useEffect(() => {
    const sourceChanged = previousSource.current !== sourceKey;
    const retryChanged = previousRetryKey.current !== retryKey;

    if (sourceChanged) {
      retryCount.current = 0;
    }

    if (!sourceIsPresent) {
      setStatus("idle");
    } else if (sourceChanged || (retryChanged && retryCount.current === 0)) {
      if (retryChanged && !sourceChanged) {
        retryCount.current = 1;
        onRetry?.();
      }
      setStatus("loading");
      setRequestVersion((version) => version + 1);
    }

    previousSource.current = sourceKey;
    previousRetryKey.current = retryKey;
  }, [onRetry, retryKey, sourceIsPresent, sourceKey]);

  const showImage = sourceIsPresent && status !== "error";
  const showFallback = !showImage || status !== "loaded";
  const isInformative = Boolean(accessibilityLabel);

  return (
    <View testID={testID} style={[styles.frame, style]}>
      {showFallback ? (
        <View
          accessible={false}
          pointerEvents="none"
          testID="himu-image-fallback"
          style={styles.fallback}
        >
          {fallback}
        </View>
      ) : null}
      {showImage ? (
        <Image
          {...imageProps}
          key={requestVersion}
          source={source}
          recyclingKey={String(requestVersion)}
          priority={eager ? "high" : "low"}
          style={[styles.image, status === "loaded" ? styles.visible : styles.hidden]}
          testID="himu-image-native"
          accessible={isInformative}
          accessibilityLabel={accessibilityLabel}
          alt={accessibilityLabel ?? ""}
          onLoadStart={() => {
            setStatus((current) =>
              current === "loaded" ? current : "loading",
            );
          }}
          onDisplay={() => setStatus("loaded")}
          onError={() => {
            if (__DEV__) {
              console.warn("[HimuImage] failed to display", {
                component: componentLabel,
                host: sourceHost(source),
              });
            }
            setStatus("error");
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    overflow: "hidden",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
  },
});

export type { HimuImageProps };
