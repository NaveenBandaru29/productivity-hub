import { z } from "zod";

export function dayKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function localDay(key: string) {
  return new Date(key + "T12:00:00");
}
export function shiftDay(key: string, days: number) {
  const d = localDay(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => dayKey(localDay(v)) === v);
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const ruleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once") }),
  z.object({ kind: z.literal("daily") }),
  z.object({
    kind: z.literal("weekly"),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  z.object({
    kind: z.literal("monthly"),
    day: z.number().int().min(1).max(31),
  }),
]);
export const detailsSchema = z.object({
  title: z.string().trim().min(1),
  date: dateSchema,
  time: timeSchema.nullable(),
  note: z.string(),
  list: z.string().nullable(),
  star: z.boolean(),
});
export type Details = z.infer<typeof detailsSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export const seriesSchema = z.object({
  id: z.string().uuid(),
  details: detailsSchema,
  rule: ruleSchema,
  end: dateSchema.nullable(),
});
export type Series = z.infer<typeof seriesSchema>;
export const eventSchema = z.object({
  series: z.string().uuid(),
  original: dateSchema,
  edit: detailsSchema.nullable(),
  completed: z.number().int().positive().nullable(),
  snooze: z.number().int().positive().nullable(),
  removed: z.boolean(),
});
export type OccurrenceEvent = z.infer<typeof eventSchema>;
export interface Item {
  key: string;
  series: Series;
  original: string;
  details: Details;
  event?: OccurrenceEvent;
  missed: boolean;
}
export function matches(s: Series, key: string) {
  if (key < s.details.date || (s.end && key > s.end)) return false;
  const d = localDay(key);
  switch (s.rule.kind) {
    case "once":
      return key === s.details.date;
    case "daily":
      return true;
    case "weekly":
      return s.rule.days.includes(d.getDay());
    case "monthly":
      return (
        d.getDate() ===
        Math.min(
          s.rule.day,
          new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
        )
      );
  }
}
export function eventKey(id: string, original: string) {
  return id + "/" + original;
}
export function emptyEvent(series: string, original: string): OccurrenceEvent {
  return {
    series,
    original,
    edit: null,
    completed: null,
    snooze: null,
    removed: false,
  };
}
export interface Data {
  series: Series[];
  events: Map<string, OccurrenceEvent>;
}
// Overrides are keyed by original date, even when an occurrence moves to another day.
export function originalDatesBySeries(events: Data["events"]) {
  const index = new Map<string, string[]>();
  for (const event of events.values()) {
    const dates = index.get(event.series);
    if (dates) dates.push(event.original);
    else index.set(event.series, [event.original]);
  }
  return index;
}

export function itemAt(
  s: Series,
  date: string,
  events: Data["events"],
): Item | undefined {
  if (!matches(s, date)) return;
  const key = eventKey(s.id, date),
    event = events.get(key);
  if (event?.removed) return;
  return {
    key,
    series: s,
    original: date,
    event,
    details: event?.edit ?? { ...s.details, date },
    missed: false,
  };
}
/** Scheduled dates in the visible grid, including occurrences moved into it. */
export function scheduledDays(
  data: Data,
  start: string,
  count: number,
  list: string | null,
) {
  const visible = Array.from({ length: count }, (_, offset) =>
    shiftDay(start, offset),
  );
  const overrides = originalDatesBySeries(data.events);
  const days = new Set<string>();
  for (const series of data.series) {
    const originals = new Set([
      ...visible,
      ...(overrides.get(series.id) ?? []),
    ]);
    for (const original of originals) {
      const details = itemAt(series, original, data.events)?.details;
      if (
        details &&
        details.date >= start &&
        details.date <= visible[count - 1] &&
        (!list || details.list === list)
      )
        days.add(details.date);
    }
  }
  return days;
}

function compare(a: Item, b: Item) {
  return (
    a.details.date.localeCompare(b.details.date) ||
    (a.details.time ?? "").localeCompare(b.details.time ?? "") ||
    a.details.title.localeCompare(b.details.title)
  );
}
export function itemsOn(
  data: Data,
  date: string,
  today: string,
  now = new Date(),
  morning = "09:00",
) {
  const result: Item[] = [];
  const overrides = originalDatesBySeries(data.events);
  for (const s of data.series) {
    const dates = new Set([s.details.date, date]);
    // Monthly rules have at most 31 days between occurrences. Include the previous one until today's time arrives.
    let cursor = s.end && s.end < today ? s.end : today;
    for (
      let n = 0;
      s.rule.kind !== "once" && n < 63 && cursor >= s.details.date;
      n++, cursor = shiftDay(cursor, -1)
    )
      dates.add(cursor);
    for (const original of overrides.get(s.id) ?? []) dates.add(original);
    const candidates = [...dates]
      .map((k) => itemAt(s, k, data.events))
      .filter((v): v is Item => !!v);
    const due = candidates
      .filter(
        (i) =>
          new Date(
            i.details.date + "T" + (i.details.time ?? morning),
          ).getTime() <= now.getTime(),
      )
      .sort(compare);
    const latest = due.at(-1);
    for (const item of candidates) {
      item.missed =
        s.rule.kind !== "once" &&
        !item.event?.completed &&
        !!latest &&
        compare(item, latest) < 0;
      if (
        item.details.date === date ||
        (date === today &&
          item.details.date < today &&
          !item.event?.completed &&
          !item.missed &&
          (!s.end || s.end >= today))
      )
        result.push(item);
    }
  }
  return result.sort(compare);
}
