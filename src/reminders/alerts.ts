import {
  type Data,
  type Item,
  dayKey,
  shiftDay,
  itemAt,
  originalDatesBySeries,
} from "./model";

const MAX_PENDING_ALERTS = 60;
const LOOKAHEAD_DAYS = 370;

interface PendingAlert {
  id: string;
  date: number;
  title: string;
  series: string;
  original: string;
}

function upcomingAlert(
  item: Item | undefined,
  morning: string,
  now: number,
): PendingAlert | undefined {
  if (!item || item.event?.completed) return;
  const date =
    item.event?.snooze ??
    new Date(
      item.details.date + "T" + (item.details.time ?? morning),
    ).getTime();
  if (date <= now) return;
  return {
    id: "reminders/" + item.key,
    date,
    title: item.details.title,
    series: item.series.id,
    original: item.original,
  };
}

export function pendingAlerts(data: Data, morning: string, now: Date) {
  const today = dayKey(now);
  const overrides = originalDatesBySeries(data.events);
  const alerts: PendingAlert[] = [];
  for (const series of data.series) {
    // An override can move or snooze an occurrence into the future from outside the scan window.
    const changed = new Set(overrides.get(series.id));
    for (const original of changed) {
      const alert = upcomingAlert(
        itemAt(series, original, data.events),
        morning,
        now.getTime(),
      );
      if (alert) alerts.push(alert);
    }

    const first = series.details.date > today ? series.details.date : today;
    const days = series.rule.kind === "once" ? 1 : LOOKAHEAD_DAYS;
    let scheduled = 0;
    for (
      let offset = 0;
      offset < days && scheduled < MAX_PENDING_ALERTS;
      offset++
    ) {
      const original = shiftDay(first, offset);
      if (series.end && original > series.end) break;
      if (changed.has(original)) continue;
      const alert = upcomingAlert(
        itemAt(series, original, data.events),
        morning,
        now.getTime(),
      );
      if (alert) {
        alerts.push(alert);
        scheduled++;
      }
    }
  }
  return alerts
    .sort((a, b) => a.date - b.date || a.id.localeCompare(b.id))
    .slice(0, MAX_PENDING_ALERTS);
}
