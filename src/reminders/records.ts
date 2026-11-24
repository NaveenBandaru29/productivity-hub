import type { Row } from "../hub/backup";
import {
  eventKey,
  type Series,
  type OccurrenceEvent,
  type Data,
} from "./model";

export function seriesRow(value: Series, deleted = false): Row {
  return { kind: "reminders.series", id: value.id, value, updated: 0, deleted };
}
export function eventRow(value: OccurrenceEvent): Row {
  return {
    kind: "reminders.event",
    id: eventKey(value.series, value.original),
    value,
    updated: 0,
    deleted: false,
  };
}
export function selectReminders(rows: readonly Row[]): Data {
  const series: Series[] = [];
  const events = new Map<string, OccurrenceEvent>();
  for (const row of rows) {
    if (row.deleted) continue;
    if (row.kind === "reminders.series") series.push(row.value);
    if (row.kind === "reminders.event") events.set(row.id, row.value);
  }
  return { series, events };
}
