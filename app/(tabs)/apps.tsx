import { router } from "expo-router";
import { View, Text, useWindowDimensions } from "react-native";
import { modules } from "../../src/hub/registry";
import { Page, Label, run, useColors } from "../../src/hub/ui";
import { Reveal, Touch } from "../../src/hub/motion";
import { Icon } from "../../src/hub/icons";
import { setSetting, settings, useHub } from "../../src/hub/storage";
import type { AppsLayout } from "../../src/hub/backup";

const layouts = [
  { view: "cards", label: "Card view", caption: "Cards", icon: "cards" },
  { view: "grid", label: "App grid view", caption: "Grid", icon: "apps" },
] as const;

function LayoutSwitch({ selected }: { selected: AppsLayout }) {
  const c = useColors();
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 310;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 3,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      {layouts.map(({ view, label, caption, icon }) => {
        const active = view === selected;
        return (
          <Touch
            key={view}
            feedback
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            aria-pressed={active}
            onPress={() => run(() => setSetting({ key: "appsLayout", view }))}
            style={{
              minWidth: 44,
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: compact ? 8 : 12,
              gap: 6,
              borderRadius: 12,
              backgroundColor: active ? c.wash : c.surface,
            }}
          >
            <Icon name={icon} size={24} color={active ? c.accent : c.muted} />
            {/* {!compact && (
              <Text
                style={{
                  color: active ? c.accent : c.muted,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {caption}
              </Text>
            )} */}
          </Touch>
        );
      })}
    </View>
  );
}

export default function Apps() {
  const c = useColors();
  const view = useHub((s) => settings(s.rows).appsLayout);
  const grid = view === "grid";
  return (
    <Page title="Apps" headerAction={<LayoutSwitch selected={view} />}>
      <Reveal
        key={view}
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          rowGap: grid ? 20 : 16,
          columnGap: grid ? 0 : 16,
        }}
      >
        {modules.map((m) => (
          <Touch
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={m.name}
            onPress={() => router.push(m.entry)}
            style={
              grid
                ? {
                  flexBasis: "25%",
                  minWidth: 80,
                  maxWidth: 112,
                  alignItems: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 3,
                  gap: 8,
                }
                : {
                  backgroundColor: c.surface,
                  padding: 22,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: c.border,
                  flexGrow: 1,
                  flexBasis: 280,
                  maxWidth: 440,
                  gap: 18,
                }
            }
          >
            {grid ? (
              <>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.accentFill,
                  }}
                >
                  <Icon name={m.icon} color={c.onAccent} size={30} />
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    textAlign: "center",
                    color: c.fg,
                  }}
                >
                  {m.name}
                </Text>
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: c.wash,
                      padding: 14,
                      borderRadius: 18,
                    }}
                  >
                    <Icon name={m.icon} color={c.accent} size={30} />
                  </View>
                  <Icon name="arrow" color={c.muted} />
                </View>
                <View>
                  <Label small>{m.category}</Label>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "600",
                      letterSpacing: -1,
                      color: c.fg,
                    }}
                  >
                    {m.name}
                  </Text>
                </View>
              </>
            )}
          </Touch>
        ))}
      </Reveal>
    </Page>
  );
}
