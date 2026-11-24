import React, { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Rect, Svg as Viewport } from "react-native-svg";
import type { Setting } from "./backup";
import { contrast, surfaceColors } from "./accent";
import { Icon } from "./icons";
import { Reveal, Touch } from "./motion";
import { setSetting } from "./storage";
import { Btn, Field, Panel, Row, run, useColors } from "./ui";

type Appearance = Extract<Setting, { key: "appearance" }>;
const themes = { light: "Light", dark: "Dark", system: "System" } as const;
const swatches = [
  ["Forest", "#316C56"],
  ["Blue", "#31649B"],
  ["Indigo", "#5856D6"],
  ["Plum", "#85496A"],
  ["Terracotta", "#B75234"],
  ["Gold", "#E9B942"],
] as const;

function MiniScreen({ dark, accent }: { dark: boolean; accent: string }) {
  const c = surfaceColors(accent, dark);
  return (
    <>
      <Rect
        width="78"
        height="86"
        rx="8"
        fill={c.surface}
        stroke={c.border}
        strokeWidth="2"
      />
      <Rect x="30" y="4" width="18" height="3" rx="1.5" fill={c.border} />
      <Rect x="9" y="15" width="29" height="4" rx="2" fill={c.fg} />
      <Rect
        x="9"
        y="24"
        width="60"
        height="21"
        rx="4"
        fill={accent}
        opacity=".23"
      />
      <Circle cx="20" cy="34" r="5" fill={accent} />
      <Rect x="30" y="32" width="27" height="3" rx="1.5" fill={c.fg} />
      {[53, 64, 75].map((y) => (
        <React.Fragment key={y}>
          <Circle cx="12" cy={y} r="2.5" fill={accent} />
          <Rect
            x="20"
            y={y - 1.5}
            width={y === 64 ? 34 : 46}
            height="3"
            rx="1.5"
            fill={c.border}
          />
        </React.Fragment>
      ))}
    </>
  );
}

function ThemePreview({
  mode,
  accent,
}: {
  mode: Appearance["mode"];
  accent: string;
}) {
  return (
    <Svg accessible={false} width="100%" height={85} viewBox="-2 -2 82 89">
      <MiniScreen dark={mode === "dark"} accent={accent} />
      {mode === "system" && (
        <Viewport x={39} width={40} height={87} viewBox="39 0 40 87">
          <MiniScreen dark accent={accent} />
        </Viewport>
      )}
    </Svg>
  );
}

export function AppearancePanel({ appearance }: { appearance: Appearance }) {
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(appearance.accent);
  const current = appearance.accent.toUpperCase();
  const preset = swatches.find(([, hex]) => hex === current);
  function choose(accent: string) {
    return run(async () => {
      await setSetting({ ...appearance, accent });
      setEditing(false);
    });
  }
  return (
    <Panel title="Appearance">
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(Object.keys(themes) as Appearance["mode"][]).map((mode) => {
          const active = appearance.mode === mode;
          return (
            <Touch
              key={mode}
              accessibilityRole="radio"
              accessibilityLabel={themes[mode] + " theme"}
              accessibilityState={{ checked: active }}
              feedback
              onPress={() => run(() => setSetting({ ...appearance, mode }))}
              style={{
                flex: 1,
                minWidth: 0,
                alignItems: "center",
                paddingVertical: 11,
                gap: 8,
                borderWidth: 2,
                borderRadius: 15,
                backgroundColor: active ? c.wash : c.bg,
                borderColor: active ? c.accent : c.border,
              }}
            >
              <ThemePreview mode={mode} accent={current} />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                <Icon
                  name={mode}
                  color={active ? c.accent : c.muted}
                  size={15}
                />
                <Text
                  style={{ fontWeight: "600", color: active ? c.accent : c.fg }}
                >
                  {themes[mode]}
                </Text>
              </View>
            </Touch>
          );
        })}
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: c.border,
          paddingTop: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <Text style={{ color: c.fg, fontWeight: "600", fontSize: 17 }}>
          Accent color
        </Text>
        <Row>
          <Text style={{ color: c.muted }}>{preset?.[0] ?? current}</Text>
          <Touch
            accessibilityRole="button"
            accessibilityLabel="Custom accent color"
            accessibilityState={{ expanded: editing }}
            onPress={() => {
              setCustom(current);
              setEditing(!editing);
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: preset ? c.border : c.accent,
              backgroundColor: preset ? c.surface : current,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name="custom"
              size={18}
              color={preset ? c.muted : c.onAccent}
            />
          </Touch>
        </Row>
      </View>
      <Row>
        {swatches.map(([name, hex]) => {
          const active = current === hex;
          return (
            <Touch
              key={hex}
              accessibilityRole="radio"
              accessibilityLabel={name + " accent"}
              accessibilityState={{ checked: active }}
              feedback
              onPress={() => choose(hex)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: active ? c.accent : "transparent",
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  backgroundColor: hex,
                }}
              >
                {active && (
                  <Icon
                    name="check"
                    size={18}
                    color={
                      contrast(hex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#000000"
                    }
                  />
                )}
              </View>
            </Touch>
          );
        })}
      </Row>
      {editing && (
        <Reveal style={{ gap: 10 }}>
          <Field
            label="Custom accent (#RRGGBB)"
            value={custom}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            onChangeText={setCustom}
          />
          <Btn
            title="Apply color"
            icon="check"
            disabled={!/^#[a-f\d]{6}$/i.test(custom)}
            onPress={() => choose(custom.toUpperCase())}
          />
        </Reveal>
      )}
    </Panel>
  );
}
