import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { focusAlertPrefix, type FocusAlert } from "./focus-alert-plan";

export async function updateFocusAlerts(pending: FocusAlert[]) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const existing = all.filter((n) => n.identifier.startsWith(focusAlertPrefix));
  const capacity =
    Platform.OS === "ios"
      ? Math.max(0, Math.min(4, 64 - (all.length - existing.length)))
      : 60;
  const wanted =
    pending.length && (await Notifications.getPermissionsAsync()).granted
      ? pending.slice(0, capacity)
      : [];
  const keep = new Set<string>();
  for (const request of existing) {
    const match = wanted.find((a) => a.id === request.identifier);
    if (
      match &&
      match.at === request.content.data?.at &&
      match.name === request.content.title
    )
      keep.add(match.id);
    else
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  for (const alert of wanted) {
    if (keep.has(alert.id) || alert.at <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: alert.id,
      content: {
        title: alert.name,
        data: { module: "wellbeing", section: "focus", at: alert.at },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alert.at),
        channelId: "wellbeing",
      },
    });
  }
}
