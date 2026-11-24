import { randomUUID } from "expo-crypto";
import { mutateRows, useHub, write } from "../hub/storage";
import { run } from "../hub/ui";
import {
  focusBindingRow,
  focusChanges,
  focusScheduleRow,
  focusSessionRow,
  hasTargets,
  selectFocus,
  type FocusTargets,
  type FocusSchedule,
} from "./focus-model";
import { updateFocusAlerts } from "./focus-alerts";
import { pendingFocusAlerts } from "./focus-alert-plan";
import { preferences } from "./preferences";

export function startFocus(
  name: string,
  durationMinutes: number,
  targets: FocusTargets,
) {
  const startAt = Date.now();
  return write([
    focusSessionRow({
      id: randomUUID(),
      name,
      source: "instant",
      startAt,
      endAt: startAt + durationMinutes * 60000,
      status: "active",
      targets,
    }),
  ]);
}

export function stopFocus(id: string) {
  return mutateRows((rows) => {
    const now = Date.now();
    const session = selectFocus(rows).sessions.find((s) => s.id === id);
    if (!session || session.status !== "active") return [];
    const complete = now >= session.endAt;
    return [
      focusSessionRow({
        ...session,
        status: complete ? "completed" : "interrupted",
        endedAt: complete ? session.endAt : Math.max(now, session.startAt),
      }),
    ];
  });
}

export function saveFocusSchedule(
  draft: Pick<FocusSchedule, "days" | "time" | "name" | "durationMinutes">,
  targets: FocusTargets,
  existingId?: string,
) {
  const now = Date.now(),
    id = existingId ?? randomUUID();
  return write([
    focusScheduleRow({
      ...draft,
      id,
      requiresTargets: hasTargets(targets),
      startsAfter: now,
    }),
    focusBindingRow({ id, historyFrom: now, targets }),
  ]);
}

export function removeFocusSchedule(id: string) {
  return mutateRows((rows) => {
    const { schedules, bindings } = selectFocus(rows);
    const schedule = schedules.find((s) => s.id === id);
    const binding = bindings.get(id);
    if (!schedule) return [];
    return [
      focusScheduleRow(schedule, true),
      ...(binding ? [focusBindingRow(binding, true)] : []),
    ];
  });
}

let timer: ReturnType<typeof setTimeout> | undefined;
let queue = Promise.resolve();
export function reconcileFocus() {
  const work = queue.then(async () => {
    // Use the reconciliation instant for both state and its next transition.
    // A slow storage write can cross the boundary and require an immediate pass.
    let checkedAt = Date.now();
    await mutateRows((rows) => {
      checkedAt = Date.now();
      return focusChanges(rows, checkedAt);
    });
    const rows = useHub.getState().rows;
    const planned = pendingFocusAlerts(selectFocus(rows).sessions, checkedAt);
    clearTimeout(timer);
    const next = planned[0]?.at;
    if (next !== undefined)
      timer = setTimeout(
        () => run(reconcileFocus),
        Math.min(2147483647, Math.max(0, next - Date.now() + 50)),
      );
    await updateFocusAlerts(preferences(rows).sessionAlerts ? planned : []);
  });
  queue = work.catch(() => {});
  return work;
}
