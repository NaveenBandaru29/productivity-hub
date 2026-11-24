import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useQuietMotion } from "./motion";
import { useColors } from "./ui";

export function LoadingHome() {
  const c = useColors(),
    quiet = useQuietMotion(),
    opacity = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = quiet
      ? 0.6
      : withRepeat(withTiming(0.95, { duration: 950 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, quiet]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Opening your hub"
      style={{
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 80,
        backgroundColor: c.bg,
      }}
    >
      <Animated.View
        style={[
          { gap: 18, maxWidth: 940, width: "100%", alignSelf: "center" },
          style,
        ]}
      >
        {[38, 172, 76, 46].map((height, index) => (
          <View
            key={index}
            style={{
              height,
              width: index === 0 ? "38%" : "100%",
              borderRadius: index === 0 ? 10 : 22,
              backgroundColor: c.border,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
