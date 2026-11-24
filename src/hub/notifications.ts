import * as N from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { settings, useHub, write } from "./storage";
import { selectReminders, eventRow } from "../reminders/records";
import { emptyEvent, itemAt } from "../reminders/model";
import { pendingAlerts } from "../reminders/alerts";
const category = "reminders",
  channel = "reminders";
N.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function configureAlerts() {
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync(channel, {
      name: "Reminders",
      importance: N.AndroidImportance.HIGH,
    });
  await N.setNotificationCategoryAsync(category, [
    {
      identifier: "complete",
      buttonTitle: "Complete",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "snooze",
      buttonTitle: "Snooze…",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "open",
      buttonTitle: "Open",
      options: { opensAppToForeground: true },
    },
  ]);
}
export async function requestAlerts() {
  await configureAlerts();
  const current = await N.getPermissionsAsync();
  const permission =
    !current.granted && current.canAskAgain
      ? await N.requestPermissionsAsync()
      : current;
  if (!permission.granted)
    Alert.alert("Reminder saved", "Turn on notifications to get an alert.", [
      { text: "Later" },
      { text: "Open settings", onPress: () => void Linking.openSettings() },
    ]);
  await reconcile();
}
let queue = Promise.resolve();
export function reconcile() {
  const work = queue.then(async () => {
    const rows = useHub.getState().rows;
    const permitted = (await N.getPermissionsAsync()).granted;
    const wanted = permitted
      ? pendingAlerts(selectReminders(rows), settings(rows).morning, new Date())
      : [];
    const active = await N.getAllScheduledNotificationsAsync();
    const keep = new Set<string>();
    for (const n of active) {
      if (!n.identifier.startsWith("reminders/")) continue;
      const p = wanted.find((x) => x.id === n.identifier);
      if (p && n.content.data?.at === p.date && n.content.title === p.title) {
        keep.add(p.id);
        continue;
      }
      await N.cancelScheduledNotificationAsync(n.identifier);
    }
    for (const p of wanted)
      if (!keep.has(p.id))
        await N.scheduleNotificationAsync({
          identifier: p.id,
          content: {
            title: p.title,
            sound: "default",
            categoryIdentifier: category,
            data: {
              module: category,
              series: p.series,
              original: p.original,
              at: p.date,
            },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: new Date(p.date),
            channelId: channel,
          },
        });
  });
  queue = work.catch(() => {});
  return work;
}
export async function handleResponse(response: N.NotificationResponse) {
  const payload = response.notification.request.content.data;
  if (
    payload?.module !== category ||
    typeof payload.series !== "string" ||
    typeof payload.original !== "string"
  )
    return;
  const d = selectReminders(useHub.getState().rows),
    s = d.series.find((x) => x.id === payload.series);
  const item = s && itemAt(s, payload.original, d.events);
  if (!item) return;
  if (response.actionIdentifier === "complete")
    await write([
      eventRow({
        ...(item.event ?? emptyEvent(s!.id, item.original)),
        completed: item.event?.completed ?? Date.now(),
        snooze: null,
      }),
    ]);
  else
    router.push({
      pathname: "/edit",
      params: {
        series: item.series.id,
        original: item.original,
        ...(response.actionIdentifier === "snooze" ? { action: "snooze" } : {}),
      },
    });
}
