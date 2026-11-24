import React from "react";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  G,
  Line,
} from "react-native-svg";
import { View, Text, useWindowDimensions } from "react-native";
import { mixColor } from "./accent";
import { formatDate } from "./format-date";
import { clockTime, formatTime } from "./format-time";
import { useTimeFormat } from "./storage";
import { useColors } from "./ui";
import { Reveal } from "./motion";
export function DayCover({ now }: { now: Date }) {
  const { width, fontScale } = useWindowDimensions();
  const { accentFill } = useColors();
  const timeFormat = useTimeFormat();
  const sky = mixColor(accentFill, "#151515", 0.76);
  const horizon = mixColor(accentFill, "#202020", 0.64);
  const dial = mixColor(accentFill, "#FFFFFF", 0.83);
  const compact = width < 480 || fontScale > 1.4;
  const minute = now.getMinutes(),
    hour = now.getHours();
  return (
    <Reveal
      style={{
        backgroundColor: sky,
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <Svg
        pointerEvents="none"
        style={{ position: "absolute", width: "100%", height: "100%" }}
        viewBox="0 0 640 180"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="sky" x2="1" y2="1">
            <Stop offset="0" stopColor={sky} />
            <Stop offset="1" stopColor={horizon} />
          </LinearGradient>
        </Defs>
        <Rect width="640" height="180" fill="url(#sky)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Path
            key={i}
            d={`M180 ${230 + i * 10} C330 130 358 ${182 + i * 10} 430 ${113 + i * 10} S550 ${90 + i * 10} 660 ${15 + i * 10}`}
            stroke={dial}
            strokeOpacity={0.23}
            strokeWidth="1"
            fill="none"
          />
        ))}
      </Svg>
      <View
        style={{
          minHeight: 172,
          padding: compact ? 18 : 24,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: dial, fontWeight: "600", fontSize: 16 }}>
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: compact ? 30 : 42,
              fontWeight: "600",
              letterSpacing: -1.5,
            }}
          >
            {formatDate(now)}
          </Text>
          <Text
            style={{
              color: dial,
              fontSize: 15,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatTime(clockTime(hour, minute), timeFormat)}
          </Text>
        </View>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Svg
            width={compact ? 82 : 112}
            height={compact ? 82 : 112}
            viewBox="0 0 120 120"
          >
            <Circle cx="60" cy="60" r="56" fill={dial} />
            {Array.from({ length: 60 }, (_, i) => (
              <Line
                key={i}
                x1="60"
                x2="60"
                y1="9"
                y2={i % 5 === 0 ? "16" : "11"}
                rotation={i * 6}
                origin="60,60"
                stroke={i % 5 === 0 ? sky : horizon}
                strokeWidth={i % 5 === 0 ? 2 : 1}
              />
            ))}
            <G stroke={sky} strokeLinecap="round">
              <Line
                x1="60"
                y1="60"
                x2="60"
                y2="34"
                strokeWidth="5"
                rotation={hour * 30 + minute / 2}
                origin="60,60"
              />
              <Line
                x1="60"
                y1="60"
                x2="60"
                y2="22"
                strokeWidth="3"
                rotation={minute * 6}
                origin="60,60"
              />
            </G>
            <Circle cx="60" cy="60" r="4" fill={sky} />
          </Svg>
        </View>
      </View>
    </Reveal>
  );
}
