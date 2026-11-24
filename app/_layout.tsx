import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MotionProvider, useQuietMotion } from "../src/hub/motion";
import { LoadingHome } from "../src/hub/loading";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { AppState, Platform, View, Text } from "react-native";
import * as N from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { initialize, onDataChange, useHub } from "../src/hub/storage";
import {
  configureAlerts,
  handleResponse,
  reconcile,
} from "../src/hub/module-notifications";
import {
  Page,
  Panel,
  Label,
  Btn,
  useColors,
  run,
  showError,
} from "../src/hub/ui";
function boot() {
  return initialize().catch((e) => useHub.setState({ error: String(e) }));
}
export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MotionProvider>
        <HubNavigation />
      </MotionProvider>
    </GestureHandlerRootView>
  );
}
function HubNavigation() {
  const quiet = useQuietMotion();
  const { ready, error } = useHub(),
    c = useColors();
  useEffect(() => {
    void boot();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const sync = () => run(reconcile);
    onDataChange(sync);
    const foreground = () => run(async () => {
      await configureAlerts();
      await reconcile();
    });
    foreground();
    if (Platform.OS === "web") {
      window.addEventListener("focus", foreground);
      return () => {
        window.removeEventListener("focus", foreground);
        onDataChange(() => {});
      };
    }
    const handled = new Set<string>();
    async function response(r: N.NotificationResponse) {
      const key =
        r.notification.request.identifier +
        "/" +
        r.actionIdentifier +
        "/" +
        r.notification.date;
      if (handled.has(key)) return;
      handled.add(key);
      try {
        await handleResponse(r);
        N.clearLastNotificationResponse();
      } catch (e) {
        handled.delete(key);
        showError(e);
      }
    }
    const listener = N.addNotificationResponseReceivedListener(
      (r) => void response(r),
    );
    run(async () => {
      const last = N.getLastNotificationResponse();
      if (last) await response(last);
    });
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") foreground();
    });
    return () => {
      listener.remove();
      app.remove();
      onDataChange(() => {});
    };
  }, [ready]);
  if (!ready && !error) return <LoadingHome />;
  if (!ready)
    return (
      <Page narrow title="Open workspace">
        <Panel title="Your workspace couldn’t open">
          <Label small>{error}</Label>
          <Btn primary title="Retry" onPress={boot} />
        </Panel>
      </Page>
    );
  return (
    <>
      <StatusBar style={c.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: quiet ? "none" : "default",
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.fg,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reminders" options={{ title: "Calendar" }} />
        <Stack.Screen name="wellbeing" options={{ title: "Digital Wellbeing" }} />
        <Stack.Screen
          name="edit"
          options={{
            headerShown: false,
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [1],
            gestureEnabled: true,
          }}
        />
      </Stack>
    </>
  );
}
