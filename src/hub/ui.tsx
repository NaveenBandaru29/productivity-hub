import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  RefreshControl,
  ScrollView,
  TextInput,
  Alert,
  AppState,
  TextInputProps,
  Platform,
  useWindowDimensions,
} from "react-native";
import { layout } from "./design";
import { Icon, type IconName } from "./icons";
import { Touch } from "./motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "./theme";
export { useColors } from "./theme";
export function useNow() {
  const [now, set] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => set(new Date()), 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") set(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}
export function run(fn: () => unknown) {
  try {
    Promise.resolve(fn()).catch(showError);
  } catch (e) {
    showError(e);
  }
}
export function showError(e: unknown) {
  if (Platform.OS === "web") {
    window.alert(e instanceof Error ? e.message : String(e));
    return;
  }
  Alert.alert(
    "Something needs attention",
    e instanceof Error ? e.message : String(e),
  );
}
export function Label({
  children,
  small = false,
  bold = false,
}: {
  children: React.ReactNode;
  small?: boolean;
  bold?: boolean;
}) {
  const c = useColors();
  return (
    <Text
      style={{
        color: small ? c.muted : c.fg,
        fontSize: small ? 14 : 17,
        fontWeight: bold ? "700" : "400",
        lineHeight: small ? 21 : 25,
      }}
    >
      {children}
    </Text>
  );
}
export function Page({
  title,
  headerAction,
  children,
  footer,
  narrow = false,
  onRefresh,
}: {
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  narrow?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (e) {
      showError(e);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <ScrollView
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: narrow ? layout.formWidth : layout.maxWidth,
          paddingHorizontal:
            width >= layout.tablet ? layout.wideGutter : layout.gutter,
          paddingTop: width >= layout.tablet ? 36 : 20,
          gap: 18,
          paddingBottom: 100,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flexShrink: 1,
              color: c.fg,
              fontSize: width >= layout.tablet ? 48 : 38,
              fontWeight: "700",
              letterSpacing: -1.8,
            }}
          >
            {title}
          </Text>
          {headerAction}
        </View>
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}
export function Btn({
  title,
  onPress,
  primary = false,
  hint,
  icon,
  iconOnly = false,
  selected = false,
  disabled = false,
}: {
  title: string;
  onPress: () => unknown;
  primary?: boolean;
  hint?: string;
  icon?: IconName;
  iconOnly?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={hint ?? title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => run(onPress)}
      style={{
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 7,
        minWidth: 44,
        paddingHorizontal: iconOnly ? 8 : 14,
        paddingVertical: 8,
        borderRadius: layout.controlRadius,
        borderWidth: 1,
        borderColor: primary ? c.accentFill : selected ? c.accent : c.border,
        backgroundColor: primary ? c.accentFill : selected ? c.wash : c.surface,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={19}
          color={primary ? c.onAccent : selected ? c.accent : c.fg}
          filled={icon === "star" && selected}
        />
      )}
      {!iconOnly && (
        <Text
          style={{
            color: primary ? c.onAccent : selected ? c.accent : c.fg,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
      )}
    </Touch>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColors();
  const [focused, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Label small>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={{
          color: c.fg,
          backgroundColor: c.surface,
          borderColor: focused ? c.accent : c.border,
          borderWidth: 1.5,
          borderRadius: 10,
          minHeight: 50,
          padding: 10,
          fontSize: 17,
        }}
      />
    </View>
  );
}
export function Add({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Touch
      accessibilityRole="button"
      feedback
      accessibilityLabel="Add reminder"
      onPress={onPress}
      style={{
        position: "absolute",
        bottom: 18,
        right: 20,
        paddingHorizontal: 20,
        minHeight: 52,
        flexDirection: "row",
        gap: 8,
        borderRadius: 28,
        backgroundColor: c.accentFill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="plus" color={c.onAccent} />
      <Text style={{ fontWeight: "700", color: c.onAccent }}>Add reminder</Text>
    </Touch>
  );
}
export function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: layout.radius,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        gap: 14,
      }}
    >
      {title && (
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 21,
            letterSpacing: -0.55,
            fontWeight: "600",
            color: c.fg,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
