import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useReducedMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "./theme";

const MotionPreference = createContext(false);
const spring = {
  damping: 22,
  stiffness: 300,
  mass: 0.65,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};
export const enter = FadeInDown.withInitialValues({
  transform: [{ translateY: 6 }],
})
  .duration(180)
  .reduceMotion(ReduceMotion.System);
export const leave = FadeOut.duration(110).reduceMotion(ReduceMotion.System);
export const rearrange = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let current = true;
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        current = false;
        setReduced(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current) setReduced(value);
      })
      .catch(() => {});
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return (
    <MotionPreference.Provider value={reduced}>
      {children}
    </MotionPreference.Provider>
  );
}
export function useQuietMotion() {
  return useContext(MotionPreference);
}
export function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Touch({
  style,
  feedback = false,
  onPress,
  children,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  feedback?: boolean;
  children: React.ReactNode;
}) {
  const { accent } = useColors();
  const quiet = useQuietMotion(),
    pressed = useSharedValue(0),
    hovered = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: quiet ? 1 : 1 - pressed.value * 0.027 }],
    opacity: 1 - pressed.value * 0.13 - hovered.value * 0.07,
  }));
  return (
    <AnimatedPressable
      {...props}
      aria-checked={props["aria-checked"] ?? props.accessibilityState?.checked}
      aria-expanded={
        props["aria-expanded"] ?? props.accessibilityState?.expanded
      }
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      onHoverIn={() => {
        hovered.value = withTiming(1, { duration: 120 });
      }}
      onHoverOut={() => {
        hovered.value = withTiming(0, { duration: 120 });
      }}
      style={[
        style,
        animated,
        focused && {
          outlineWidth: 2,
          outlineStyle: "solid",
          outlineColor: accent,
          outlineOffset: 2,
        },
        props.disabled && { opacity: 0.45 },
      ]}
      onPressIn={() => {
        pressed.value = quiet ? 1 : withTiming(1, { duration: 75 });
      }}
      onPressOut={() => {
        pressed.value = quiet ? 0 : withSpring(0, spring);
      }}
      onPress={(event) => {
        if (feedback && !quiet) selectionFeedback();
        onPress?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
export function Reveal({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const quiet = useQuietMotion();
  return (
    <Animated.View
      entering={quiet ? undefined : enter}
      exiting={quiet ? undefined : leave}
      layout={quiet ? undefined : rearrange}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
