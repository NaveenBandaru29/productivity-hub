import { z } from "zod";
import type { Row } from "../hub/backup";
import { dayKey, timeSchema } from "../reminders/model";

const timestamp = z.number().int().nonnegative().max(8640000000000000);
const id = z.string().min(1);
const minute = 60_000;
export const focusHistoryDays = 90;
export const focusDuration = z.number().int().min(1).max(1440);
const targetList = z
  .array(z.string().trim().min(1))
  .refine((v) => new Set(v).size === v.length);
const targetsSchema = z.object({ apps: targetList, categories: targetList });
export type FocusTargets = z.infer<typeof targetsSchema>;
export const timerOnly = (): FocusTargets => ({ apps: [], categories: [] });
export const hasTargets = (targets: FocusTargets) =>
  Boolean(targets.apps.length || targets.categories.length);

export const focusScheduleSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(120),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((v) => new Set(v).size === v.length),
    time: timeSchema,
    durationMinutes: focusDuration,
    requiresTargets: z.boolean(),
    startsAfter: timestamp,
  })
  .strict();
export const focusBindingSchema = z
  .object({ id, targets: targetsSchema, historyFrom: timestamp })
  .strict();
export const focusSessionSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(120),
    source: z.enum(["instant", "schedule"]),
    scheduleId: id.optional(),
    startAt: timestamp,
    endAt: timestamp,
    status: z.enum(["scheduled", "active", "completed", "interrupted"]),
    endedAt: timestamp.optional(),
    targets: targetsSchema,
  })
  .strict()
  .refine(
    (s) =>
      s.endAt > s.startAt &&
      s.endAt - s.startAt <= 1440 * minute &&
      (s.source === "schedule") === Boolean(s.scheduleId) &&
      (s.status === "completed"
        ? s.endedAt === s.endAt
        : s.status === "interrupted"
          ? s.endedAt !== undefined &&
            s.endedAt >= s.startAt &&
            s.endedAt < s.endAt
          : s.endedAt === undefined),
  );
export type FocusSchedule = z.infer<typeof focusScheduleSchema>;
export type FocusBinding = z.infer<typeof focusBindingSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;

export function focusSessionRow(value: FocusSession, deleted = false): Row {
  return {
    kind: "wellbeing.focusSession",
    id: value.id,
    value,
    updated: 0,
    deleted,
  };
}
export function focusScheduleRow(value: FocusSchedule, deleted = false): Row {
  return {
    kind: "wellbeing.focusSchedule",
    id: value.id,
    value,
    updated: 0,
    deleted,
  };
}
export function focusBindingRow(value: FocusBinding, deleted = false): Row {
  return {
    kind: "wellbeing.focusBinding",
    id: value.id,
    value,
    updated: 0,
    deleted,
  };
}

export function selectFocus(rows: readonly Row[]) {
  const schedules: FocusSchedule[] = [];
  const sessions: FocusSession[] = [];
  const bindings = new Map<string, FocusBinding>();
  for (const row of rows) {
    if (row.deleted) continue;
    if (row.kind === "wellbeing.focusSchedule") schedules.push(row.value);
    if (row.kind === "wellbeing.focusSession") sessions.push(row.value);
    if (row.kind === "wellbeing.focusBinding") bindings.set(row.id, row.value);
  }
  return { schedules, sessions, bindings };
}

export function completedFocusCount(
  rows: readonly Row[],
  since = 0,
  until = Infinity,
) {
  return selectFocus(rows).sessions.filter(
    (s) => s.status === "completed" && s.endAt >= since && s.endAt < until,
  ).length;
}

export function purgeFocusHistory(rows: readonly Row[], now: number): Row[] {
  const { schedules, sessions, bindings } = selectFocus(rows);
  return [
    ...sessions
      .filter((s) => s.endedAt !== undefined)
      .map((s) => focusSessionRow(s, true)),
    ...schedules.map((s) =>
      focusBindingRow({
        id: s.id,
        targets: bindings.get(s.id)?.targets ?? timerOnly(),
        historyFrom: now,
      }),
    ),
  ];
}

function stateAt(
  startAt: number,
  endAt: number,
  now: number,
): Pick<FocusSession, "status" | "endedAt"> {
  if (now >= endAt) return { status: "completed", endedAt: endAt };
  return { status: now >= startAt ? "active" : "scheduled" };
}

// Calendar stepping preserves local weekdays through clock and DST changes.
function occurrences(
  schedule: FocusSchedule,
  binding: FocusBinding,
  now: number,
): FocusSession[] {
  const earliest = Math.max(
    schedule.startsAfter,
    binding.historyFrom,
    now - focusHistoryDays * 86400000,
  );
  const cursor = new Date(earliest);
  cursor.setHours(12, 0, 0, 0);
  const last = new Date(Math.max(now, earliest));
  last.setDate(last.getDate() + 7);
  last.setHours(23, 59, 59, 999);
  const [hour, minutes] = schedule.time.split(":").map(Number);
  const result: FocusSession[] = [];
  for (; cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    if (!schedule.days.includes(cursor.getDay())) continue;
    const start = new Date(cursor);
    start.setHours(hour, minutes, 0, 0);
    const startAt = start.getTime();
    if (startAt < earliest) continue;
    const endAt = startAt + schedule.durationMinutes * minute;
    result.push({
      id: schedule.id + "/" + dayKey(cursor),
      name: schedule.name,
      source: "schedule",
      scheduleId: schedule.id,
      targets: binding.targets,
      startAt,
      endAt,
      ...stateAt(startAt, endAt, now),
    });
    if (startAt > now) break;
  }
  return result;
}

export function focusChanges(rows: readonly Row[], now: number): Row[] {
  const { schedules, sessions, bindings } = selectFocus(rows);
  const changes: Row[] = [];
  const cutoff = now - focusHistoryDays * 86400000;
  const expected = new Map<string, FocusSession>();
  for (const schedule of schedules) {
    let binding = bindings.get(schedule.id);
    if (!binding) {
      // Restored schedules begin their history on this device at activation.
      binding = { id: schedule.id, targets: timerOnly(), historyFrom: now };
      changes.push(focusBindingRow(binding));
    }
    if (schedule.requiresTargets && !hasTargets(binding.targets)) continue;
    for (const session of occurrences(schedule, binding, now))
      expected.set(session.id, session);
  }
  for (const stored of sessions) {
    const wanted = expected.get(stored.id);
    expected.delete(stored.id);
    if ((stored.endedAt ?? stored.endAt) < cutoff) {
      changes.push(focusSessionRow(stored, true));
      continue;
    }
    if (stored.status === "scheduled") {
      if (!wanted) changes.push(focusSessionRow(stored, true));
      else if (
        JSON.stringify(stored) !==
        JSON.stringify(focusSessionSchema.parse(wanted))
      )
        changes.push(focusSessionRow(wanted));
    } else if (stored.status === "active" && stored.endAt <= now) {
      changes.push(
        focusSessionRow({
          ...stored,
          status: "completed",
          endedAt: stored.endAt,
        }),
      );
    }
  }
  for (const session of expected.values())
    changes.push(focusSessionRow(session));
  return changes;
}

export function focusPolicy(rows: readonly Row[], now = Date.now()) {
  const { schedules, sessions, bindings } = selectFocus(rows);
  return {
    focusSessions: sessions
      .filter(
        (s) => s.status === "active" && s.endAt > now && hasTargets(s.targets),
      )
      .map((s) => ({
        id: s.id,
        startAt: s.startAt,
        endAt: s.endAt,
        ...s.targets,
      })),
    focusSchedules: schedules.flatMap((s) => {
      const b = bindings.get(s.id);
      if (!s.requiresTargets || !b || !hasTargets(b.targets)) return [];
      const [hour, mins] = s.time.split(":").map(Number);
      return [
        {
          id: s.id,
          days: s.days,
          startMinute: hour * 60 + mins,
          durationMinutes: s.durationMinutes,
          startsAfter: Math.max(s.startsAfter, b.historyFrom),
          ...b.targets,
        },
      ];
    }),
    suppressions: sessions
      .filter(
        (s) =>
          s.source === "schedule" &&
          s.status === "interrupted" &&
          s.endAt > now,
      )
      .map((s) => s.id),
  };
}
