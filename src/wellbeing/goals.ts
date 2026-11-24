import { z } from "zod";
import { dateSchema, shiftDay } from "../reminders/model";
import { weekStart } from "./reports";
import type { UsageDay } from "./usage";

export const goalSchema = z
  .object({
    id: z.string().uuid(),
    period: z.enum(["daily", "weekly"]),
    minutes: z.number().int().min(1).max(10080),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
  })
  .refine(
    (goal) => goal.period !== "daily" || goal.minutes <= 1440,
    "A daily budget must fit within a day",
  )
  .refine(
    (goal) => !goal.endDate || goal.endDate >= goal.startDate,
    "Goal dates are out of order",
  );
export type Goal = z.infer<typeof goalSchema>;

export function goalProgress(goal: Goal, days: UsageDay[], today: string) {
  const daily = goal.period === "daily";
  const length = daily ? 1 : 7;
  const start = daily ? today : weekStart(today);
  const byDate = new Map(days.map((day) => [day.date, day]));
  function interval(date: string) {
    let amountMs = 0;
    let complete = 0;
    let observed = 0;
    for (let i = 0; i < length; i++) {
      const key = shiftDay(date, i);
      const day = byDate.get(key);
      if (key > today || !day || day.coverage === "unavailable") continue;
      observed++;
      amountMs += day.totalMs;
      if (day.coverage === "complete") complete++;
    }
    const outcome =
      date < goal.startDate ||
      (goal.endDate && shiftDay(date, length - 1) > goal.endDate) ||
      complete < length
        ? "incomplete"
        : amountMs <= goal.minutes * 60000
          ? "met"
          : "missed";
    return { date, amountMs, complete, observed, outcome };
  }
  const history = [];
  // Limit history to the locally retained reporting window.
  for (let offset = length; offset <= 90; offset += length) {
    const date = shiftDay(start, -offset);
    if (date < goal.startDate) break;
    history.push(interval(date));
  }
  let streak = 0;
  for (const result of history) {
    if (result.outcome !== "met") break;
    streak++;
  }
  return { current: interval(start), history, streak };
}

export function budgetHistory(
  goals: Goal[],
  period: Goal["period"],
  days: UsageDay[],
  today: string,
) {
  const results = new Map<
    string,
    ReturnType<typeof goalProgress>["history"][number]
  >();
  const ordered = goals
    .filter((g) => g.period === period)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const goal of ordered) {
    for (const interval of goalProgress(goal, days, today).history) {
      if (!goal.endDate || interval.date <= goal.endDate)
        results.set(interval.date, interval);
    }
  }
  const history = [...results.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  let streak = 0;
  const length = period === "daily" ? 1 : 7;
  let expected = shiftDay(
    period === "daily" ? today : weekStart(today),
    -length,
  );
  for (const item of history) {
    if (item.outcome !== "met" || item.date !== expected) break;
    streak++;
    expected = shiftDay(expected, -length);
  }
  return { history, streak };
}
