import { dayKey, localDay, shiftDay } from "../reminders/model";
import type { UsageApp, UsageDay } from "./usage";

export type Period =
  "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth";
export const periodTitles: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  lastWeek: "Last week",
  month: "This month",
  lastMonth: "Last month",
};

export function weekStart(date: string) {
  return shiftDay(date, -((localDay(date).getDay() + 6) % 7));
}

export function periodDates(period: Period, today: string) {
  if (period === "today") return [today];
  if (period === "yesterday") return [shiftDay(today, -1)];
  if (period === "month" || period === "lastMonth") {
    const now = localDay(today);
    const month = now.getMonth() - (period === "lastMonth" ? 1 : 0);
    const start = dayKey(new Date(now.getFullYear(), month, 1));
    const count =
      period === "month"
        ? now.getDate()
        : new Date(now.getFullYear(), month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => shiftDay(start, i));
  }
  const monday = weekStart(today);
  const start = period === "week" ? monday : shiftDay(monday, -7);
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i)).filter(
    (date) => date <= today,
  );
}

export function duration(ms: number) {
  if (ms > 0 && ms < 60000) return "<1 min";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? hours + " h " + (minutes % 60) + " min" : hours + " h";
}

export function summarize(days: UsageDay[], dates: string[]) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const observed = dates.flatMap((date) => {
    const day = byDate.get(date);
    return day && day.coverage !== "unavailable" ? [day] : [];
  });
  const appMap = new Map<string, UsageApp>();
  let totalMs = 0;
  let unlocks = 0;
  for (const day of observed) {
    totalMs += day.totalMs;
    unlocks += day.unlocks;
    for (const app of day.apps) {
      const previous = appMap.get(app.packageName);
      appMap.set(app.packageName, {
        ...app,
        durationMs: app.durationMs + (previous?.durationMs ?? 0),
        launches: app.launches + (previous?.launches ?? 0),
      });
    }
  }
  const apps = [...appMap.values()].sort(
    (a, b) => b.durationMs - a.durationMs || a.label.localeCompare(b.label),
  );
  const byCategory = new Map<string, number>();
  for (const app of apps) {
    byCategory.set(
      app.category,
      (byCategory.get(app.category) ?? 0) + app.durationMs,
    );
  }
  return {
    totalMs,
    unlocks,
    apps,
    launches: apps.reduce((sum, app) => sum + app.launches, 0),
    categories: [...byCategory].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
    observed: observed.length,
    complete: observed.filter((day) => day.coverage === "complete").length,
    expected: dates.length,
  };
}

export function coverageLabel(summary: ReturnType<typeof summarize>) {
  if (!summary.observed) return "Usage is unavailable for this period.";
  if (summary.complete === summary.expected) return "Complete coverage";
  return (
    "Partial coverage · " +
    summary.complete +
    " of " +
    summary.expected +
    (summary.expected === 1 ? " full day" : " full days") +
    " recorded"
  );
}

export function comparison(days: UsageDay[], period: Period, today: string) {
  const dates = periodDates(period, today);
  const byDate = new Map(days.map((day) => [day.date, day]));
  if (period === "today") {
    const current = byDate.get(today);
    const prior = byDate.get(shiftDay(today, -1))?.matchedTotalMs;
    if (current?.coverage !== "complete" || prior == null) return null;
    return {
      current: current.totalMs,
      prior,
      label: "since midnight vs. yesterday at the same time",
    };
  }
  // Compare finished local days to avoid treating a partial day as a full day.
  const finished = dates.filter((date) => date < today);
  let priorDates: string[];
  if (period === "month" || period === "lastMonth") {
    const start = localDay(dates[0]);
    const previous = dayKey(
      new Date(start.getFullYear(), start.getMonth() - 1, 1),
    );
    const length = new Date(start.getFullYear(), start.getMonth(), 0).getDate();
    finished.splice(length);
    priorDates = finished.map((_, index) => shiftDay(previous, index));
  } else {
    priorDates = finished.map((date) =>
      shiftDay(date, period === "yesterday" ? -1 : -7),
    );
  }
  const current = summarize(days, finished),
    prior = summarize(days, priorDates);
  const todayDay = byDate.get(today);
  const now = localDay(today);
  const reference =
    period === "week"
      ? shiftDay(today, -7)
      : dayKey(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
  const matched = byDate.get(reference)?.matchedTotalMs;
  if (
    (period === "week" || period === "month") &&
    (period !== "month" || localDay(reference).getDate() === now.getDate()) &&
    todayDay?.coverage === "complete" &&
    matched != null &&
    current.complete === finished.length &&
    prior.complete === finished.length
  ) {
    return {
      current: current.totalMs + todayDay.totalMs,
      prior: prior.totalMs + matched,
      label:
        period === "week"
          ? "vs. last week through the same local time"
          : "vs. last month through the same local time",
    };
  }
  if (
    !finished.length ||
    current.complete !== finished.length ||
    prior.complete !== finished.length
  )
    return null;
  const label =
    period === "yesterday"
      ? "vs. the previous day"
      : "across " +
        finished.length +
        " completed " +
        (finished.length === 1 ? "day" : "days") +
        (period === "week" || period === "lastWeek"
          ? " vs. the previous week"
          : " vs. the previous month");
  return { current: current.totalMs, prior: prior.totalMs, label };
}
