import { z } from "zod";
import type { Row } from "../hub/backup";
import { dateSchema } from "../reminders/model";
import type { UsageDay } from "./usage";

export const limitSchema = z.object({
  id: z.string().uuid(),
  targetKind: z.enum(["app", "category"]),
  minutes: z.number().int().min(1).max(1440),
  enabled: z.boolean(),
  warnAt80: z.boolean(),
});
export const limitBindingSchema = z.object({
  ruleId: z.string().uuid(),
  target: z.string().trim().min(1),
  label: z.string().trim().min(1),
  extendedDate: dateSchema.nullable(),
});
export type Limit = z.infer<typeof limitSchema>;
export type LimitBinding = z.infer<typeof limitBindingSchema>;

export function boundLimits(rows: readonly Row[]) {
  const bindings = new Map<string, LimitBinding>();
  for (const row of rows) {
    if (row.kind === "wellbeing.binding" && !row.deleted)
      bindings.set(row.id, row.value);
  }
  return rows.flatMap((row) =>
    row.kind === "wellbeing.limit" && !row.deleted
      ? [{ rule: row.value, binding: bindings.get(row.id) }]
      : [],
  );
}

export function nativeLimitPolicy(rows: readonly Row[]) {
  return boundLimits(rows).flatMap(({ rule, binding }) =>
    binding && rule.enabled
      ? [
          {
            id: rule.id,
            targetType: rule.targetKind,
            target: binding.target,
            minutes: rule.minutes,
            warnAt80: rule.warnAt80,
            ...(binding.extendedDate && { extensionDay: binding.extendedDate }),
          },
        ]
      : [],
  );
}

export function limitProgress(
  rule: Limit,
  binding: LimitBinding,
  day: UsageDay,
) {
  const usedMs = day.apps.reduce((sum, app) => {
    const target = rule.targetKind === "app" ? app.packageName : app.category;
    return sum + (target === binding.target ? app.durationMs : 0);
  }, 0);
  const extended = binding.extendedDate === day.date;
  const budgetMs = (rule.minutes + (extended ? 10 : 0)) * 60000;
  return {
    usedMs,
    budgetMs,
    extended,
    threshold: usedMs >= budgetMs ? 100 : usedMs >= budgetMs * 0.8 ? 80 : 0,
  };
}
