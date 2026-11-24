import { settings, useHub } from "./storage";
import { selectReminders } from "../reminders/records";
import { pendingAlerts } from "../reminders/alerts";
import { router } from "expo-router";
let timer: ReturnType<typeof setTimeout> | undefined;
export async function configureAlerts() {}
export async function handleResponse(_response: unknown) {}
export async function reconcile() {
  clearTimeout(timer);
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  const rows = useHub.getState().rows;
  const alerts = pendingAlerts(
    selectReminders(rows),
    settings(rows).morning,
    new Date(),
  );
  const first = alerts[0];
  if (!first) return;
  const remaining = first.date - Date.now();
  if (remaining > 2147483647) {
    timer = setTimeout(() => void reconcile(), 2147483647);
    return;
  }
  timer = setTimeout(
    () => {
      for (const alert of alerts.filter((item) => item.date === first.date)) {
        const notification = new Notification(alert.title, { tag: alert.id });
        notification.onclick = () => {
          window.focus();
          router.push({
            pathname: "/edit",
            params: { series: alert.series, original: alert.original },
          });
          notification.close();
        };
      }
      void reconcile();
    },
    Math.max(0, remaining),
  );
}
export async function requestAlerts() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  )
    await Notification.requestPermission();
  await reconcile();
}
