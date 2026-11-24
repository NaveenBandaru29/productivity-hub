import { useEffect, useState, type ComponentProps } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import type { Tabs } from "expo-router";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "./icons";
import { Touch, useQuietMotion } from "./motion";
import { useColors } from "./theme";

export const routes = [
  ["index", "Home", "home"],
  ["apps", "Apps", "apps"],
  ["insights", "Insights", "insights"],
  ["settings", "Settings", "settings"],
] as const;

type BarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export function BottomNavigation({
  state,
  insets,
  emitter,
  navigateToTab,
}: BarProps) {
  const c = useColors();
  const quiet = useQuietMotion();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const position = useSharedValue(state.index);

  useEffect(() => {
    position.value = quiet
      ? state.index
      : withTiming(state.index, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
  }, [position, quiet, state.index]);

  const direction = I18nManager.isRTL ? -1 : 1;
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * position.value * slot }],
  }));

  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingLeft: insets.left + 12,
        paddingRight: insets.right + 12,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 5,
      }}
    >
      <View
        style={[
          styles.bar,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View
          accessibilityRole="tablist"
          style={styles.track}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {slot > 0 && (
            <Animated.View
              testID="bottom-tab-highlight"
              pointerEvents="none"
              accessible={false}
              style={[
                styles.highlight,
                { width: Math.max(0, slot - 4), backgroundColor: c.wash },
                slide,
              ]}
            />
          )}
          {state.routes.map((route, index) => {
            const entry = routes.find(([name]) => name === route.name);
            if (!entry) return null;
            const active = state.index === index;
            const color = active ? c.accent : c.muted;
            return (
              <Touch
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={entry[1]}
                accessibilityState={{ selected: active }}
                aria-selected={active}
                onPress={() => {
                  const event = emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!event.defaultPrevented && !active)
                    navigateToTab(route.key);
                }}
                onLongPress={() =>
                  emitter.emit({ type: "tabLongPress", target: route.key })
                }
                style={styles.tab}
              >
                <Icon name={entry[2]} size={21} color={color} />
                <Text
                  style={[
                    styles.label,
                    { color, fontWeight: active ? "700" : "500" },
                  ]}
                >
                  {entry[1]}
                </Text>
              </Touch>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 19,
    borderWidth: 1,
    padding: 4,
    maxWidth: 580,
    width: "100%",
    alignSelf: "center",
  },
  track: { flexDirection: "row" },
  highlight: {
    position: "absolute",
    start: 2,
    top: 0,
    bottom: 0,
    borderRadius: 14,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
    borderRadius: 14,
  },
  label: { fontSize: 12, textAlign: "center" },
});
