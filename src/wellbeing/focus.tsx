import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Btn, Field, Label, Panel, Row, useColors } from "../hub/ui";
import { Picker } from "../hub/picker";
import { useHub, useTimeFormat } from "../hub/storage";
import { clockTime, formatTime, type TimeFormat } from "../hub/format-time";
import { useWellbeingUsage } from "./usage-context";
import {
  removeFocusSchedule,
  saveFocusSchedule,
  startFocus,
  stopFocus,
} from "./focus-actions";
import {
  focusDuration,
  hasTargets,
  selectFocus,
  timerOnly,
  type FocusSession,
  type FocusSchedule,
  type FocusTargets,
} from "./focus-model";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateTime(stamp: number, format: TimeFormat) {
  const date = new Date(stamp);
  return (
    date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    formatTime(clockTime(date.getHours(), date.getMinutes()), format)
  );
}

function ActiveSession({ session }: { session: FocusSession }) {
  const c = useColors();
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const left = Math.max(0, Math.ceil((session.endAt - now) / 1000));
  const percent = Math.min(
    100,
    Math.max(
      0,
      Math.floor(
        ((now - session.startAt) / (session.endAt - session.startAt)) * 100,
      ),
    ),
  );
  return (
    <Panel title={session.name}>
      <Text
        accessibilityLabel={
          Math.floor(left / 60) +
          " minutes and " +
          (left % 60) +
          " seconds remaining"
        }
        style={{
          color: c.fg,
          fontSize: 42,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Session progress"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: c.wash,
          overflow: "hidden",
        }}
      >
        <View
          style={{ height: 6, width: `${percent}%`, backgroundColor: c.accent }}
        />
      </View>
      <Label small>
        {session.source === "instant" ? "Instant session" : "Scheduled session"}{" "}
        · {Math.round((session.endAt - session.startAt) / 60000)} min
      </Label>
      {confirm ? (
        <>
          <Label>End this session early?</Label>
          <Label small>
            This session will appear as interrupted in your history.
          </Label>
          <Row>
            <Btn title="Keep focusing" onPress={() => setConfirm(false)} />
            <Btn title="End session" onPress={() => stopFocus(session.id)} />
          </Row>
        </>
      ) : (
        <Row>
          <Btn title="End early" onPress={() => setConfirm(true)} />
        </Row>
      )}
    </Panel>
  );
}

function TargetPicker({
  targets,
  onChange,
}: {
  targets: FocusTargets;
  onChange: (targets: FocusTargets) => void;
}) {
  const { days, status } = useWellbeingUsage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const apps = useMemo(() => {
    const index = new Map<string, string>();
    for (const day of days)
      for (const app of day.apps) index.set(app.packageName, app.label);
    for (const id of targets.apps) if (!index.has(id)) index.set(id, id);
    return Array.from(index, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [days, targets.apps]);
  const categories = [
    ...new Set([
      ...days.flatMap((d) => d.apps.map((a) => a.category)),
      ...targets.categories,
    ]),
  ]
    .filter(Boolean)
    .sort();
  function toggle(key: keyof FocusTargets, value: string) {
    const next = targets[key].includes(value)
      ? targets[key].filter((v) => v !== value)
      : [...targets[key], value];
    onChange({ ...targets, [key]: next });
  }
  const canSelect = status?.supported && status.granted && status.enabled;
  const selected = hasTargets(targets);
  return (
    <View style={{ gap: 8 }}>
      <Label small>
        {selected
          ? targets.apps.length +
            " apps · " +
            targets.categories.length +
            " categories selected"
          : "Timer only"}
      </Label>
      {canSelect || selected ? (
        <Btn
          title={open ? "Close targets" : "Choose apps or categories"}
          onPress={() => setOpen(!open)}
        />
      ) : (
        <Label small>
          {status?.supported
            ? "Turn on usage access and collection to choose device targets."
            : "App and category targets are available on supported Android devices."}
        </Label>
      )}
      {open && (
        <>
          <Label bold>Categories</Label>
          <Row>
            {categories.map((cat) => (
              <Btn
                key={cat}
                title={cat}
                selected={targets.categories.includes(cat)}
                onPress={() => toggle("categories", cat)}
              />
            ))}
          </Row>
          <Label bold>Apps</Label>
          {apps.length > 0 ? (
            <Field
              label="Find an app"
              value={search}
              onChangeText={setSearch}
            />
          ) : (
            <Label small>
              Apps appear here after this device records usage.
            </Label>
          )}
          <Row>
            {apps
              .filter(
                (a) =>
                  a.label.toLowerCase().includes(search.toLowerCase()) ||
                  a.id.includes(search.toLowerCase()),
              )
              .map((a) => (
                <Btn
                  key={a.id}
                  title={a.label}
                  hint={a.label + ", " + a.id}
                  selected={targets.apps.includes(a.id)}
                  onPress={() => toggle("apps", a.id)}
                />
              ))}
          </Row>
        </>
      )}
    </View>
  );
}

function FocusEditor({
  existing,
  targets: initialTargets,
  onDone,
}: {
  existing?: FocusSchedule;
  targets?: FocusTargets;
  onDone: () => void;
}) {
  const [repeat, setRepeat] = useState(Boolean(existing));
  const [name, setName] = useState(existing?.name ?? "");
  const [duration, setDuration] = useState(
    String(existing?.durationMinutes ?? 25),
  );
  const [time, setTime] = useState(existing?.time ?? "09:00");
  const [days, setDays] = useState(existing?.days ?? [1, 2, 3, 4, 5]);
  const [targets, setTargets] = useState(initialTargets ?? timerOnly);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState("");
  const minutes = Number(duration);
  const needsTargets = Boolean(
    existing?.requiresTargets &&
    !hasTargets(initialTargets ?? timerOnly()) &&
    !hasTargets(targets),
  );
  const valid =
    focusDuration.safeParse(minutes).success &&
    (!repeat || days.length > 0) &&
    !needsTargets;
  async function submit() {
    if (lock.current || !valid) return;
    lock.current = true;
    setSaving(true);
    try {
      const title = name.trim() || "Focus session";
      if (repeat)
        await saveFocusSchedule(
          { name: title, durationMinutes: minutes, time, days },
          targets,
          existing?.id,
        );
      else await startFocus(title, minutes, targets);
      setNotice(repeat ? "Schedule saved." : "Session started.");
      onDone();
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <Panel title={existing ? "Edit schedule" : "New session"}>
      {!existing && (
        <Row>
          <Btn
            title="Start now"
            selected={!repeat}
            onPress={() => {
              setRepeat(false);
              setNotice("");
            }}
          />
          <Btn
            title="Schedule"
            selected={repeat}
            onPress={() => {
              setRepeat(true);
              setNotice("");
            }}
          />
        </Row>
      )}
      <Field
        label="Session name"
        placeholder="Focus session"
        value={name}
        maxLength={120}
        onChangeText={setName}
      />
      <Field
        label="Duration in minutes"
        keyboardType="number-pad"
        value={duration}
        onChangeText={setDuration}
      />
      {!focusDuration.safeParse(minutes).success && (
        <Label small>Enter a whole number from 1 to 1,440.</Label>
      )}
      {repeat && (
        <>
          <Label small>Repeat on</Label>
          <Row>
            {weekdays.map((day, i) => (
              <Btn
                key={day}
                title={day}
                selected={days.includes(i)}
                onPress={() =>
                  setDays(
                    days.includes(i)
                      ? days.filter((v) => v !== i)
                      : [...days, i].sort(),
                  )
                }
              />
            ))}
          </Row>
          <Label small>Local start time</Label>
          <Picker mode="time" value={time} onChange={setTime} />
        </>
      )}
      <TargetPicker targets={targets} onChange={setTargets} />
      {needsTargets && (
        <Label small>
          Choose device targets to activate this restored schedule.
        </Label>
      )}
      <Row>
        <Btn
          primary
          title={repeat ? "Save schedule" : "Start focus"}
          disabled={saving || !valid}
          onPress={submit}
        />
        {existing && <Btn title="Cancel editing" onPress={onDone} />}
      </Row>
      {notice && <Label small>{notice}</Label>}
    </Panel>
  );
}

export function FocusPanel() {
  const rows = useHub((s) => s.rows);
  const { sessions, schedules, bindings } = useMemo(
    () => selectFocus(rows),
    [rows],
  );
  const format = useTimeFormat();
  const [edit, setEdit] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const active = sessions
    .filter((s) => s.status === "active")
    .sort((a, b) => a.endAt - b.endAt);
  const history = sessions
    .filter((s) => s.endedAt !== undefined)
    .sort((a, b) => b.endedAt! - a.endedAt!);
  const editing = schedules.find((s) => s.id === edit);
  return (
    <>
      {active.map((s) => (
        <ActiveSession key={s.id} session={s} />
      ))}
      <FocusEditor
        key={editing?.id ?? "new"}
        existing={editing}
        targets={editing && bindings.get(editing.id)?.targets}
        onDone={() => setEdit(null)}
      />
      <Panel title="Schedules">
        {schedules.length === 0 && (
          <Label small>No recurring sessions yet.</Label>
        )}
        {schedules.map((s) => {
          const next = sessions.find(
            (v) => v.scheduleId === s.id && v.status === "scheduled",
          );
          const needsTargets =
            s.requiresTargets &&
            !hasTargets(bindings.get(s.id)?.targets ?? timerOnly());
          return (
            <View key={s.id} style={{ gap: 6 }}>
              <Label bold>{s.name}</Label>
              <Label small>
                {s.days
                  .slice()
                  .sort()
                  .map((d) => weekdays[d])
                  .join(", ")}{" "}
                · {formatTime(s.time, format)} · {s.durationMinutes} min
              </Label>
              {needsTargets ? (
                <Label small>Paused until you reselect device targets.</Label>
              ) : (
                next && (
                  <Label small>Next · {dateTime(next.startAt, format)}</Label>
                )
              )}
              {remove === s.id ? (
                <>
                  <Label>Remove this schedule?</Label>
                  <Row>
                    <Btn
                      title="Keep schedule"
                      onPress={() => setRemove(null)}
                    />
                    <Btn
                      title="Confirm removal"
                      onPress={async () => {
                        await removeFocusSchedule(s.id);
                        setRemove(null);
                      }}
                    />
                  </Row>
                </>
              ) : (
                <Row>
                  <Btn
                    title={needsTargets ? "Reselect targets" : "Edit schedule"}
                    onPress={() => setEdit(s.id)}
                  />
                  <Btn
                    title="Remove schedule"
                    onPress={() => setRemove(s.id)}
                  />
                </Row>
              )}
            </View>
          );
        })}
      </Panel>
      <Panel title="Session history">
        {history.length === 0 && (
          <Label small>Your finished sessions will appear here.</Label>
        )}
        {history.slice(0, limit).map((s) => (
          <View key={s.id}>
            <Label bold>{s.name}</Label>
            <Label small>
              {s.status === "completed" ? "Completed" : "Interrupted"} ·{" "}
              {Math.floor((s.endedAt! - s.startAt) / 60000)} min ·{" "}
              {dateTime(s.startAt, format)}
            </Label>
          </View>
        ))}
        {history.length > limit && (
          <Btn
            title="Show more sessions"
            onPress={() => setLimit(limit + 10)}
          />
        )}
      </Panel>
    </>
  );
}

export function FocusSummary() {
  const rows = useHub((s) => s.rows);
  const { sessions } = selectFocus(rows);
  const format = useTimeFormat();
  const active = sessions
    .filter((s) => s.status === "active")
    .sort((a, b) => a.endAt - b.endAt);
  const next = sessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.startAt - b.startAt)[0];
  return (
    <Panel title="Focus">
      {active.length ? (
        <>
          <Label bold>{active[0].name}</Label>
          <Label small>
            {active.length > 1 ? active.length + " active · " : ""}Ends{" "}
            {dateTime(active[0].endAt, format)}
          </Label>
        </>
      ) : next ? (
        <>
          <Label bold>{next.name}</Label>
          <Label small>Next · {dateTime(next.startAt, format)}</Label>
        </>
      ) : (
        <Label small>No session scheduled.</Label>
      )}
      <Row>
        <Btn
          title={active.length ? "Open focus" : "Start focus"}
          icon="time"
          onPress={() =>
            router.push({
              pathname: "/wellbeing",
              params: { section: "focus" },
            })
          }
        />
      </Row>
    </Panel>
  );
}
