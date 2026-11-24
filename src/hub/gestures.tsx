import { Icon } from "./icons";
import React from "react";
import { Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useQuietMotion, selectionFeedback, rearrange } from "./motion";
import { calendarPageOffset } from "./gesture-decisions";

export function CalendarSwipe({
  children,
  onPage,
}: {
  children: React.ReactNode;
  onPage: (offset: number) => void;
}) {
  const offset = useSharedValue(0),
    quiet = useQuietMotion();
  const pan = usePanGesture({
    activeOffsetX: [-16, 16],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      "worklet";
      offset.value = quiet
        ? 0
        : Math.max(-26, Math.min(26, e.translationX * 0.22));
    },
    onDeactivate: (e) => {
      "worklet";
      const page = calendarPageOffset(e.translationX, e.velocityX, e.canceled);
      if (page) scheduleOnRN(onPage, page);
    },
    onFinalize: () => {
      "worklet";
      offset.value = withTiming(0, { duration: 140 });
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

export function DraggableWidget({
  children,
  label,
  color,
  background,
  onDrop,
  onMeasure,
}: {
  children: React.ReactNode;
  label: string;
  color: string;
  background: string;
  onDrop: (distance: number) => void;
  onMeasure: (y: number, height: number) => void;
}) {
  const offset = useSharedValue(0),
    held = useSharedValue(false),
    quiet = useQuietMotion();
  const pan = usePanGesture({
    activeOffsetY: [-5, 5],
    onActivate: () => {
      "worklet";
      held.value = true;
      if (!quiet) scheduleOnRN(selectionFeedback);
    },
    onUpdate: (e) => {
      "worklet";
      offset.value = e.translationY;
    },
    onDeactivate: (e) => {
      "worklet";
      if (!e.canceled) scheduleOnRN(onDrop, e.translationY);
    },
    onFinalize: () => {
      "worklet";
      offset.value = 0;
      held.value = false;
    },
  });
  const animated = useAnimatedStyle(() => ({
    zIndex: held.value ? 1 : 0,
    transform: [{ translateY: offset.value }],
  }));
  return (
    <Animated.View
      layout={quiet ? undefined : rearrange}
      onLayout={(e) =>
        onMeasure(e.nativeEvent.layout.y, e.nativeEvent.layout.height)
      }
      style={[{ gap: 8, backgroundColor: background }, animated]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color, fontSize: 17 }}>{label}</Text>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 48,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="grip" color={color} />
          </Animated.View>
        </GestureDetector>
      </View>
      {children}
    </Animated.View>
  );
}
