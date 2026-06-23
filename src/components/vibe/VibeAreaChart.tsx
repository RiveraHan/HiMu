import { Text } from "@/src/components/Text";
import { DayPoint } from "@/src/utils/vibe-stats";
import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const HEIGHT = 160;
const PAD_T = 14;
const PAD_B = 10;

type Pt = { x: number; y: number };

type Props = {
  data: DayPoint[];
};

function buildPaths(values: number[], width: number) {
  const n = values.length;
  const max = Math.max(...values, 1);
  const innerH = HEIGHT - PAD_T - PAD_B;
  const stepX = n > 1 ? width / (n - 1) : width;

  const pts: Pt[] = values.map((v, i) => ({
    x: i * stepX,
    y: PAD_T + innerH * (1 - v / max),
  }));

  const line = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = pts[i - 1];
      return `C ${prev.x + stepX / 3},${prev.y} ${p.x - stepX / 3},${p.y} ${p.x},${p.y}`;
    })
    .join(" ");

  const area = `${line} L ${pts[n - 1].x},${HEIGHT} L ${pts[0].x},${HEIGHT} Z`;
  return { line, area, pts };
}

const EMPTY: { line: string; area: string; pts: Pt[] } = {
  line: "",
  area: "",
  pts: [],
};

export function VibeAreaChart({ data }: Props) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const { line, area, pts } =
    width > 0
      ? buildPaths(
          data.map((d) => d.minutes),
          width,
        )
      : EMPTY;

  const todayIndex = data.findIndex((d) => d.isToday);

  return (
    <View style={styles.wrap}>
      <View style={styles.chartRow}>
        {/* Y: High / Mid / Low */}
        <View style={styles.yAxis}>
          {["High", "Mid", "Low"].map((t) => (
            <Text
              key={t}
              variant="labelCaps"
              color="onSurfaceVariant"
              opacity={0.5}
            >
              {t}
            </Text>
          ))}
        </View>

        {/* Plot + labels */}
        <View style={styles.plot}>
          <View style={styles.canvas} onLayout={onLayout}>
            {width > 0 && (
              <Svg width={width} height={HEIGHT}>
                <Defs>
                  <LinearGradient id="vibeFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="0"
                      stopColor={theme.colors.primaryContainer}
                      stopOpacity={0.35}
                    />
                    <Stop
                      offset="1"
                      stopColor={theme.colors.primaryContainer}
                      stopOpacity={0}
                    />
                  </LinearGradient>
                </Defs>

                {/* Gridlines High / Mid / Low */}
                {[PAD_T, HEIGHT / 2, HEIGHT - PAD_B].map((y) => (
                  <Line
                    key={y}
                    x1={0}
                    x2={width}
                    y1={y}
                    y2={y}
                    stroke={theme.colors.outlineVariant}
                    strokeWidth={StyleSheet.hairlineWidth}
                    opacity={0.4}
                  />
                ))}
                <Path d={area} fill="url(#vibeFill)" />
                <Path
                  d={line}
                  fill="none"
                  stroke={theme.colors.primary}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {todayIndex >= 0 && pts[todayIndex] && (
                  <Circle
                    cx={pts[todayIndex].x}
                    cy={pts[todayIndex].y}
                    r={4}
                    fill={theme.colors.primary}
                  />
                )}
              </Svg>
            )}
          </View>

          <View style={styles.labels}>
            {data.map((d, i) => (
              <Text
                key={`${d.date}-${i}`}
                variant="labelCaps"
                color={d.isToday ? "primary" : "onSurfaceVariant"}
                opacity={d.isToday ? 1 : 0.6}
                numberOfLines={1}
                style={styles.dayLabel}
              >
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.spacing.stackXs,
  },
  chartRow: {
    flexDirection: "row",
    gap: theme.spacing.stackSm,
  },
  yAxis: {
    height: HEIGHT,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 2,
  },
  plot: {
    flex: 1,
  },
  canvas: {
    width: "100%",
    height: HEIGHT,
  },
  labels: { flexDirection: "row", marginTop: theme.spacing.stackXs },
  dayLabel: { flex: 1, textAlign: "center" },
}));
