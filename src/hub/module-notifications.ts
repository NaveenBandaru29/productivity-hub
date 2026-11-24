import { router } from "expo-router";
import type { NotificationResponse } from "expo-notifications";
import * as reminders from "./notifications";
import { reconcileWellbeing } from "../wellbeing/reconcile";
import { refreshUsage } from "../wellbeing/usage-context";
import { useHub } from "./storage";

const services = {
  reminders: {
    configure: reminders.configureAlerts,
    reconcile: reminders.reconcile,
    respond: reminders.handleResponse,
  },
  wellbeing: {
    configure: async () => {
      if (useHub.getState().rows.some(row => row.kind.startsWith("wellbeing."))) await refreshUsage();
    },
    reconcile: reconcileWellbeing,
    respond: async (response: NotificationResponse) => {
      const section = response.notification.request.content.data?.section === "focus" ? "focus" : "limits";
      router.push({pathname: "/wellbeing", params: {section}});
    },
  },
};
export async function configureAlerts() {
  await Promise.all(Object.values(services).map(service => service.configure()));
}
export async function reconcile() {
  await Promise.all(Object.values(services).map(service => service.reconcile()));
}
export async function handleResponse(response: NotificationResponse) {
  const id = response.notification.request.content.data?.module;
  if (id === "reminders" || id === "wellbeing") await services[id].respond(response);
}
