import { Btn, Label, Row } from "../hub/ui";
import { localDay, type Rule } from "./model";

export const repeatLabels = {
  once: "Never",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
} as const;
function initialRule(kind: Rule["kind"], date: string): Rule {
  if (kind === "weekly") return { kind, days: [localDay(date).getDay()] };
  if (kind === "monthly") return { kind, day: 1 };
  return { kind };
}
export function RepeatFields({
  rule,
  date,
  onChange,
}: {
  rule: Rule;
  date: string;
  onChange: (rule: Rule) => void;
}) {
  return (
    <>
      <Row>
        {(["once", "daily", "weekly", "monthly"] as const).map((kind) => (
          <Btn
            key={kind}
            title={repeatLabels[kind]}
            selected={rule.kind === kind}
            onPress={() => onChange(initialRule(kind, date))}
          />
        ))}
      </Row>
      {rule.kind === "weekly" && (
        <Row>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name, i) => (
            <Btn
              key={name}
              title={name}
              selected={rule.days.includes(i)}
              onPress={() => {
                const days = rule.days.includes(i)
                  ? rule.days.filter((v) => v !== i)
                  : [...rule.days, i];
                if (days.length) onChange({ ...rule, days });
              }}
            />
          ))}
        </Row>
      )}
      {rule.kind === "monthly" && (
        <>
          <Label small>Day of each month</Label>
          <Row>
            {Array.from({ length: 31 }, (_, i) => (
              <Btn
                key={i}
                title={String(i + 1)}
                selected={rule.day === i + 1}
                onPress={() => onChange({ ...rule, day: i + 1 })}
              />
            ))}
          </Row>
        </>
      )}
    </>
  );
}
