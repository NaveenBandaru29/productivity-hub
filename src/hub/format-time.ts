export const timeFormats = ["12-hour", "24-hour"] as const;
export type TimeFormat = (typeof timeFormats)[number];

export function clockTime(hours: number, minutes: number) {
  return (
    String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0")
  );
}

export function formatTime(value: string, format: TimeFormat) {
  if (format === "24-hour") return value;
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  return (hour % 12 || 12) + ":" + minutes + (hour < 12 ? " AM" : " PM");
}
