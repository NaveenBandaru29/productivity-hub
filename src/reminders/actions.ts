import { randomUUID } from "expo-crypto";
import { Details, Rule, Item, emptyEvent, shiftDay } from "./model";
import { useHub, write } from "../hub/storage";
import { seriesRow, eventRow, selectReminders } from "./records";
import type { Row } from "../hub/backup";

export function toggle(item: Item) {
  return write([
    eventRow({
      ...(item.event ?? emptyEvent(item.series.id, item.original)),
      completed: item.event?.completed ? null : Date.now(),
      snooze: null,
    }),
  ]);
}
export async function saveReminder(
  details: Details,
  rule: Rule,
  item?: Item,
  scope: "one" | "future" = "one",
  extra: Row[] = [],
) {
  if (!item)
    return write([
      ...extra,
      seriesRow({ id: randomUUID(), details, rule, end: null }),
    ]);
  const s = item.series;
  if (s.rule.kind === "once") {
    const rows = [...extra, seriesRow({ ...s, details, rule })];
    if (item.event) {
      if (details.date !== item.original)
        rows.push({ ...eventRow(item.event), deleted: true });
      rows.push(
        eventRow({
          ...item.event,
          original: details.date,
          edit: null,
          snooze: null,
        }),
      );
    }
    return write(rows);
  }
  if (scope === "one")
    return write([
      ...extra,
      eventRow({
        ...(item.event ?? emptyEvent(s.id, item.original)),
        edit: details,
        snooze: null,
      }),
    ]);
  const id = randomUUID();
  const rows: Row[] = [
    ...extra,
    seriesRow({ ...s, end: shiftDay(item.original, -1) }),
    seriesRow({ id, details, rule, end: s.end }),
  ];
  // Completed future exceptions survive the split as independent historical records.
  for (const e of selectReminders(useHub.getState().rows).events.values())
    if (e.series === s.id && e.original >= item.original && e.completed) {
      const historicalId = randomUUID(),
        snapshot = e.edit ?? { ...s.details, date: e.original };
      rows.push(
        seriesRow({
          id: historicalId,
          details: snapshot,
          rule: { kind: "once" },
          end: null,
        }),
        eventRow({
          ...e,
          series: historicalId,
          original: snapshot.date,
          edit: null,
        }),
      );
    }
  return write(rows);
}
export function remove(item: Item, scope: "one" | "future") {
  if (item.series.rule.kind === "once")
    return write([seriesRow(item.series, true)]);
  if (scope === "future")
    return write([
      seriesRow({ ...item.series, end: shiftDay(item.original, -1) }),
    ]);
  return write([
    eventRow({
      ...(item.event ?? emptyEvent(item.series.id, item.original)),
      removed: true,
      snooze: null,
    }),
  ]);
}
