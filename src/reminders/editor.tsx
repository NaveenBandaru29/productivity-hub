import { Reveal } from "../hub/motion";
import { RepeatFields, repeatLabels } from "./repeat-fields";
import { quickAdd } from "./quick-add";
import React, { useRef, useState } from "react";
import { Alert, Platform, TextInput, View, Switch, Text } from "react-native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useHub, write } from "../hub/storage";
import { selectReminders, eventRow } from "./records";
import type { Row as StoredRow } from "../hub/backup";
import { requestAlerts } from "../hub/notifications";
import { Page, Panel, Field, Btn, Row, Label, run, useColors } from "../hub/ui";
import { Icon, type IconName } from "../hub/icons";
import { Picker } from "../hub/picker";
import { saveReminder, remove } from "./actions";
import {
  Details,
  Rule,
  detailsSchema,
  ruleSchema,
  dayKey,
  itemAt,
  emptyEvent,
  dateSchema,
} from "./model";
function ScheduleRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name={icon} size={19} color={c.accent} />
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: "500" }}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function Editor() {
  const p = useLocalSearchParams<{
    date?: string;
    original?: string;
    series?: string;
    action?: string;
  }>();
  const rows = useHub((s) => s.rows),
    d = selectReminders(rows),
    s = d.series.find((x) => x.id === p.series);
  const item = s && p.original ? itemAt(s, p.original, d.events) : undefined;
  const today = dayKey(new Date()),
    selected = dateSchema.safeParse(p.date).success ? p.date! : today;
  const [details, set] = useState<Details>(
    () =>
      item?.details ?? {
        title: "",
        date: selected,
        time: null,
        list: null,
        note: "",
        star: false,
      },
  );
  const [titleError, setTitleError] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [rule, setRule] = useState<Rule>(item?.series.rule ?? { kind: "once" });
  const [scope, scopeSet] = useState<"one" | "future">("one"),
    [text, setText] = useState(""),
    [quick, setQuick] = useState(false);
  const [note, showNote] = useState(!!details.note),
    [listName, setName] = useState(""),
    [newList, setNewList] = useState(false);
  const [busy, setBusy] = useState(false),
    lock = useRef(false);
  const c = useColors();
  const [showLists, setShowLists] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const selectedList = rows.find(
    (r) => r.kind === "reminders.list" && r.id === details.list && !r.deleted,
  );
  const listLabel = newList
    ? listName.trim() || "New list"
    : selectedList?.kind === "reminders.list"
      ? selectedList.value.name
      : "List";
  const repeatEditable =
    !item || item.series.rule.kind === "once" || scope === "future";
  function field<K extends keyof Details>(k: K, v: Details[K]) {
    set((current) => ({ ...current, [k]: v }));
  }
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/reminders");
  }
  async function guarded(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    const parsed = detailsSchema.safeParse(details);
    if (!parsed.success) {
      setTitleError(true);
      return;
    }
    const extra: StoredRow[] = [];
    if (newList && listName.trim()) {
      const existing = rows.find(
        (r) =>
          r.kind === "reminders.list" &&
          !r.deleted &&
          r.value.name.toLowerCase() === listName.trim().toLowerCase(),
      );
      const id = existing?.id ?? randomUUID();
      parsed.data.list = id;
      if (!existing)
        extra.push({
          kind: "reminders.list",
          id,
          updated: 0,
          deleted: false,
          value: { name: listName.trim() },
        });
    }
    await saveReminder(parsed.data, ruleSchema.parse(rule), item, scope, extra);
    close();
    await requestAlerts();
  }
  if (p.series && !item)
    return (
      <Page narrow title="Reminder unavailable">
        <Btn title="Back to Reminders" onPress={close} />
      </Page>
    );
  if (p.action === "snooze" && item)
    return (
      <Page
        narrow
        title="Snooze reminder"
        headerAction={
          <Btn title="Close reminder" icon="close" iconOnly onPress={close} />
        }
      >
        <Label>{item.details.title}</Label>
        {[5, 10, 15].map((minutes) => (
          <Btn
            key={minutes}
            title={minutes + " minutes"}
            disabled={busy}
            onPress={() =>
              guarded(async () => {
                await write([
                  eventRow({
                    ...(item.event ??
                      emptyEvent(item.series.id, item.original)),
                    snooze: Date.now() + minutes * 60000,
                  }),
                ]);
                close();
              })
            }
          />
        ))}
      </Page>
    );
  return (
    <Page
      narrow
      title={item ? "Edit reminder" : "New reminder"}
      headerAction={
        <Btn title="Close reminder" icon="close" iconOnly onPress={close} />
      }
    >
      <Panel>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              backgroundColor: c.wash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bell" color={c.accent} size={24} />
          </View>
          <Row>
            {!item && (
              <Btn
                icon="quick"
                title="Quick Add"
                selected={quick}
                onPress={() => setQuick(!quick)}
              />
            )}
            <Btn
              icon="star"
              iconOnly
              title={details.star ? "Unstar reminder" : "Star reminder"}
              selected={details.star}
              onPress={() => field("star", !details.star)}
            />
          </Row>
        </View>
        {quick && (
          <Reveal style={{ gap: 8 }}>
            <Field
              autoFocus
              label="Quick Add"
              placeholder="Pay rent tomorrow at 9 AM"
              value={text}
              onChangeText={setText}
            />
            <Btn
              title="Preview in form"
              icon="arrow"
              disabled={!text.trim()}
              onPress={() => {
                set((v) => ({ ...v, ...quickAdd(text, selected, today) }));
                setQuick(false);
                setTitleError(false);
              }}
            />
          </Reveal>
        )}
        <TextInput
          accessibilityLabel="Title"
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          autoFocus={!item}
          placeholder="Reminder title"
          placeholderTextColor={c.muted}
          value={details.title}
          onChangeText={(value) => {
            field("title", value);
            setTitleError(false);
          }}
          style={{
            color: c.fg,
            fontSize: 27,
            fontWeight: "600",
            letterSpacing: -0.8,
            minHeight: 58,
            paddingVertical: 8,
            paddingHorizontal: 2,
            borderBottomWidth: 1,
            outlineWidth: 0,
            borderColor: titleError
              ? c.danger
              : titleFocused
                ? c.accent
                : c.border,
          }}
        />
        {titleError && (
          <Text accessibilityRole="alert" style={{ color: c.danger }}>
            Give this reminder a title before saving.
          </Text>
        )}
        <Row>
          <Btn
            icon="note"
            title="Note"
            selected={note}
            onPress={() => showNote(!note)}
          />
          <Btn
            icon="list"
            title={listLabel}
            hint="Choose list"
            selected={showLists || !!details.list || newList}
            onPress={() => setShowLists(!showLists)}
          />
        </Row>
        {note && (
          <Reveal>
            <Field
              label="Note"
              multiline
              placeholder="Add a detail…"
              value={details.note}
              onChangeText={(v) => field("note", v)}
            />
          </Reveal>
        )}
        {showLists && (
          <Reveal style={{ gap: 8 }}>
            <Row>
              <Btn
                title="No list"
                selected={!details.list && !newList}
                onPress={() => {
                  field("list", null);
                  setNewList(false);
                }}
              />
              {rows.map(
                (r) =>
                  r.kind === "reminders.list" &&
                  !r.deleted && (
                    <Btn
                      key={r.id}
                      title={r.value.name}
                      selected={!newList && details.list === r.id}
                      onPress={() => {
                        field("list", r.id);
                        setNewList(false);
                      }}
                    />
                  ),
              )}
              <Btn
                title="New list"
                selected={newList}
                onPress={() => setNewList(!newList)}
              />
            </Row>
            {newList && (
              <Field
                label="New list name"
                value={listName}
                onChangeText={setName}
              />
            )}
          </Reveal>
        )}
      </Panel>
      {item && item.series.rule.kind !== "once" && (
        <>
          <Label small>Apply changes to</Label>
          <Row>
            <Btn
              title="Just this one"
              selected={scope === "one"}
              onPress={() => scopeSet("one")}
            />
            <Btn
              title="This and future reminders"
              selected={scope === "future"}
              onPress={() => scopeSet("future")}
            />
          </Row>
        </>
      )}
      <Panel>
        <ScheduleRow icon="calendar" label="Date">
          <Picker
            mode="date"
            value={details.date}
            onChange={(v) => field("date", v)}
          />
        </ScheduleRow>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <ScheduleRow icon="light" label="All day">
          <Switch
            accessibilityLabel="All day"
            value={!details.time}
            onValueChange={(allDay) => field("time", allDay ? null : "09:00")}
            trackColor={{ true: c.accentFill, false: c.border }}
            thumbColor={details.time ? c.muted : c.onAccent}
            {...(Platform.OS === "web" && { activeThumbColor: c.onAccent })}
          />
        </ScheduleRow>
        {details.time && (
          <Reveal>
            <ScheduleRow icon="time" label="Time">
              <Picker
                mode="time"
                value={details.time}
                onChange={(v) => field("time", v)}
              />
            </ScheduleRow>
          </Reveal>
        )}
        {repeatEditable && (
          <>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <ScheduleRow icon="repeat" label="Repeat">
              <Btn
                title={repeatLabels[rule.kind]}
                hint="Change repeat schedule"
                icon={showRepeat ? "up" : "down"}
                onPress={() => setShowRepeat(!showRepeat)}
              />
            </ScheduleRow>
            {showRepeat && (
              <Reveal style={{ gap: 8 }}>
                <RepeatFields
                  rule={rule}
                  date={details.date}
                  onChange={setRule}
                />
              </Reveal>
            )}
          </>
        )}
      </Panel>
      <Btn
        primary
        icon="check"
        title={busy ? "Saving…" : "Save reminder"}
        disabled={busy}
        onPress={() => guarded(save)}
      />
      {item && (
        <Btn
          icon="delete"
          title="Delete reminder"
          disabled={busy}
          onPress={() => {
            if (Platform.OS === "web") {
              if (
                window.confirm(
                  scope === "future"
                    ? "Delete this and future reminders?"
                    : "Delete this reminder?",
                )
              )
                return guarded(async () => {
                  await remove(item, scope);
                  close();
                });
              return;
            }
            return Alert.alert(
              "Delete reminder?",
              scope === "future"
                ? "This and future reminders will be removed."
                : "This reminder will be removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    run(() =>
                      guarded(async () => {
                        await remove(item, scope);
                        close();
                      }),
                    ),
                },
              ],
            );
          }}
        />
      )}
    </Page>
  );
}
