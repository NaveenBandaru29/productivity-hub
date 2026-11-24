import { Touch, useQuietMotion } from "../../src/hub/motion";
import { Tabs } from "expo-router";
import { Text, View, useWindowDimensions } from "react-native";
import { Icon } from "../../src/hub/icons";
import { layout } from "../../src/hub/design";
import { useColors } from "../../src/hub/ui";
import { BottomNavigation, routes } from "../../src/hub/bottom-navigation";
export default function Layout() {
  const quiet = useQuietMotion(),
    c = useColors(),
    wide = useWindowDimensions().width >= layout.rail;
  return (
    <Tabs
      tabBar={
        wide
          ? ({ state, emitter, navigateToTab }) => (
              <View
                style={{
                  width: 208,
                  backgroundColor: c.surface,
                  borderRightColor: c.border,
                  borderRightWidth: 1,
                  paddingHorizontal: 16,
                  paddingTop: 42,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 32,
                  }}
                >
                  <View
                    style={{
                      padding: 8,
                      backgroundColor: c.wash,
                      borderRadius: 12,
                    }}
                  >
                    <Icon name="calendar" color={c.accent} />
                  </View>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "700",
                      letterSpacing: -0.7,
                      color: c.fg,
                    }}
                  >
                    Productivity Hub
                  </Text>
                </View>
                {state.routes.map((route, index) => {
                  const entry = routes.find(([name]) => name === route.name);
                  if (!entry) return null;
                  const active = state.index === index;
                  return (
                    <Touch
                      key={route.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        const event = emitter.emit({
                          type: "tabPress",
                          target: route.key,
                          canPreventDefault: true,
                        });
                        if (!event.defaultPrevented && !active)
                          navigateToTab(route.key);
                      }}
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "center",
                        paddingHorizontal: 14,
                        minHeight: 48,
                        borderRadius: 12,
                        backgroundColor: active ? c.wash : c.surface,
                      }}
                    >
                      <Icon
                        name={entry[2]}
                        color={active ? c.accent : c.muted}
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: active ? "700" : "500",
                          color: active ? c.accent : c.muted,
                        }}
                      >
                        {entry[1]}
                      </Text>
                    </Touch>
                  );
                })}
              </View>
            )
          : (props) => <BottomNavigation {...props} />
      }
      screenOptions={{
        headerShown: false,
        animation: quiet ? "none" : "fade",
        tabBarPosition: wide ? "left" : "bottom",
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {routes.map(([name, title]) => (
        <Tabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </Tabs>
  );
}
