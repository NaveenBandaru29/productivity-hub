import { localDay, shiftDay, type Details } from "./model";

export function quickAdd(
  raw: string,
  selected: string,
  today: string,
): Partial<Details> {
  const words =
    "sunday monday tuesday wednesday thursday friday saturday".split(" ");
  const timeOnly = raw
    .trim()
    .match(/^(.+?)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
  if (
    timeOnly &&
    !/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      timeOnly[1],
    )
  ) {
    const parsed = quickAdd(
      timeOnly[1] + " today at " + timeOnly[2],
      selected,
      selected,
    );
    return parsed.time ? parsed : { title: raw.trim(), date: selected };
  }
  const match = raw
    .trim()
    .match(
      /^(.+?)\s+(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
    );
  if (!match) return { title: raw.trim(), date: selected };
  const [, title, day, h, m, period] = match;
  const name = day.toLowerCase();
  let offset = name === "tomorrow" ? 1 : 0;
  if (words.includes(name))
    offset = (words.indexOf(name) - localDay(today).getDay() + 7) % 7;
  let hour = Number(h);
  if (
    h &&
    ((period && (hour < 1 || hour > 12)) || hour > 23 || Number(m ?? 0) > 59)
  )
    return { title: raw.trim(), date: selected };
  if (period) hour = (hour % 12) + (period.toLowerCase() === "pm" ? 12 : 0);
  return {
    title,
    date: shiftDay(today, offset),
    time: h ? String(hour).padStart(2, "0") + ":" + (m ?? "00") : null,
  };
}
