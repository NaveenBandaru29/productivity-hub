import type { FocusSession } from "./focus-model";

export const focusAlertPrefix = "wellbeing/focus/";
export type FocusAlert = { id: string; name: string; at: number };

export function pendingFocusAlerts(
  sessions: FocusSession[],
  now: number,
): FocusAlert[] {
  const alerts: FocusAlert[] = [];
  for (const session of sessions) {
    if (session.status !== "scheduled" && session.status !== "active") continue;
    const prefix = focusAlertPrefix + session.id;
    if (session.startAt > now)
      alerts.push({
        id: prefix + "/start",
        name: session.name + " starts now",
        at: session.startAt,
      });
    if (session.endAt > now)
      alerts.push({
        id: prefix + "/end",
        name: session.name + " complete",
        at: session.endAt,
      });
  }
  return alerts.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
