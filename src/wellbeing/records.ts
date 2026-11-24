import { z } from "zod";
import { focusBindingSchema, focusScheduleSchema, focusSessionSchema } from "./focus-model";
import { goalSchema } from "./goals";
import { limitBindingSchema, limitSchema } from "./limits";

export const preferenceSchema = z.object({
  onboarded: z.boolean(),
  warnings: z.boolean(),
  sessionAlerts: z.boolean(),
});

const base = {
  id: z.string().min(1),
  updated: z.number().int().nonnegative(),
  deleted: z.boolean(),
};

function record<K extends string, V extends z.ZodType>(kind: K, value: V) {
  return z.object({ ...base, kind: z.literal(kind), value });
}

export const wellbeingRecords = [
  record("wellbeing.preferences", preferenceSchema),
  record("wellbeing.goal", goalSchema),
  record("wellbeing.limit", limitSchema),
  record("wellbeing.binding", limitBindingSchema),
  record("wellbeing.focusSession", focusSessionSchema),
  record("wellbeing.focusSchedule", focusScheduleSchema),
  record("wellbeing.focusBinding", focusBindingSchema),
] as const;

export const wellbeingTables = {
  "wellbeing.preferences": "wellbeing_preferences",
  "wellbeing.goal": "wellbeing_goals",
  "wellbeing.limit": "wellbeing_limits",
  "wellbeing.binding": "wellbeing_limit_bindings",
  "wellbeing.focusSession": "wellbeing_focus_sessions",
  "wellbeing.focusSchedule": "wellbeing_focus_schedules",
  "wellbeing.focusBinding": "wellbeing_focus_bindings",
} as const;

export const wellbeingMigration = Object.values(wellbeingTables).map(table =>
  `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, body TEXT NOT NULL);`
).join("\n");
