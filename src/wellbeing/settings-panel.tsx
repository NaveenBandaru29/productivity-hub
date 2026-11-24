import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { Btn, Label, Panel, Row, run } from "../hub/ui";
import { mutateRows, useTimeFormat } from "../hub/storage";
import { formatDate } from "../hub/format-date";
import { clockTime, formatTime } from "../hub/format-time";
import { notificationAccess, requestWellbeingAlerts } from "./notification-access";
import { purgeFocusHistory } from "./focus-model";
import { updatePreferences, usePreferences } from "./preferences";
import { clearUsageHistory, openUsageSettings, setUsageEnabled } from "./usage";
import { refreshUsage, useWellbeingUsage } from "./usage-context";

export async function connectUsage() {
  await setUsageEnabled(true);
  if (!await openUsageSettings()) throw new Error("Open Android Settings, then Special app access and Usage access, and select Minimal Productivity Hub.");
  await refreshUsage();
}

export function SettingsPanel() {
  const {status, error} = useWellbeingUsage();
  const prefs = usePreferences();
  const format = useTimeFormat();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cleared, setCleared] = useState(false);
  const checkAlerts = useCallback(async () => setAllowed(await notificationAccess()), []);
  useEffect(() => {
    run(checkAlerts);
    const sub = AppState.addEventListener("change", state => { if (state === "active") run(checkAlerts); });
    return () => sub.remove();
  }, [checkAlerts]);
  const last = status?.lastRefresh ? new Date(status.lastRefresh) : null;
  async function toggle(key: "warnings" | "sessionAlerts") {
    if (!prefs[key]) {
      const granted = await requestWellbeingAlerts();
      setAllowed(granted);
      setDenied(!granted);
      if (!granted) return;
    }
    await updatePreferences({[key]: !prefs[key]});
  }
  async function clearHistory() {
    await refreshUsage();
    await clearUsageHistory();
    await mutateRows(rows => purgeFocusHistory(rows, Date.now()));
    await refreshUsage();
    setConfirmDelete(false);
    setCleared(true);
  }
  return <>
    <Panel title="Device access">
      <Label bold>{!status ? "Checking usage access…" : !status.supported ? "Voluntary focus available" :
        !status.granted ? "Usage permission needed" : status.locked ? "Device locked" :
        status.enabled ? "Local tracking is on" : "Local tracking is paused"}</Label>
      <Label small>{status?.supported ? "Android measures foreground activity. Limits and focus targets provide advisory feedback. Your apps stay accessible." :
        "Device usage reports require the native Android build. Focus sessions and goals are available here."}</Label>
      {!!status?.supported && <Row>
        <Btn title={status.granted ? "Usage Access settings" : "Grant Usage Access"} onPress={connectUsage}/>
        {status.granted && <Btn title={status.enabled ? "Pause tracking" : "Resume tracking"} onPress={async () => {
          await setUsageEnabled(!status.enabled); await refreshUsage();
        }}/>}
      </Row>}
      <Label small>Last refresh · {last ? formatDate(last) + " · " + formatTime(clockTime(last.getHours(), last.getMinutes()), format) : "No measurement yet"}</Label>
      {error && <Label small>{error}</Label>}
    </Panel>
    <Panel title="Notifications">
      <Label small>Permission · {allowed === null ? "Checking…" : allowed ? "Granted" : "Off"}</Label>
      {status?.supported && <Btn title={prefs.warnings ? "Limit warnings on" : "Limit warnings off"} icon="bell"
        selected={prefs.warnings} onPress={() => toggle("warnings")}/>}
      <Btn title={prefs.sessionAlerts ? "Focus alerts on" : "Focus alerts off"} icon="time"
        selected={prefs.sessionAlerts} onPress={() => toggle("sessionAlerts")}/>
      <Label small>{Platform.OS === "web" ? "Keep this tab open for browser alerts." :
        "Background checks are best effort. Battery restrictions can delay warnings."}</Label>
      {denied && <Label>Enable notifications in {Platform.OS === "web" ? "your browser’s site settings" : "device settings"} to receive alerts.</Label>}
      {denied && Platform.OS !== "web" && <Btn title="Open settings" onPress={() => Linking.openSettings()}/>}
    </Panel>
    <Panel title="Local history">
      <Label small>Android keeps 90 days of usage totals on this phone. Manual backups include goals and rules. Usage history, sessions and app selections stay on this device.</Label>
      {confirmDelete ? <>
        <Label>Delete measured usage and finished focus sessions from this device?</Label>
        <Row><Btn title="Cancel" onPress={() => setConfirmDelete(false)}/>
          <Btn title="Delete history" icon="delete" onPress={clearHistory}/></Row>
      </> : <Btn title="Clear wellbeing history" icon="delete" onPress={() => {setConfirmDelete(true); setCleared(false);}}/>}
      {cleared && <Label small>Local history cleared.</Label>}
    </Panel>
    <Btn title="Hub appearance, time format and backup" icon="settings" onPress={() => router.push("/settings")}/>
  </>;
}
