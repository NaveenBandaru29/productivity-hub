import assert from "node:assert/strict";
import test from "node:test";
import { recordSchema, type Row } from "../src/hub/backup";
import {
  completedFocusCount,
  focusBindingRow,
  focusChanges,
  focusPolicy,
  focusScheduleRow,
  focusSessionRow,
  purgeFocusHistory,
  selectFocus,
  timerOnly,
  type FocusSchedule,
  type FocusSession,
} from "../src/wellbeing/focus-model";
import { pendingFocusAlerts } from "../src/wellbeing/focus-alert-plan";

const monday = new Date(2026, 10, 23, 8).getTime();
const hour = 3600000;
const schedule: FocusSchedule = {
  id: "reading",
  name: "Reading",
  days: [1, 2],
  time: "09:00",
  durationMinutes: 25,
  startsAfter: monday,
  requiresTargets: true,
};
const targets = { apps: ["reader"], categories: ["Social"] };
const local = [
  focusScheduleRow(schedule),
  focusBindingRow({ id: schedule.id, targets, historyFrom: monday }),
];
function merge(rows: Row[], changes: Row[]): Row[] {
  const map = new Map(rows.map((r) => [r.kind + r.id, r]));
  for (const row of changes)
    map.set(row.kind + row.id, recordSchema.parse(row));
  return [...map.values()];
}
function reconcile(rows: Row[], now: number) {
  return merge(rows, focusChanges(rows, now));
}

test("recurrences use local weekday/time and reconcile once across a restart", () => {
  const planned = reconcile(local, monday);
  const first = selectFocus(planned).sessions[0];
  assert.equal(first.status, "scheduled");
  assert.equal(first.startAt, monday + hour);
  assert.deepEqual(focusChanges(planned, monday), []);
  const running = reconcile(planned, monday + 1.2 * hour);
  assert.equal(
    selectFocus(running).sessions.find((s) => s.id === first.id)?.status,
    "active",
  );
  const wednesday = new Date(2026, 10, 25, 15).getTime();
  const afterRestart = reconcile(running, wednesday);
  assert.equal(completedFocusCount(afterRestart), 2);
  assert.deepEqual(focusChanges(afterRestart, wednesday), []);
  const next = selectFocus(afterRestart).sessions.find(
    (s) => s.status === "scheduled",
  );
  assert.equal(next?.startAt, new Date(2026, 10, 30, 9).getTime());
});

test("overlap retains the other session's targets when one is interrupted", () => {
  const current = reconcile(local, monday + 1.1 * hour);
  const recurring = selectFocus(current).sessions.find(
    (s) => s.status === "active",
  )!;
  const instant: FocusSession = {
    id: "instant",
    source: "instant",
    name: "Writing",
    targets: { apps: ["reader", "mail"], categories: [] },
    startAt: monday + hour,
    endAt: monday + 2 * hour,
    status: "active",
  };
  const both = merge(current, [focusSessionRow(instant)]);
  assert.equal(focusPolicy(both, monday + 1.1 * hour).focusSessions.length, 2);
  const stopped = merge(both, [
    focusSessionRow({
      ...recurring,
      status: "interrupted",
      endedAt: monday + 1.1 * hour,
    }),
  ]);
  const policy = focusPolicy(stopped, monday + 1.2 * hour);
  assert.deepEqual(
    policy.focusSessions.map((s) => s.apps),
    [["reader", "mail"]],
  );
  assert.deepEqual(policy.suppressions, [recurring.id]);
  assert.equal(completedFocusCount(reconcile(stopped, monday + 3 * hour)), 1);
});

test("restored device targets require selection; timer-only schedules activate without previous history", () => {
  const wednesday = new Date(2026, 10, 25).getTime();
  const missing = reconcile([focusScheduleRow(schedule)], wednesday);
  assert.deepEqual(selectFocus(missing).sessions, []);
  assert.deepEqual(focusPolicy(missing, wednesday).focusSchedules, []);
  const portable = reconcile(
    [focusScheduleRow({ ...schedule, requiresTargets: false })],
    wednesday,
  );
  assert.deepEqual(
    selectFocus(portable).sessions.map((s) => s.status),
    ["scheduled"],
  );
  assert.deepEqual(selectFocus(portable).sessions[0].targets, timerOnly());
});

test("deleting completed history leaves active sessions and prevents backfill", () => {
  const tuesday = new Date(2026, 10, 24, 9, 5).getTime();
  const before = reconcile(local, tuesday);
  assert.equal(completedFocusCount(before), 1);
  const purged = merge(before, purgeFocusHistory(before, tuesday)).filter(
    (r) => !r.deleted,
  );
  const after = reconcile(purged, tuesday + 1000);
  assert.equal(completedFocusCount(after), 0);
  assert.equal(
    selectFocus(after).sessions.filter((s) => s.status === "active").length,
    1,
  );
  assert.equal(completedFocusCount(reconcile(after, tuesday + hour)), 1);
});

test("planned alerts use stable module-specific IDs and interrupted sessions release theirs", () => {
  const { sessions } = selectFocus(reconcile(local, monday));
  const alerts = pendingFocusAlerts(sessions, monday);
  assert.deepEqual(
    alerts.map((a) => a.at),
    [monday + hour, monday + hour + 25 * 60000],
  );
  assert.ok(alerts.every((a) => a.id.startsWith("wellbeing/focus/")));
  assert.deepEqual(
    pendingFocusAlerts(
      [{ ...sessions[0], status: "interrupted", endedAt: monday + hour }],
      monday + hour,
    ),
    [],
  );
});

test("an overnight session keeps its original weekday and recovers its remaining time", () => {
  const late = { ...schedule, time: "23:50", days: [1] };
  const afterMidnight = new Date(2026, 10, 24, 0, 5).getTime();
  const rows = reconcile([focusScheduleRow(late), local[1]], afterMidnight);
  const active = selectFocus(rows).sessions.find((s) => s.status === "active")!;
  assert.equal(active.id, "reading/2026-11-23");
  assert.equal(active.endAt - afterMidnight, 10 * 60000);
  assert.equal(completedFocusCount(reconcile(rows, active.endAt)), 1);
});

test("recurrences follow local wall time through spring and autumn clock changes", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    for (const [month, date, elapsed] of [
      [2, 7, 23],
      [9, 31, 25],
    ]) {
      const start = new Date(2026, month, date).getTime();
      const after = new Date(2026, month, date + 1, 9, 5).getTime();
      const s = { ...schedule, days: [0, 6], startsAfter: start };
      const rows = reconcile(
        [
          focusScheduleRow(s),
          focusBindingRow({ id: s.id, targets, historyFrom: start }),
        ],
        after,
      );
      const sessions = selectFocus(rows).sessions.sort(
        (a, b) => a.startAt - b.startAt,
      );
      assert.equal(sessions[0].status, "completed");
      assert.equal(sessions[1].status, "active");
      assert.equal(sessions[1].startAt - sessions[0].startAt, elapsed * hour);
      assert.equal(new Date(sessions[1].startAt).getHours(), 9);
      assert.equal(sessions[1].endAt - sessions[1].startAt, 25 * 60000);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
