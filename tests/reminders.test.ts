import { quickAdd } from "../src/reminders/quick-add";
import test from "node:test";
import assert from "node:assert/strict";
import {
  Series,
  Details,
  Data,
  dayKey,
  shiftDay,
  emptyEvent,
  eventKey,
  matches,
  itemsOn,
  scheduledDays,
} from "../src/reminders/model";
import { pendingAlerts } from "../src/reminders/alerts";
import { backupSchema, encodeBackup } from "../src/hub/backup";
const id = "bae91a71-3cef-4ae8-83f5-f919355aca01";
const details: Details = {
  title: "Rent",
  date: "2024-01-01",
  time: "09:00",
  note: "",
  list: null,
  star: false,
};
const series: Series = {
  id,
  details,
  rule: { kind: "monthly", day: 31 },
  end: null,
};
function source(s = series): Data {
  return { series: [s], events: new Map() };
}
test("month dots follow scheduled dates, moved occurrences, list filters and deletions", () => {
  const data = source();
  const month = (list: string | null = null) => [...scheduledDays(data, "2024-04-01", 30, list)];
  assert.deepEqual(month(), ["2024-04-30"]);
  const moved = {
    ...emptyEvent(id, "2024-03-31"),
    edit: { ...details, date: "2024-04-30", list: "work" },
  };
  data.events.set(eventKey(id, moved.original), moved);
  assert.deepEqual(month(), ["2024-04-30"]);
  assert.deepEqual(month("work"), ["2024-04-30"]);
  data.events.set(eventKey(id, "2024-04-30"), { ...emptyEvent(id, "2024-04-30"), removed: true });
  moved.edit.date = "2024-04-07";
  assert.deepEqual(month(), ["2024-04-07"]);
  data.events.set(eventKey(id, moved.original), { ...moved, removed: true });
  assert.deepEqual(month(), []);
});
test("monthly recurrence clamps February and April without drifting", () => {
  for (const k of ["2024-02-29", "2024-04-30", "2024-05-31", "2025-02-28"])
    assert.ok(matches(series, k));
  assert.ok(!matches(series, "2024-05-30"));
});
test("weekly selected days honor the series start and end", () => {
  const s: Series = {
    ...series,
    rule: { kind: "weekly", days: [1, 3] },
    end: "2024-01-10",
  };
  assert.ok(matches(s, "2024-01-03"));
  assert.ok(!matches(s, "2024-01-04"));
  assert.ok(!matches(s, "2024-01-15"));
});
test("quick add recognizes Friday and previews date/time, preserves ambiguous text", () => {
  assert.deepEqual(
    quickAdd("Pay rent Friday at 9 AM", "2024-01-01", "2024-01-01"),
    { title: "Pay rent", date: "2024-01-05", time: "09:00" },
  );
  assert.deepEqual(quickAdd("See Sam sometime", "2024-01-05", "2024-01-01"), {
    title: "See Sam sometime",
    date: "2024-01-05",
  });
});
test("completed occurrence remains visible and older occurrences become missed", () => {
  const d = source({ ...series, rule: { kind: "daily" } });
  const now = new Date("2024-01-04T10:00");
  const yesterday = itemsOn(d, "2024-01-03", "2024-01-04", now);
  assert.equal(yesterday.length, 1);
  assert.equal(yesterday[0].missed, true);
  const key = eventKey(id, "2024-01-04");
  d.events.set(key, {
    ...emptyEvent(id, "2024-01-04"),
    completed: now.getTime(),
  });
  const today = itemsOn(d, "2024-01-04", "2024-01-04", now);
  assert.deepEqual(
    today.map((i) => i.key),
    [key],
  );
  assert.ok(today[0].event?.completed);
});
test("Home shows overdue then all-day then timed, independent of star", () => {
  const day = "2024-01-05",
    d = source({ ...series, rule: { kind: "once" } });
  for (const [index, time] of [null, "16:00", "08:00"].entries())
    d.series.push({
      ...series,
      id: "test" + index,
      rule: { kind: "once" },
      details: { ...details, date: day, time, star: time === "16:00" },
    });
  assert.deepEqual(
    itemsOn(d, day, day, new Date(day + "T12:00")).map((i) => i.details.time),
    ["09:00", null, "08:00", "16:00"],
  );
  assert.equal(itemsOn(d, "2024-01-06", day).length, 0);
});
test("an edited occurrence appears on its new day and the series keeps its schedule", () => {
  const d = source();
  const date = "2024-04-30";
  d.events.set(eventKey(id, date), {
    ...emptyEvent(id, date),
    edit: { ...details, date: "2024-05-02" },
  });
  const now = new Date("2024-04-28T09:00"),
    today = dayKey(now);
  assert.equal(itemsOn(d, date, today, now).length, 0);
  assert.equal(itemsOn(d, "2024-05-02", today, now).length, 1);
  assert.ok(matches(series, "2024-05-31"));
});
test("all-day alerts use local morning, weekly snooze only changes one occurrence", () => {
  const d = source({
    ...series,
    details: { ...details, time: null },
    rule: { kind: "weekly", days: [1] },
  });
  const now = new Date("2024-01-01T08:00"),
    original = dayKey(now);
  assert.equal(
    pendingAlerts(d, "09:00", now)[0].date,
    new Date(original + "T09:00").getTime(),
  );
  for (const minutes of [5, 10, 15]) {
    const at = now.getTime() + minutes * 60000;
    d.events.set(eventKey(id, original), {
      ...emptyEvent(id, original),
      snooze: at,
    });
    const plans = pendingAlerts(d, "09:00", now);
    assert.equal(plans[0].date, at);
    assert.equal(plans[1].original, shiftDay(original, 7));
    assert.deepEqual(plans, pendingAlerts(d, "09:00", now));
  }
  d.events.set(eventKey(id, original), {
    ...emptyEvent(id, original),
    completed: now.getTime(),
  });
  assert.equal(pendingAlerts(d, "09:00", now)[0].original, "2024-01-08");
});
test("backup round trip retains tombstones and rejects invalid or duplicate rows", () => {
  const row = {
    id,
    kind: "reminders.series" as const,
    updated: 123,
    deleted: true,
    value: series,
  };
  const b = backupSchema.parse(JSON.parse(encodeBackup([row])));
  assert.deepEqual(b.records, [row]);
  assert.equal(backupSchema.safeParse({ ...b, version: 3 }).success, false);
  assert.equal(
    backupSchema.safeParse({ ...b, records: [row, row] }).success,
    false,
  );
  assert.equal(
    backupSchema.safeParse({
      ...b,
      records: [
        {
          ...row,
          value: { ...series, details: { ...details, date: "2025-02-29" } },
        },
      ],
    }).success,
    false,
  );
});

test("the alert limit keeps the earliest occurrences across series, including moved reminders", () => {
  const today = "2024-01-01";
  const now = new Date(today + "T00:00");
  const daily = { ...series, rule: { kind: "daily" as const } };
  const moved = {
    ...series,
    id: "second-series",
    rule: { kind: "once" as const },
    details: { ...details, date: "2023-01-01" },
  };
  const reminders = source(daily);
  reminders.series.push(moved);
  const event = {
    ...emptyEvent(moved.id, moved.details.date),
    edit: { ...details, date: today, time: "08:00" },
  };
  reminders.events.set(eventKey(moved.id, event.original), event);
  const plans = pendingAlerts(reminders, "09:00", now);
  assert.equal(plans.length, 60);
  assert.equal(plans[0].series, moved.id);
  assert.equal(plans[59].original, shiftDay(today, 58));
  assert.equal(new Set(plans.map((plan) => plan.id)).size, 60);
});
