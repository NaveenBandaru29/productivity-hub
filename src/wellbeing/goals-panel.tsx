import React, { useState } from "react";
import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Btn, Field, Label, Panel, Row, useNow } from "../hub/ui";
import { useHub, mutateRows } from "../hub/storage";
import type { Row as StoredRow } from "../hub/backup";
import { formatDate } from "../hub/format-date";
import { dayKey, shiftDay } from "../reminders/model";
import { useWellbeingUsage } from "./usage-context";
import { duration, periodDates } from "./reports";
import { CoverageNote } from "./reports-panels";
import { budgetHistory, goalProgress, goalSchema, type Goal } from "./goals";
import { completedFocusCount } from "./focus-model";

function allGoals(rows: StoredRow[]) {
  return rows.flatMap((row) =>
    row.kind === "wellbeing.goal" && !row.deleted ? [row.value] : [],
  );
}
function goalRow(value: Goal, deleted = false): StoredRow {
  return { kind: "wellbeing.goal", id: value.id, value, updated: 0, deleted };
}
function GoalBudget({ period }: { period: Goal["period"] }) {
  const rows = useHub((s) => s.rows);
  const { days } = useWellbeingUsage();
  const today = dayKey(useNow());
  const daily = period === "daily";
  const dates = periodDates(daily ? "today" : "week", today);
  const goals = allGoals(rows);
  const active = goals
    .filter(
      (g) =>
        g.period === period &&
        g.startDate <= today &&
        (!g.endDate || g.endDate >= today),
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const { history, streak } = budgetHistory(goals, period, days, today);
  const current = active && goalProgress(active, days, today).current;
  const [minutes, setMinutes] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  async function update(value: number | null) {
    const newGoal =
      value === null
        ? null
        : goalSchema.parse({
            id: randomUUID(),
            period,
            minutes: value,
            startDate: today,
          });
    await mutateRows((records) => {
      const changes = allGoals(records)
        .filter(
          (g) => g.period === period && !g.endDate && g.startDate <= today,
        )
        .map((g) =>
          g.startDate === today
            ? goalRow(g, true)
            : goalRow({ ...g, endDate: shiftDay(today, -1) }),
        );
      if (newGoal) changes.push(goalRow(newGoal));
      return changes;
    });
    setMinutes(null);
    setRemoving(false);
  }
  return (
    <Panel
      title={daily ? "Daily screen-time budget" : "Weekly screen-time budget"}
    >
      {active && current ? (
        <>
          <Label bold>
            {duration(active.minutes * 60000)} {daily ? "per day" : "per week"}
          </Label>
          {current.observed ? (
            <Label>
              {duration(current.amountMs)} recorded ·{" "}
              {duration(Math.max(0, active.minutes * 60000 - current.amountMs))}{" "}
              remaining
            </Label>
          ) : (
            <Label small>
              Usage is unavailable for the current {daily ? "day" : "week"}.
            </Label>
          )}
          {current.observed > 0 && current.complete < dates.length && (
            <Label small>Some usage is missing from this period.</Label>
          )}
          {current.observed > 0 && <CoverageNote dates={dates} />}
          <Label>
            {streak} consecutive {daily ? "completed days" : "completed weeks"}{" "}
            within budget
          </Label>
        </>
      ) : (
        <Label small>
          Set an optional budget to track{" "}
          {daily ? "each day" : "Monday through Sunday"}.
        </Label>
      )}
      {minutes === null ? (
        <Row>
          <Btn
            title={active ? "Edit budget" : "Set budget"}
            onPress={() =>
              setMinutes(String(active?.minutes ?? (daily ? 120 : 840)))
            }
          />
          {active && (
            <Btn title="End budget" onPress={() => setRemoving(true)} />
          )}
        </Row>
      ) : (
        <View style={{ gap: 8 }}>
          <Field
            label={
              daily ? "Daily budget in minutes" : "Weekly budget in minutes"
            }
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
          />
          <Row>
            <Btn
              title="Save budget"
              primary
              onPress={() => {
                if (
                  !/^\d+$/.test(minutes) ||
                  Number(minutes) < 1 ||
                  Number(minutes) > (daily ? 1440 : 10080)
                )
                  throw new Error(
                    "Enter a budget between 1 and " +
                      (daily ? 1440 : 10080) +
                      " minutes.",
                  );
                return update(Number(minutes));
              }}
            />
            <Btn title="Cancel" onPress={() => setMinutes(null)} />
          </Row>
        </View>
      )}
      {removing && (
        <Row>
          <Btn title="Confirm end budget" onPress={() => update(null)} />
          <Btn title="Keep budget" onPress={() => setRemoving(false)} />
        </Row>
      )}
      {history.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label bold>{daily ? "Daily history" : "Weekly history"}</Label>
          {history.slice(0, expanded ? history.length : 5).map((item) => (
            <Label small key={item.date}>
              {formatDate(item.date)} ·{" "}
              {item.outcome === "met"
                ? "Within budget"
                : item.outcome === "missed"
                  ? "Over budget"
                  : "Incomplete coverage"}
              {item.observed ? " · " + duration(item.amountMs) : ""}
            </Label>
          ))}
          {history.length > 5 && (
            <Btn
              title={expanded ? "Show less history" : "Show all history"}
              onPress={() => setExpanded(!expanded)}
            />
          )}
        </View>
      )}
    </Panel>
  );
}
export function GoalsPanel() {
  const rows = useHub((s) => s.rows);
  const { days } = useWellbeingUsage();
  const today = dayKey(useNow());
  const sessions = completedFocusCount(rows);
  const qualifyingDays = budgetHistory(
    allGoals(rows),
    "daily",
    days,
    today,
  ).history.filter((day) => day.outcome === "met").length;
  return (
    <>
      <Panel title="Goals & Progress">
        <Label>
          {sessions} completed focus {sessions === 1 ? "session" : "sessions"}
        </Label>
        <Label small>
          Budget streaks count finished periods with complete usage coverage.
        </Label>
      </Panel>
      <GoalBudget period="daily" />
      <GoalBudget period="weekly" />
      <Panel title="Milestones">
        <Label>
          {sessions ? "Achieved" : "In progress"} · First completed focus
          session
        </Label>
        <Label>
          {qualifyingDays >= 7
            ? "Achieved"
            : Math.min(qualifyingDays, 7) + " of 7"}{" "}
          · Seven complete days within budget
        </Label>
      </Panel>
    </>
  );
}
