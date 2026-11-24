import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import { Btn, Field, Label, Panel, Row, useNow } from "../hub/ui";
import { useHub, write, mutateRows } from "../hub/storage";
import type { Row as StoredRow } from "../hub/backup";
import { dayKey } from "../reminders/model";
import {
  boundLimits,
  limitProgress,
  type Limit,
  type LimitBinding,
} from "./limits";
import { enableWarnings, usePreferences } from "./preferences";
import { useWellbeingUsage } from "./usage-context";
import { duration } from "./reports";
import { CoverageNote } from "./reports-panels";

const categories = [
  "Accessibility",
  "Audio",
  "Game",
  "Image",
  "Maps",
  "News",
  "Productivity",
  "Social",
  "Video",
  "Uncategorized",
];
type Target = { target: string; label: string };
type Entry = ReturnType<typeof boundLimits>[number];
type Draft = {
  id: string;
  kind: Limit["targetKind"];
  target: Target | null;
  minutes: string;
  enabled: boolean;
  warn: boolean;
};

function draftFor(entry?: Entry): Draft {
  return {
    id: entry?.rule.id ?? randomUUID(),
    kind: entry?.rule.targetKind ?? "app",
    target: entry?.binding ?? null,
    minutes: String(entry?.rule.minutes ?? 30),
    enabled: entry?.rule.enabled ?? true,
    warn: entry?.rule.warnAt80 ?? false,
  };
}

function bindingRow(binding: LimitBinding, deleted = false): StoredRow {
  return {
    kind: "wellbeing.binding",
    id: binding.ruleId,
    value: binding,
    updated: 0,
    deleted,
  };
}
function ruleRow(rule: Limit, deleted = false): StoredRow {
  return {
    kind: "wellbeing.limit",
    id: rule.id,
    value: rule,
    updated: 0,
    deleted,
  };
}

export function LimitsPanel() {
  const rows = useHub((s) => s.rows);
  const { days, status } = useWellbeingUsage();
  const preferences = usePreferences();
  const today = dayKey(useNow());
  const day = days.find(
    (d) => d.date === today && d.coverage !== "unavailable",
  );
  const entries = boundLimits(rows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmExtend, setConfirmExtend] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const params = useLocalSearchParams<{
    target?: string;
    targetKind?: string;
    ruleId?: string;
  }>();
  const apps = new Map<string, Target>();
  for (const d of days)
    for (const app of d.apps)
      apps.set(app.packageName, { target: app.packageName, label: app.label });
  useEffect(() => {
    if (
      !params.target ||
      (params.targetKind !== "app" && params.targetKind !== "category")
    )
      return;
    const target = params.target;
    const existing = boundLimits(useHub.getState().rows).find(
      (e) =>
        e.rule.targetKind === params.targetKind && e.binding?.target === target,
    );
    const app = days
      .flatMap((d) => d.apps)
      .find((a) => a.packageName === target);
    setDraft({
      ...draftFor(existing),
      kind: params.targetKind,
      target: { target, label: app?.label ?? target },
    });
    // Only initialize from navigation. A background refresh must preserve field edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.target, params.targetKind]);
  function edit(entry?: Entry) {
    setQuery("");
    setDraft(draftFor(entry));
  }
  function change(updates: Partial<Draft>) {
    setDraft((d) => d && { ...d, ...updates });
  }
  async function save() {
    if (!draft || busy) return;
    const minutes = Number(draft.minutes);
    if (!/^\d+$/.test(draft.minutes) || minutes < 1 || minutes > 1440)
      throw new Error("Enter a daily limit from 1 to 1440 minutes.");
    const existing = boundLimits(useHub.getState().rows);
    setBusy(true);
    try {
      const previous = existing.find((e) => e.rule.id === draft.id);
      const rule: Limit = {
        id: draft.id,
        targetKind: draft.kind,
        minutes,
        enabled: draft.enabled,
        warnAt80: draft.warn,
      };
      if (draft.warn && !previous?.rule.warnAt80) await enableWarnings();
      await mutateRows((rows) => {
        const latest = boundLimits(rows);
        if (
          draft.target &&
          latest.some(
            (e) =>
              e.rule.id !== draft.id &&
              e.rule.targetKind === draft.kind &&
              e.binding?.target === draft.target?.target,
          )
        )
          throw new Error("A limit already exists for this target.");
        const current = latest.find((e) => e.rule.id === rule.id);
        const changes = [ruleRow(rule)];
        if (draft.target)
          changes.push(
            bindingRow({
              ruleId: rule.id,
              target: draft.target.target,
              label: draft.target.label,
              extendedDate: current?.binding?.extendedDate ?? null,
            }),
          );
        else if (current?.binding)
          changes.push(bindingRow(current.binding, true));
        return changes;
      });
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }
  const choices =
    draft?.kind === "category"
      ? categories.map((target) => ({ target, label: target }))
      : [...apps.values()].sort((a, b) => a.label.localeCompare(b.label));
  const matching = choices.filter((choice) =>
    (choice.label + " " + choice.target)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const sortedEntries = [...entries].sort(
    (a, b) =>
      Number(b.rule.id === params.ruleId) - Number(a.rule.id === params.ruleId),
  );
  return (
    <>
      <Panel title="App Limits">
        <Label small>
          Set daily reminders for an app or category. Android checks usage
          periodically. Apps stay available when you reach a limit.
        </Label>
        {day && <CoverageNote dates={[today]} />}
        {status?.supported &&
          (!preferences.warnings || !status.notificationsGranted) && (
            <>
              <Label small>
                Limit notifications are off. You can still see progress here.
              </Label>
              <Btn
                title="Enable limit notifications"
                onPress={enableWarnings}
              />
            </>
          )}
        {!entries.length && <Label>No limits yet.</Label>}
        <Btn icon="plus" title="Add daily limit" onPress={() => edit()} />
      </Panel>
      {draft && (
        <Panel
          title={
            entries.some((e) => e.rule.id === draft.id)
              ? "Edit limit"
              : "New daily limit"
          }
        >
          <Row>
            {(["app", "category"] as const).map((kind) => (
              <Btn
                key={kind}
                title={kind === "app" ? "App" : "Category"}
                selected={draft.kind === kind}
                onPress={() => {
                  if (kind !== draft.kind) {
                    change({ kind, target: null });
                    setQuery("");
                  }
                }}
              />
            ))}
          </Row>
          <Label>
            {draft.target
              ? "Selected · " + draft.target.label
              : "Choose a target on this device"}
          </Label>
          <Field
            label={draft.kind === "app" ? "Find an app" : "Find a category"}
            value={query}
            onChangeText={setQuery}
          />
          <Row>
            {matching.map((choice) => (
              <Btn
                key={choice.target}
                title={choice.label}
                selected={draft.target?.target === choice.target}
                onPress={() => change({ target: choice })}
              />
            ))}
          </Row>
          {!matching.length && (
            <Label small>
              {choices.length
                ? "No matches."
                : "Tracked apps appear here after Android records activity. You can save this limit and choose its app later."}
            </Label>
          )}
          <Field
            label="Daily limit in minutes"
            keyboardType="number-pad"
            value={draft.minutes}
            onChangeText={(minutes) => change({ minutes })}
          />
          <Row>
            <Btn
              title={draft.enabled ? "Limit enabled" : "Limit paused"}
              selected={draft.enabled}
              onPress={() => change({ enabled: !draft.enabled })}
            />
            <Btn
              title="Warn at 80%"
              selected={draft.warn}
              onPress={() => change({ warn: !draft.warn })}
            />
          </Row>
          <Row>
            <Btn primary title="Save limit" disabled={busy} onPress={save} />
            <Btn
              title="Cancel"
              disabled={busy}
              onPress={() => setDraft(null)}
            />
          </Row>
        </Panel>
      )}
      {sortedEntries.map(({ rule, binding }) => {
        const progress =
          binding && day ? limitProgress(rule, binding, day) : null;
        return (
          <Panel
            key={rule.id}
            title={
              binding?.label ??
              (rule.targetKind === "app"
                ? "Unbound app limit"
                : "Unbound category limit")
            }
          >
            <Label>
              {rule.minutes} min daily · {rule.enabled ? "Enabled" : "Paused"}
              {rule.warnAt80 ? " · 80% warning" : ""}
            </Label>
            {!binding ? (
              <Label small>
                Choose a target on this device to activate this rule.
              </Label>
            ) : !progress ? (
              <Label small>Today's usage is unavailable.</Label>
            ) : (
              <>
                <Label>
                  {duration(progress.usedMs)} of {duration(progress.budgetMs)}{" "}
                  used{day?.coverage === "partial" ? " · partial coverage" : ""}
                </Label>
                {rule.enabled && progress.threshold === 100 && (
                  <Label bold>Daily limit reached</Label>
                )}
                {rule.enabled && rule.warnAt80 && progress.threshold === 80 && (
                  <Label>80% of this limit used</Label>
                )}
                {progress.extended && (
                  <Label small>Today's 10-minute extension is active.</Label>
                )}
                {rule.enabled &&
                  progress.threshold === 100 &&
                  !progress.extended &&
                  (confirmExtend === rule.id ? (
                    <View style={{ gap: 8 }}>
                      <Label>
                        Add 10 minutes to today's budget? Each limit has one
                        extension per local day.
                      </Label>
                      <Row>
                        <Btn
                          primary
                          title="Confirm extension"
                          onPress={async () => {
                            await mutateRows((rows) => {
                              const current = boundLimits(rows).find(
                                (e) => e.rule.id === rule.id,
                              );
                              const date = dayKey(new Date());
                              if (
                                !day ||
                                day.date !== date ||
                                !current?.binding ||
                                !current.rule.enabled ||
                                current.binding.extendedDate === date ||
                                limitProgress(
                                  current.rule,
                                  current.binding,
                                  day,
                                ).threshold !== 100
                              )
                                return [];
                              return [
                                bindingRow({
                                  ...current.binding,
                                  extendedDate: date,
                                }),
                              ];
                            });
                            setConfirmExtend(null);
                          }}
                        />
                        <Btn
                          title="Cancel extension"
                          onPress={() => setConfirmExtend(null)}
                        />
                      </Row>
                    </View>
                  ) : (
                    <Btn
                      title="Extend by 10 minutes"
                      onPress={() => setConfirmExtend(rule.id)}
                    />
                  ))}
              </>
            )}
            <Row>
              <Btn
                title={binding ? "Edit limit" : "Choose target"}
                onPress={() => edit({ rule, binding })}
              />
              <Btn
                title={rule.enabled ? "Pause" : "Resume"}
                onPress={() =>
                  write([ruleRow({ ...rule, enabled: !rule.enabled })])
                }
              />
              <Btn
                title="Remove limit"
                onPress={() => setConfirmDelete(rule.id)}
              />
            </Row>
            {confirmDelete === rule.id && (
              <Row>
                <Btn
                  title="Confirm removal"
                  onPress={async () => {
                    await write([
                      ruleRow(rule, true),
                      ...(binding ? [bindingRow(binding, true)] : []),
                    ]);
                    if (draft?.id === rule.id) setDraft(null);
                    setConfirmDelete(null);
                  }}
                />
                <Btn
                  title="Keep limit"
                  onPress={() => setConfirmDelete(null)}
                />
              </Row>
            )}
          </Panel>
        );
      })}
    </>
  );
}
