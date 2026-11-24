import { router } from "expo-router";
import type { FocusAlert } from "./focus-alert-plan";

const timers = new Map<
  string,
  { alert: FocusAlert; handle: ReturnType<typeof setTimeout> }
>();

export async function updateFocusAlerts(pending: FocusAlert[]) {
  const wanted =
    typeof Notification !== "undefined" && Notification.permission === "granted"
      ? pending
      : [];
  for (const [id, item] of timers) {
    if (
      wanted.some(
        (a) =>
          a.id === id && a.at === item.alert.at && a.name === item.alert.name,
      )
    )
      continue;
    clearTimeout(item.handle);
    timers.delete(id);
  }
  for (const alert of wanted) {
    const remaining = alert.at - Date.now();
    if (timers.has(alert.id) || remaining < 0 || remaining > 2147483647)
      continue;
    const handle = setTimeout(() => {
      timers.delete(alert.id);
      if (Notification.permission !== "granted") return;
      const n = new Notification(alert.name, { tag: alert.id });
      n.onclick = () => {
        window.focus();
        router.push({ pathname: "/wellbeing", params: { section: "focus" } });
        n.close();
      };
    }, remaining);
    timers.set(alert.id, { alert, handle });
  }
}
