import { mutateRows, useHub } from "../hub/storage";
import type { Row } from "../hub/backup";
import { requestWellbeingAlerts } from "./notification-access";

const defaults = { onboarded: false, warnings: false, sessionAlerts: false };
export function preferences(rows: Row[]) {
  const row = rows.find(r => r.kind === "wellbeing.preferences" && !r.deleted);
  return row?.kind === "wellbeing.preferences" ? row.value : defaults;
}
export function usePreferences() {
  return useHub(s => preferences(s.rows));
}
export function updatePreferences(change: Partial<typeof defaults>) {
  return mutateRows(rows => [{
    id: "settings", kind: "wellbeing.preferences", deleted: false, updated: 0,
    value: { ...preferences(rows), ...change },
  }]);
}
export async function enableWarnings() {
  if (!await requestWellbeingAlerts()) return false;
  await updatePreferences({warnings:true});
  return true;
}
