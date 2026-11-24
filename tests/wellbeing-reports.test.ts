import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftDay } from "../src/reminders/model";
import {
  comparison,
  periodDates,
  summarize,
  duration,
} from "../src/wellbeing/reports";
import {
  goalProgress,
  budgetHistory,
  goalSchema,
  type Goal,
} from "../src/wellbeing/goals";
import {
  limitProgress,
  nativeLimitPolicy,
  type Limit,
  type LimitBinding,
} from "../src/wellbeing/limits";
import type { UsageDay } from "../src/wellbeing/usage";
import type { Row } from "../src/hub/backup";

const minute = 60000;
const id = "10000000-aaaa-4000-8000-aaaaaaaaaaaa";
const rule: Limit = {
  id,
  minutes: 100,
  enabled: true,
  targetKind: "app",
  warnAt80: true,
};
const binding: LimitBinding = {
  ruleId: id,
  target: "app.a",
  label: "Reader",
  extendedDate: null,
};
const goal: Goal = {
  id,
  period: "daily",
  minutes: 100,
  startDate: "2026-10-01",
};
function usage(
  date: string,
  minutes: number,
  coverage: UsageDay["coverage"] = "complete",
): UsageDay {
  return {
    date,
    totalMs: minutes * minute,
    coverage,
    coverageEnd: null,
    matchedTotalMs: null,
    unlocks: 2,
    apps: [
      {
        packageName: "app.a",
        label: "Reader",
        category: "News",
        durationMs: minutes * minute,
        launches: 3,
      },
    ],
  };
}

test("report periods use local Mondays and calendar months across leap years", () => {
  assert.deepEqual(periodDates("week", "2026-01-01"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
  ]);
  assert.equal(periodDates("lastMonth", "2024-03-30").at(-1), "2024-02-29");
  assert.equal(periodDates("month", "2024-03-30").length, 30);
});

test("app and category totals include observed partial work and exclude unknown days", () => {
  const first = usage("2026-11-01", 10);
  first.apps.push({
    packageName: "app.b",
    category: "News",
    label: "News",
    durationMs: 2 * minute,
    launches: 4,
  });
  const report = summarize(
    [
      first,
      usage("2026-11-02", 20, "partial"),
      usage("2026-11-03", 90, "unavailable"),
    ],
    ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
  );
  assert.equal(report.totalMs, 30 * minute);
  assert.deepEqual(
    [report.complete, report.observed, report.expected],
    [1, 2, 4],
  );
  assert.deepEqual(
    report.apps.map((a) => a.launches),
    [6, 4],
  );
  assert.deepEqual(report.categories, [["News", 32 * minute]]);
  assert.equal(duration(1), "<1 min");
});

test("today compares identical covered portions, other periods require all finished days", () => {
  const today = usage("2026-11-24", 40);
  const yesterday = {
    ...usage("2026-11-23", 180),
    matchedTotalMs: 35 * minute,
  };
  assert.equal(
    comparison([today, yesterday], "today", today.date)?.prior,
    35 * minute,
  );
  assert.equal(
    comparison(
      [{ ...today, coverage: "partial" }, yesterday],
      "today",
      today.date,
    ),
    null,
  );
  assert.equal(
    comparison(
      [today, { ...yesterday, matchedTotalMs: null }],
      "today",
      today.date,
    ),
    null,
  );
  const priorMonday = usage("2026-11-16", 0);
  assert.equal(
    comparison([today, yesterday, priorMonday], "week", today.date)?.current,
    180 * minute,
  );
  assert.equal(comparison([today, yesterday], "week", today.date), null);
  const priorTuesday = {
    ...usage("2026-11-17", 180),
    matchedTotalMs: 15 * minute,
  };
  assert.deepEqual(
    comparison(
      [today, yesterday, priorMonday, priorTuesday],
      "week",
      today.date,
    ),
    {
      current: 220 * minute,
      prior: 15 * minute,
      label: "vs. last week through the same local time",
    },
  );
});

test("limit thresholds, category sums and ten minute exceptions reset by local date", () => {
  const day = usage("2026-11-24", 80);
  assert.equal(limitProgress(rule, binding, day).threshold, 80);
  day.apps.push({
    ...day.apps[0],
    packageName: "app.b",
    durationMs: 20 * minute,
  });
  const category = { ...rule, targetKind: "category" as const };
  const news = { ...binding, target: "News" };
  assert.equal(limitProgress(category, news, day).threshold, 100);
  const extended = { ...news, extendedDate: day.date };
  assert.equal(limitProgress(category, extended, day).budgetMs, 110 * minute);
  assert.equal(
    limitProgress(category, extended, { ...day, date: "2026-11-25" }).budgetMs,
    100 * minute,
  );
});

test("unbound, removed and paused rules are excluded from native policy", () => {
  const limit: Row = {
    id,
    updated: 1,
    deleted: false,
    kind: "wellbeing.limit",
    value: rule,
  };
  const local: Row = {
    id,
    updated: 1,
    deleted: false,
    kind: "wellbeing.binding",
    value: { ...binding, extendedDate: "2026-11-24" },
  };
  assert.equal(nativeLimitPolicy([limit]).length, 0);
  assert.equal(
    nativeLimitPolicy([limit, { ...local, deleted: true }]).length,
    0,
  );
  assert.equal(
    nativeLimitPolicy([{ ...limit, value: { ...rule, enabled: false } }, local])
      .length,
    0,
  );
  assert.deepEqual(nativeLimitPolicy([limit, local]), [
    {
      id,
      targetType: "app",
      target: "app.a",
      minutes: 100,
      warnAt80: true,
      extensionDay: "2026-11-24",
    },
  ]);
});

test("only finished, fully observed periods count towards a budget streak", () => {
  const today = "2026-11-24";
  const days = [
    usage(today, 10),
    usage("2026-11-23", 100),
    usage("2026-11-22", 0, "partial"),
    usage("2026-11-21", 20),
  ];
  const result = goalProgress(goal, days, today);
  assert.equal(result.streak, 1);
  assert.equal(result.history[1].outcome, "incomplete");
  const lastMonday = "2026-11-16";
  const week = Array.from({ length: 7 }, (_, i) =>
    usage(shiftDay(lastMonday, i), 10),
  );
  assert.equal(
    goalProgress({ ...goal, period: "weekly" }, week, today).streak,
    1,
  );
  assert.equal(
    goalProgress({ ...goal, period: "weekly" }, week.slice(1), today).streak,
    0,
  );
  assert.equal(
    goalProgress(
      { ...goal, period: "weekly", startDate: "2026-11-17" },
      week,
      today,
    ).streak,
    0,
  );
});

test("edited budgets use the effective target for each date and preserve consecutive wins", () => {
  const budgets: Goal[] = [
    { ...goal, endDate: "2026-11-22" },
    {
      ...goal,
      id: "20000000-aaaa-4000-8000-aaaaaaaaaaaa",
      startDate: "2026-11-23",
      minutes: 30,
    },
  ];
  const days = [usage("2026-11-22", 70), usage("2026-11-23", 30)];
  assert.equal(budgetHistory(budgets, "daily", days, "2026-11-24").streak, 2);
  assert.equal(goalSchema.safeParse({ ...goal, minutes: 1500 }).success, false);
});
