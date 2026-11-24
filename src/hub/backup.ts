import { z } from "zod";
import { timeFormats } from "./format-time";
import { wellbeingRecords } from "../wellbeing/records";
import {
  seriesSchema,
  eventSchema,
  timeSchema,
  eventKey,
} from "../reminders/model";
const layout = z.object({
  widgets: z.array(z.string()).refine((a) => new Set(a).size === a.length),
  hidden: z.array(z.string()),
});
export const settingsSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("appearance"),
    mode: z.enum(["system", "light", "dark"]),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  }),
  z.object({ key: z.literal("dashboard"), ...layout.shape }),
  z.object({ key: z.literal("appsLayout"), view: z.enum(["cards", "grid"]) }),
  z.object({ key: z.literal("morning"), time: timeSchema }),
  z.object({ key: z.literal("timeFormat"), format: z.enum(timeFormats) }),
]);
const base = {
  id: z.string().min(1),
  updated: z.number().int().nonnegative(),
  deleted: z.boolean(),
};
export const recordSchema = z
  .discriminatedUnion("kind", [
    ...wellbeingRecords,
    z.object({
      ...base,
      kind: z.literal("reminders.series"),
      value: seriesSchema,
    }),
    z.object({
      ...base,
      kind: z.literal("reminders.event"),
      value: eventSchema,
    }),
    z.object({
      ...base,
      kind: z.literal("reminders.list"),
      value: z.object({ name: z.string().trim().min(1) }),
    }),
    z.object({
      ...base,
      kind: z.literal("hub.setting"),
      value: settingsSchema,
    }),
  ])
  .refine((row) => {
    switch (row.kind) {
      case "wellbeing.preferences":
        return row.id === "settings";
      case "wellbeing.binding":
        return row.id === row.value.ruleId;
      case "wellbeing.focusBinding":
      case "wellbeing.focusSchedule":
      case "wellbeing.focusSession":
      case "wellbeing.goal":
      case "wellbeing.limit":
        return row.id === row.value.id;
      case "reminders.series":
        return row.id === row.value.id;
      case "reminders.event":
        return row.id === eventKey(row.value.series, row.value.original);
      case "hub.setting":
        return row.id === row.value.key;
      case "reminders.list":
        return true;
    }
  });
export type Row = z.infer<typeof recordSchema>;
export type Setting = z.infer<typeof settingsSchema>;
export type AppsLayout = Extract<Setting, { key: "appsLayout" }>["view"];
function portable(row: Row) {
  return !row.kind.startsWith("wellbeing.") || row.kind === "wellbeing.goal" ||
    row.kind === "wellbeing.limit" || row.kind === "wellbeing.focusSchedule";
}
export const backupSchema = z
  .object({
    app: z.literal("minimal-productivity-hub"),
    version: z.union([z.literal(1), z.literal(2)]),
    records: z.array(recordSchema),
  })
  .refine(b => b.records.every(r => portable(r) && (b.version === 2 || !r.kind.startsWith("wellbeing."))), "Unexpected module or device-only record")
  .refine(
    (b) =>
      new Set(b.records.map((r) => r.kind + ":" + r.id)).size ===
      b.records.length,
    "Duplicate record in backup",
  );
export function encodeBackup(records: Row[]) {
  return JSON.stringify(
    { app: "minimal-productivity-hub", version: 2, records: records.filter(portable) },
    null,
    2,
  );
}
