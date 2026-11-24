import React, { useEffect } from "react";
import { formatDate } from "../hub/format-date";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Panel, Label, useColors } from "../hub/ui";
import { useQuietMotion } from "../hub/motion";
import { localDay } from "./model";
function Bar({ fraction, color }: { fraction: number; color: string }) {
  const quiet = useQuietMotion(),
    value = useSharedValue(quiet ? fraction : 0);
  useEffect(() => {
    value.value = quiet ? fraction : withTiming(fraction, { duration: 280 });
  }, [fraction, quiet, value]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: value.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          height: "100%",
          width: "100%",
          backgroundColor: color,
          transformOrigin: "bottom",
          borderRadius: 6,
        },
        style,
      ]}
    />
  );
}
export function WeekChart({
  days,
  total,
}: {
  days: { date: string; count: number }[];
  total: number;
}) {
  const c = useColors(),
    max = Math.max(1, ...days.map((d) => d.count)),
    sum = days.reduce((n, d) => n + d.count, 0);
  return (
    <Panel title="Reminder completions">
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text
          style={{
            fontSize: 46,
            letterSpacing: -2,
            fontWeight: "600",
            color: c.fg,
          }}
        >
          {sum}
        </Text>
        <Label small>in the last 7 days</Label>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {days.map((d, i) => (
          <View
            accessible
            accessibilityLabel={
              formatDate(d.date) + ", " + d.count + " completed"
            }
            key={d.date}
            style={{ flex: 1, alignItems: "center", gap: 6 }}
          >
            <Label small>{d.count}</Label>
            <View
              style={{
                height: 96,
                width: "60%",
                maxWidth: 40,
                backgroundColor: c.wash,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <Bar fraction={d.count / max} color={c.accent} />
            </View>
            <Label small>
              {localDay(d.date).toLocaleDateString(undefined, {
                weekday: "narrow",
              })}
            </Label>
          </View>
        ))}
      </View>
      <Label small>{total} completed overall</Label>
    </Panel>
  );
}
