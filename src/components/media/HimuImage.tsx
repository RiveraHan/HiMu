import { Image, type ImageProps } from "expo-image";
import {
  type ReactNode,
  useEffect,
  useRef,
  useReducer,
} from "react";
import {
  type StyleProp,
  StyleSheet,
  type ViewStyle,
  View,
} from "react-native";

export type HimuImageStatus = "idle" | "loading" | "loaded" | "error";

type ImageState = {
  sourceKey: string | object | null | undefined;
  retryKey: string | number | null;
  sourceIsPresent: boolean;
  generation: number;
  retryCount: number;
  status: HimuImageStatus;
  isExplicitRetry: boolean;
};

type ImageAction =
  | {
      type: "sync";
      sourceKey: ImageState["sourceKey"];
      retryKey: ImageState["retryKey"];
      sourceIsPresent: boolean;
    }
  | { type: "loadStart"; generation: number }
  | { type: "display"; generation: number }
  | { type: "error"; generation: number };

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
  /** Called after the current source generation has been displayed. */
  onDisplay?: () => void;
  /** Called after the current source generation has failed to display. */
  onError?: () => void;
  /** Reports current-generation image state transitions. */
  onStatusChange?: (status: HimuImageStatus) => void;
  componentLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function hasSource(source: ImageProps["source"]): boolean {
  return Array.isArray(source) ? source.length > 0 : source != null && source !== "";
}

const sourceObjectIds = new WeakMap<object, number>();
let nextSourceObjectId = 0;

function sourceObjectIdentity(source: object): string {
  let id = sourceObjectIds.get(source);
  if (id == null) {
    id = nextSourceObjectId;
    nextSourceObjectId += 1;
    sourceObjectIds.set(source, id);
  }
  return `object:${id}`;
}

function sourceIdentity(source: ImageProps["source"]): string | object | null | undefined {
  if (source == null) return source;
  if (typeof source === "string" || typeof source === "number") {
    return `resource:${source}`;
  }
  if (Array.isArray(source)) {
    return source.map((item) => sourceIdentity(item)).join("|");
  }
  const imageSource = source as Exclude<
    NonNullable<ImageProps["source"]>,
    string | number
  >;
  if (
    "uri" in imageSource ||
    "headers" in imageSource ||
    "width" in imageSource ||
    "height" in imageSource ||
    "blurhash" in imageSource ||
    "thumbhash" in imageSource ||
    "cacheKey" in imageSource ||
    "webMaxViewportWidth" in imageSource ||
    "isAnimated" in imageSource
  ) {
    const { headers } = imageSource;
    return JSON.stringify({
      uri: imageSource.uri,
      headers: headers
        ? Object.entries(headers).sort(([left], [right]) => left.localeCompare(right))
        : undefined,
      width: imageSource.width,
      height: imageSource.height,
      blurhash: imageSource.blurhash,
      thumbhash: imageSource.thumbhash,
      cacheKey: imageSource.cacheKey,
      webMaxViewportWidth: imageSource.webMaxViewportWidth,
      isAnimated: imageSource.isAnimated,
    });
  }
  return sourceObjectIdentity(source);
}

function reduceImageState(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case "sync": {
      const sourceChanged = state.sourceKey !== action.sourceKey;
      const retryChanged = state.retryKey !== action.retryKey;

      if (sourceChanged) {
        return {
          sourceKey: action.sourceKey,
          retryKey: action.retryKey,
          sourceIsPresent: action.sourceIsPresent,
          generation: state.generation + 1,
          retryCount: 0,
          status: action.sourceIsPresent ? "loading" : "idle",
          isExplicitRetry: false,
        };
      }

      if (retryChanged && action.sourceIsPresent && state.retryCount === 0) {
        return {
          ...state,
          retryKey: action.retryKey,
          generation: state.generation + 1,
          retryCount: 1,
          status: "loading",
          isExplicitRetry: true,
        };
      }

      return {
        ...state,
        retryKey: action.retryKey,
        sourceIsPresent: action.sourceIsPresent,
        status: action.sourceIsPresent ? state.status : "idle",
        isExplicitRetry: false,
      };
    }
    case "loadStart":
      return action.generation === state.generation && state.status !== "loaded"
        ? { ...state, status: "loading" }
        : state;
    case "display":
      return action.generation === state.generation
        ? { ...state, status: "loaded" }
        : state;
    case "error":
      return action.generation === state.generation
        ? { ...state, status: "error" }
        : state;
  }
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
  onDisplay,
  onError,
  onStatusChange,
  componentLabel = "image",
  style,
  testID = "himu-image",
  ...imageProps
}: HimuImageProps) {
  const sourceIsPresent = hasSource(source);
  const sourceKey = sourceIdentity(source);
  const [state, dispatch] = useReducer(reduceImageState, {
    sourceKey,
    retryKey,
    sourceIsPresent,
    generation: 0,
    retryCount: 0,
    status: sourceIsPresent ? "loading" : "idle",
    isExplicitRetry: false,
  });
  const lastRetriedGeneration = useRef<number | null>(null);
  const lastNotifiedState = useRef<string | null>(null);

  if (
    state.sourceKey !== sourceKey ||
    state.retryKey !== retryKey ||
    state.sourceIsPresent !== sourceIsPresent
  ) {
    dispatch({ type: "sync", sourceKey, retryKey, sourceIsPresent });
  }

  useEffect(() => {
    if (
      state.isExplicitRetry &&
      lastRetriedGeneration.current !== state.generation
    ) {
      lastRetriedGeneration.current = state.generation;
      onRetry?.();
    }
  }, [onRetry, state.generation, state.isExplicitRetry]);

  useEffect(() => {
    const notificationKey = `${state.generation}:${state.status}`;
    if (lastNotifiedState.current === notificationKey) return;

    lastNotifiedState.current = notificationKey;
    onStatusChange?.(state.status);
    if (state.status === "loaded") onDisplay?.();
    if (state.status === "error") onError?.();
  }, [onDisplay, onError, onStatusChange, state.generation, state.status]);

  const showImage = sourceIsPresent && state.status !== "error";
  const showFallback = !showImage || state.status !== "loaded";
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
          key={state.generation}
          source={source}
          recyclingKey={String(state.generation)}
          priority={eager ? "high" : "low"}
          style={[
            styles.image,
            state.status === "loaded" ? styles.visible : styles.hidden,
          ]}
          testID="himu-image-native"
          accessible={isInformative}
          accessibilityLabel={accessibilityLabel}
          alt={accessibilityLabel ?? ""}
          onLoadStart={() => {
            dispatch({ type: "loadStart", generation: state.generation });
          }}
          onDisplay={() =>
            dispatch({ type: "display", generation: state.generation })
          }
          onError={() => {
            if (__DEV__) {
              console.warn("[HimuImage] failed to display", {
                component: componentLabel,
                host: sourceHost(source),
              });
            }
            dispatch({ type: "error", generation: state.generation });
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
