import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import type { SpotlightStep, TourTargetId } from "../types";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 8;
const SCREEN_MARGIN = 16;
const TRANSITION_DURATION = 200;
const HIDDEN_SCALE = 0.96;
const MASK_ID = "himu-tour-spotlight-mask";
const SPOTLIGHT_COLOR = "#bdc2ff";

export type TourTooltipRenderProps = {
  step: SpotlightStep;
  currentIndex: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
};

export type TourEngineProps = {
  active: boolean;
  ready: boolean;
  steps: readonly SpotlightStep[];
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onFinishSpotlights: () => void;
  renderTooltip: (props: TourTooltipRenderProps) => React.ReactNode;
  children: React.ReactNode;
};

type TargetMeasurement = LayoutRectangle & {
  borderRadius: number;
  generation: number;
};

type TargetRegistry = {
  measurementGeneration: number;
  measurementsEnabled: boolean;
  register: (id: TourTargetId) => () => void;
  updateMeasurement: (
    id: TourTargetId,
    layout: LayoutRectangle,
    borderRadius: number,
    generation: number,
  ) => void;
  remeasureKey: string;
};

export const TourTargetRegistryContext = createContext<TargetRegistry | null>(null);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function SpotlightTourEngine({
  active,
  ready,
  steps,
  currentIndex,
  onNext,
  onPrevious,
  onSkip,
  onFinishSpotlights,
  renderTooltip,
  children,
}: TourEngineProps): React.ReactElement {
  const { t } = useTranslation();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(HIDDEN_SCALE);
  const haloOpacity = useSharedValue(1);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusAnchorRef = useRef<View>(null);
  const hostRef = useRef<View>(null);
  const measurementsEnabled = active && ready;
  const stepEpochKey = `${currentIndex}:${steps[currentIndex]?.id ?? "none"}`;
  const viewportKey = `${windowWidth}:${windowHeight}:${stepEpochKey}`;
  const previousMeasurementEpoch = useRef({
    enabled: measurementsEnabled,
    viewportKey,
  });
  const measurementGenerationRef = useRef(measurementsEnabled ? 1 : 0);
  if (
    measurementsEnabled &&
    (!previousMeasurementEpoch.current.enabled ||
      previousMeasurementEpoch.current.viewportKey !== viewportKey)
  ) {
    measurementGenerationRef.current += 1;
  }
  previousMeasurementEpoch.current = {
    enabled: measurementsEnabled,
    viewportKey,
  };
  const measurementGeneration = measurementGenerationRef.current;
  const measurementStateRef = useRef({
    enabled: measurementsEnabled,
    generation: measurementGeneration,
  });
  measurementStateRef.current = {
    enabled: measurementsEnabled,
    generation: measurementGeneration,
  };
  const surfaceMountedRef = useRef(false);
  const [surfaceMounted, setSurfaceMounted] = useState(false);
  const [registeredTargets, setRegisteredTargets] = useState<ReadonlySet<TourTargetId>>(
    () => new Set(),
  );
  const [targetMeasurements, setTargetMeasurements] = useState<
    ReadonlyMap<TourTargetId, TargetMeasurement>
  >(() => new Map());
  const [tooltipMeasurement, setTooltipMeasurement] = useState<{
    height: number;
    key: string;
  } | null>(null);
  const [hostMeasurement, setHostMeasurement] = useState<TargetMeasurement | null>(
    null,
  );

  const setSurface = useCallback((mounted: boolean) => {
    surfaceMountedRef.current = mounted;
    setSurfaceMounted(mounted);
  }, []);

  const register = useCallback((id: TourTargetId) => {
    setRegisteredTargets((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });

    return () => {
      setRegisteredTargets((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setTargetMeasurements((current) => {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const updateMeasurement = useCallback(
    (
      id: TourTargetId,
      layout: LayoutRectangle,
      borderRadius: number,
      generation: number,
    ) => {
      if (
        !measurementStateRef.current.enabled ||
        generation !== measurementStateRef.current.generation ||
        layout.width <= 0 ||
        layout.height <= 0
      ) {
        return;
      }
      setTargetMeasurements((current) => {
        const measurement = {
          ...layout,
          borderRadius: Math.max(0, borderRadius),
          generation,
        };
        const previous = current.get(id);
        if (
          previous?.x === measurement.x &&
          previous.y === measurement.y &&
          previous.width === measurement.width &&
          previous.height === measurement.height &&
          previous.borderRadius === measurement.borderRadius &&
          previous.generation === measurement.generation
        ) {
          return current;
        }
        const next = new Map(current);
        next.set(id, measurement);
        return next;
      });
    },
    [],
  );

  const measureHost = useCallback(() => {
    const generation = measurementStateRef.current.generation;
    if (!measurementStateRef.current.enabled) return;
    hostRef.current?.measureInWindow((x, y, width, height) => {
      if (
        !measurementStateRef.current.enabled ||
        generation !== measurementStateRef.current.generation ||
        width <= 0 ||
        height <= 0
      ) {
        return;
      }
      setHostMeasurement((current) =>
        current?.x === x &&
        current.y === y &&
        current.width === width &&
        current.height === height &&
        current.generation === generation
          ? current
          : { x, y, width, height, borderRadius: 0, generation },
      );
    });
  }, []);

  useEffect(() => {
    if (measurementsEnabled) measureHost();
  }, [measureHost, measurementGeneration, measurementsEnabled, viewportKey]);

  const requestedTargets = useMemo(
    () => new Set(steps.map((step) => step.targetId)),
    [steps],
  );
  const everyTargetRegistered = [...requestedTargets].every((id) =>
    registeredTargets.has(id),
  );
  const everyTargetMeasured = [...requestedTargets].every((id) =>
    targetMeasurements.get(id)?.generation === measurementGeneration,
  );
  const hostReady = hostMeasurement?.generation === measurementGeneration;
  const validIndex = currentIndex >= 0 && currentIndex < steps.length;
  const step = validIndex ? steps[currentIndex] : undefined;
  const tooltipKey = step
    ? [
        measurementGeneration,
        currentIndex,
        steps.length,
        step.id,
        step.title,
        step.description,
        step.placement,
      ].join(":")
    : "inactive";
  const tooltipHeight =
    tooltipMeasurement?.key === tooltipKey ? tooltipMeasurement.height : 0;
  const screenWidth = hostReady ? hostMeasurement.width : windowWidth;
  const screenHeight = hostReady ? hostMeasurement.height : windowHeight;
  const hostX = hostReady ? hostMeasurement.x : 0;
  const hostY = hostReady ? hostMeasurement.y : 0;
  const safeInsetTop = Math.max(0, insets.top - hostY);
  const safeInsetLeft = Math.max(0, insets.left - hostX);
  const safeInsetRight = Math.max(
    0,
    insets.right - Math.max(0, windowWidth - hostX - screenWidth),
  );
  const safeInsetBottom = Math.max(
    0,
    insets.bottom - Math.max(0, windowHeight - hostY - screenHeight),
  );
  const safeTop = safeInsetTop + SCREEN_MARGIN;
  const safeBottom = screenHeight - safeInsetBottom - SCREEN_MARGIN;
  const maximumTooltipHeight = Math.max(44, safeBottom - safeTop);
  const tooltipReady = tooltipHeight > 0;
  const targetsReady =
    measurementsEnabled &&
    validIndex &&
    hostReady &&
    everyTargetRegistered &&
    everyTargetMeasured;
  const shouldShow = targetsReady && tooltipReady;
  const isPremeasuring = measurementsEnabled && validIndex && !shouldShow;
  const hasRenderableStep = step !== undefined;
  const shouldRetireForReadiness = !ready;

  useEffect(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }

    if (!hasRenderableStep) {
      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      setSurface(false);
      return;
    }

    if (shouldRetireForReadiness) {
      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      setSurface(false);
      return;
    }

    if (isPremeasuring) {
      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      setSurface(false);
      return;
    }

    if (shouldShow) {
      setSurface(true);
      if (reduceMotion) {
        opacity.value = 1;
        scale.value = 1;
      } else {
        opacity.value = withTiming(1, {
          duration: TRANSITION_DURATION,
          reduceMotion: ReduceMotion.System,
        });
        scale.value = withTiming(1, {
          duration: TRANSITION_DURATION,
          reduceMotion: ReduceMotion.System,
        });
      }
      return;
    }

    if (!surfaceMountedRef.current) return;
    if (reduceMotion) {
      opacity.value = 0;
      scale.value = HIDDEN_SCALE;
      setSurface(false);
      return;
    }

    opacity.value = withTiming(0, {
      duration: TRANSITION_DURATION,
      reduceMotion: ReduceMotion.System,
    });
    scale.value = withTiming(HIDDEN_SCALE, {
      duration: TRANSITION_DURATION,
      reduceMotion: ReduceMotion.System,
    });
    exitTimer.current = setTimeout(() => setSurface(false), TRANSITION_DURATION);

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [
    hasRenderableStep,
    isPremeasuring,
    opacity,
    reduceMotion,
    scale,
    setSurface,
    shouldRetireForReadiness,
    shouldShow,
  ]);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  const overlayAnimatedStyle = useAnimatedStyle(
    () => ({ opacity: opacity.value }),
    [surfaceMounted],
  );
  const tooltipAnimatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [surfaceMounted],
  );
  const haloAnimatedStyle = useAnimatedStyle(
    () => ({ opacity: haloOpacity.value }),
    [surfaceMounted],
  );
  const registry = useMemo<TargetRegistry>(
    () => ({
      measurementGeneration,
      measurementsEnabled,
      register,
      remeasureKey: viewportKey,
      updateMeasurement,
    }),
    [
      measurementGeneration,
      measurementsEnabled,
      register,
      updateMeasurement,
      viewportKey,
    ],
  );

  const target = step ? targetMeasurements.get(step.targetId) : undefined;
  const targetX = (target?.x ?? 0) - hostX;
  const targetY = (target?.y ?? 0) - hostY;
  const left = clamp(targetX - SPOTLIGHT_PADDING, 0, screenWidth);
  const top = clamp(targetY - SPOTLIGHT_PADDING, 0, screenHeight);
  const right = clamp(
    targetX + (target?.width ?? 0) + SPOTLIGHT_PADDING,
    0,
    screenWidth,
  );
  const bottom = clamp(
    targetY + (target?.height ?? 0) + SPOTLIGHT_PADDING,
    0,
    screenHeight,
  );
  const spotlight = {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    borderRadius: Math.min(
      target?.borderRadius ?? 0,
      Math.max(0, right - left) / 2,
      Math.max(0, bottom - top) / 2,
    ),
  };

  const belowTop = spotlight.y + spotlight.height + TOOLTIP_GAP;
  const aboveTop = spotlight.y - TOOLTIP_GAP - tooltipHeight;
  const fitsBelow = belowTop + tooltipHeight <= safeBottom;
  const fitsAbove = aboveTop >= safeTop;
  const preferredTop = step?.placement === "top" ? aboveTop : belowTop;
  const alternateTop = step?.placement === "top" ? belowTop : aboveTop;
  const preferredFits = step?.placement === "top" ? fitsAbove : fitsBelow;
  const alternateFits = step?.placement === "top" ? fitsBelow : fitsAbove;
  const candidateTop = preferredFits
    ? preferredTop
    : alternateFits
      ? alternateTop
      : preferredTop;
  const maximumTooltipTop = Math.max(
    safeTop,
    safeBottom - tooltipHeight,
  );
  const tooltipTop = clamp(candidateTop, safeTop, maximumTooltipTop);
  const description = step?.description.trim() ?? "";
  const descriptionSeparator = /[.!?]$/.test(description) ? "" : ".";
  const focusLabel = step
    ? t("onboarding.tooltip.accessibility.announcement", {
        title: step.title,
        description: `${description}${descriptionSeparator}`,
        step: currentIndex + 1,
        count: steps.length,
      })
    : "";
  const spotlightActionLabel = step
    ? `${step.title}. ${
        currentIndex === steps.length - 1
          ? t("onboarding.tooltip.accessibility.finish")
          : t("onboarding.tooltip.accessibility.next", {
              step: currentIndex + 2,
            })
      }`
    : "";

  const handleNext = useCallback(() => {
    if (currentIndex === steps.length - 1) {
      onFinishSpotlights();
      return;
    }
    onNext();
  }, [currentIndex, onFinishSpotlights, onNext, steps.length]);
  const handlePrevious = useCallback(() => onPrevious(), [onPrevious]);
  const handleSkip = useCallback(() => onSkip(), [onSkip]);
  const handleTooltipLayout = useCallback(
    (height: number) => {
      if (height > 0) {
        const constrainedHeight = Math.min(height, maximumTooltipHeight);
        setTooltipMeasurement((current) =>
          current?.height === constrainedHeight && current.key === tooltipKey
            ? current
            : { height: constrainedHeight, key: tooltipKey },
        );
      }
    },
    [maximumTooltipHeight, tooltipKey],
  );
  const activeSurface =
    hasRenderableStep && !shouldRetireForReadiness && surfaceMounted && !isPremeasuring;
  const hostMounted =
    hasRenderableStep && !shouldRetireForReadiness && (targetsReady || surfaceMounted);
  useEffect(() => {
    if (!activeSurface || reduceMotion) {
      cancelAnimation(haloOpacity);
      haloOpacity.value = 1;
      return;
    }
    haloOpacity.value = withRepeat(
      withTiming(0.45, {
        duration: 900,
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
    return () => cancelAnimation(haloOpacity);
  }, [activeSurface, haloOpacity, reduceMotion]);
  useEffect(() => {
    if (!activeSurface) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleSkip();
      return true;
    });
    return () => subscription.remove();
  }, [activeSurface, handleSkip]);
  useEffect(() => {
    if (activeSurface && shouldShow) {
      const node = findNodeHandle(focusAnchorRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [activeSurface, currentIndex, shouldShow, tooltipKey]);

  return (
    <TourTargetRegistryContext.Provider value={registry}>
      <View
        collapsable={false}
        onLayout={measureHost}
        ref={hostRef}
        style={styles.host}
        testID="tour-host"
      >
        <View
          accessibilityElementsHidden={activeSurface}
          importantForAccessibility={activeSurface ? "no-hide-descendants" : "auto"}
          style={styles.background}
          testID="tour-background"
        >
          {children}
        </View>
        {hostMounted && step ? (
          <Animated.View
            accessibilityElementsHidden={!activeSurface}
            accessibilityViewIsModal={activeSurface}
            importantForAccessibility={activeSurface ? "yes" : "no-hide-descendants"}
            pointerEvents={activeSurface ? "auto" : "none"}
            style={[
              styles.modal,
              overlayAnimatedStyle,
              isPremeasuring && styles.invisible,
            ]}
            testID="tour-overlay"
          >
            <Svg height={screenHeight} pointerEvents="none" width={screenWidth}>
              <Defs>
                <Mask id={MASK_ID}>
                  <Rect fill="white" height={screenHeight} width={screenWidth} x={0} y={0} />
                  <Rect
                    fill="black"
                    height={spotlight.height}
                    rx={spotlight.borderRadius}
                    ry={spotlight.borderRadius}
                    testID="tour-cutout"
                    width={spotlight.width}
                    x={spotlight.x}
                    y={spotlight.y}
                  />
                </Mask>
              </Defs>
              <Rect
                fill="rgba(0, 0, 0, 0.72)"
                height={screenHeight}
                mask={`url(#${MASK_ID})`}
                testID="tour-scrim"
                width={screenWidth}
                x={0}
                y={0}
              />
            </Svg>
            <Pressable
              accessibilityLabel={spotlightActionLabel}
              accessibilityRole="button"
              onPress={handleNext}
              style={[
                styles.spotlightAction,
                {
                  borderRadius: spotlight.borderRadius,
                  height: spotlight.height,
                  left: spotlight.x,
                  top: spotlight.y,
                  width: spotlight.width,
                },
              ]}
              testID="tour-spotlight-action"
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.spotlightHalo,
                  { borderRadius: spotlight.borderRadius },
                  haloAnimatedStyle,
                ]}
                testID="tour-spotlight-halo"
              />
            </Pressable>
            <View
              onLayout={(event) => handleTooltipLayout(event.nativeEvent.layout.height)}
              style={[
                styles.tooltip,
                {
                  left: safeInsetLeft + SCREEN_MARGIN,
                  right: safeInsetRight + SCREEN_MARGIN,
                  top: isPremeasuring ? safeTop : tooltipTop,
                  maxHeight: maximumTooltipHeight,
                },
                isPremeasuring && styles.invisible,
              ]}
              testID="tour-tooltip-container"
            >
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.tooltipScrollContent}
                showsVerticalScrollIndicator
                testID="tour-tooltip-scroll"
              >
                <Animated.View style={tooltipAnimatedStyle} testID="tour-tooltip-animated">
                  <View
                    accessibilityLabel={focusLabel}
                    accessible
                    focusable
                    ref={focusAnchorRef}
                    testID="tour-focus-anchor"
                  />
                  {renderTooltip({
                    step,
                    currentIndex,
                    total: steps.length,
                    onNext: handleNext,
                    onPrevious: handlePrevious,
                    onSkip: handleSkip,
                  })}
                </Animated.View>
              </ScrollView>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </TourTargetRegistryContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  modal: {
    ...StyleSheet.absoluteFillObject,
    elevation: 1000,
    zIndex: 1000,
  },
  tooltip: {
    position: "absolute",
    zIndex: 2,
  },
  spotlightAction: {
    position: "absolute",
    zIndex: 1,
  },
  spotlightHalo: {
    ...StyleSheet.absoluteFillObject,
    borderColor: SPOTLIGHT_COLOR,
    borderWidth: 2,
    boxShadow: "0 0 18px rgba(189, 194, 255, 0.85)",
  },
  tooltipScrollContent: {
    flexGrow: 1,
  },
  invisible: {
    opacity: 0,
  },
});
