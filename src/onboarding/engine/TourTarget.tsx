import React, { useCallback, useContext, useEffect, useRef } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import type { TourTargetId } from "../types";
import { TourTargetRegistryContext } from "./SpotlightTourEngine";

export type TourTargetProps = {
  id: TourTargetId;
  children: React.ReactNode;
  borderRadius?: number;
  testID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function TourTarget({
  id,
  children,
  borderRadius = 0,
  testID,
  onLayout,
}: TourTargetProps): React.ReactElement {
  const registry = useContext(TourTargetRegistryContext);
  const ref = useRef<View>(null);

  useEffect(() => registry?.register(id), [id, registry]);

  const measureInWindow = useCallback(() => {
    const generation = registry?.measurementGeneration;
    if (!registry?.measurementsEnabled || generation === undefined) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      registry.updateMeasurement(
        id,
        { x, y, width, height },
        borderRadius,
        generation,
      );
    });
  }, [borderRadius, id, registry]);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      onLayout?.(_event);
      if (registry?.measurementsEnabled) measureInWindow();
    },
    [measureInWindow, onLayout, registry?.measurementsEnabled],
  );

  useEffect(() => {
    if (registry?.measurementsEnabled) measureInWindow();
  }, [
    measureInWindow,
    registry?.measurementGeneration,
    registry?.measurementsEnabled,
    registry?.remeasureKey,
  ]);

  return (
    <View collapsable={false} onLayout={handleLayout} ref={ref} testID={testID}>
      {children}
    </View>
  );
}
