import { Icon } from "../hub/icons";
import { formatDate } from "../hub/format-date";
import { formatTime } from "../hub/format-time";
import { SwipeToDelete } from "./swipe-to-delete";
import { WeekChart } from "./week-chart";
import { Touch, Reveal } from "../hub/motion";
import { CalendarSwipe } from "../hub/gestures";
import React, { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { settings, useHub, useTimeFormat } from "../hub/storage";
import { selectReminders } from "./records";
import {
  Add,
  Btn,
  Label,
  Page,
  Panel,
  Row,
  run,
  useColors,
  useNow,
} from "../hub/ui";
import {
  Item,
  dayKey,
  itemsOn,
  localDay,
  shiftDay,
  matches,
  scheduledDays,
} from "./model";
import { toggle } from "./actions";
export function add(date: string) {
  router.push({ pathname: "/edit", params: { date } });
}
export function List({
  items,
  today,
  swipeToDelete = false,
}: {
  items: Item[];
  today: string;
  swipeToDelete?: boolean;
}) {
  const c = useColors();
  const timeFormat = useTimeFormat();
  if (!items.length)
    return (
      <View
        style={{
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{ backgroundColor: c.wash, padding: 12, borderRadius: 16 }}
        >
          <Icon name="calendar" color={c.accent} />
        </View>
        <Label small>No reminders for this day.</Label>
      </View>
    );
  return (
    <View style={{ gap: 9 }}>
      {items.map((i) => {
        const complete = !!i.event?.completed;
        const status = i.missed
          ? "Missed"
          : !complete && i.details.date < today
            ? "Overdue · " + formatDate(i.details.date)
            : "";
        const row = (
          <Reveal
            key={i.key}
            style={{
              backgroundColor: c.bg,
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 10,
              borderColor: c.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Touch
              feedback
              accessibilityRole="checkbox"
              accessibilityLabel={i.details.title}
              accessibilityState={{ checked: complete }}
              onPress={() => run(() => toggle(i))}
              style={{
                width: 44,
                minHeight: 52,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Reveal key={complete ? "complete" : "pending"}>
                <View
                  style={{
                    width: 25,
                    height: 25,
                    borderRadius: 13,
                    borderWidth: 1.5,
                    borderColor: c.accent,
                    backgroundColor: complete ? c.accentFill : c.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {complete && (
                    <Icon name="check" size={17} color={c.onAccent} />
                  )}
                </View>
              </Reveal>
            </Touch>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={"Edit " + i.details.title}
              onPress={() =>
                router.push({
                  pathname: "/edit",
                  params: { series: i.series.id, original: i.original },
                })
              }
              style={{ flex: 1, paddingVertical: 14, gap: 6 }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {i.details.star && (
                  <Icon name="star" size={16} color={c.accent} filled />
                )}
                <Text
                  style={{
                    flexShrink: 1,
                    fontWeight: "600",
                    fontSize: 18,
                    color: complete ? c.muted : c.fg,
                    textDecorationLine: complete ? "line-through" : "none",
                  }}
                >
                  {i.details.title}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  columnGap: 10,
                  rowGap: 4,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Icon
                    name={i.details.time ? "time" : "light"}
                    size={14}
                    color={c.muted}
                  />
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 13,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {i.details.time
                      ? formatTime(i.details.time, timeFormat)
                      : "All day"}
                  </Text>
                </View>
                {i.series.rule.kind !== "once" && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon name="repeat" size={14} color={c.muted} />
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 13,
                        textTransform: "capitalize",
                      }}
                    >
                      {i.series.rule.kind}
                    </Text>
                  </View>
                )}
                {!!status && (
                  <Text
                    style={{ color: c.danger, fontSize: 13, fontWeight: "600" }}
                  >
                    {status}
                  </Text>
                )}
              </View>
              {!!i.details.note && (
                <Text
                  numberOfLines={1}
                  style={{ color: c.muted, fontSize: 14 }}
                >
                  {i.details.note}
                </Text>
              )}
            </Touch>
          </Reveal>
        );
        return swipeToDelete ? (
          <SwipeToDelete key={i.key} item={i}>
            {row}
          </SwipeToDelete>
        ) : (
          row
        );
      })}
    </View>
  );
}
export function TodayWidget() {
  const c = useColors();
  const rows = useHub((s) => s.rows),
    now = useNow(),
    today = dayKey(now);
  const items = itemsOn(
    selectReminders(rows),
    today,
    today,
    now,
    settings(rows).morning,
  );
  const done = items.filter((item) => !!item.event?.completed).length;
  return (
    <Panel title="Today's reminders">
      {items.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label small>
            {done} of {items.length} complete
          </Label>
          <View
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: c.wash,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 5,
                width: `${(100 * done) / items.length}%`,
                backgroundColor: c.accent,
              }}
            />
          </View>
        </View>
      )}
      <List items={items} today={today} swipeToDelete />
    </Panel>
  );
}
export function ReminderShortcuts() {
  return (
    <Panel title="Shortcuts">
      <Row>
        <Btn
          icon="calendar"
          title="Open Reminders"
          onPress={() => router.push("/reminders")}
        />
        <Btn
          primary
          icon="plus"
          title="Add reminder"
          onPress={() => add(dayKey(new Date()))}
        />
      </Row>
    </Panel>
  );
}
export function CompletionInsights() {
  const rows = useHub((s) => s.rows),
    now = useNow(),
    today = dayKey(now);
  const d = selectReminders(rows),
    start = shiftDay(today, -6);
  const completed = [...d.events.values()].filter(
    (e) =>
      e.completed &&
      !e.removed &&
      d.series.some((s) => s.id === e.series && matches(s, e.original)),
  );
  const week = completed.filter((e) => {
    const day = dayKey(new Date(e.completed!));
    return day >= start && day <= today;
  });
  return (
    <WeekChart
      days={Array.from({ length: 7 }, (_, i) => {
        const date = shiftDay(start, i);
        return {
          date,
          count: week.filter((e) => dayKey(new Date(e.completed!)) === date)
            .length,
        };
      })}
      total={completed.length}
    />
  );
}
export function CalendarScreen() {
  const now = useNow(),
    today = dayKey(now),
    rows = useHub((s) => s.rows),
    c = useColors();
  const [selected, select] = useState(today),
    [month, expand] = useState(false),
    [filter, setFilter] = useState<string | null>(null);
  const d = localDay(selected),
    first = month
      ? dayKey(new Date(d.getFullYear(), d.getMonth(), 1))
      : selected;
  const start = shiftDay(first, -((localDay(first).getDay() + 6) % 7));
  const days = month
    ? Math.ceil(
        (((localDay(first).getDay() + 6) % 7) +
          new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) /
          7,
      ) * 7
    : 7;
  function move(n: number) {
    select(
      month
        ? dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
        : shiftDay(selected, n * 7),
    );
  }
  const lists = rows.filter((r) => r.kind === "reminders.list" && !r.deleted),
    source = useMemo(() => selectReminders(rows), [rows]);
  const marked = useMemo(
    () => (month ? scheduledDays(source, start, days, filter) : null),
    [month, source, start, days, filter],
  );
  return (
    <Page title="Reminders" footer={<Add onPress={() => add(selected)} />}>
      <Panel>
        <Row>
          <Btn
            hint={month ? "Previous month" : "Previous week"}
            title="Previous"
            icon="previous"
            iconOnly
            onPress={() => move(-1)}
          />
          <Btn
            title={d.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
            icon={month ? "up" : "down"}
            onPress={() => expand(!month)}
          />
          <Btn
            hint={month ? "Next month" : "Next week"}
            title="Next"
            icon="next"
            iconOnly
            onPress={() => move(1)}
          />
          <Btn title="Today" onPress={() => select(today)} />
        </Row>
        <CalendarSwipe onPage={move}>
          <Reveal
            key={start + String(month)}
            style={{ flexDirection: "row", flexWrap: "wrap" }}
          >
            {month &&
              Array.from({ length: 7 }, (_, i) => (
                <Text
                  key={"weekday-" + i}
                  style={{
                    width: "14.28%",
                    textAlign: "center",
                    color: c.muted,
                    fontSize: 12,
                    paddingVertical: 6,
                  }}
                >
                  {localDay(shiftDay(start, i)).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </Text>
              ))}
            {Array.from({ length: days }, (_, i) => {
              const k = shiftDay(start, i),
                dt = localDay(k),
                on = k === selected;
              return (
                <Touch
                  key={k}
                  accessibilityRole="button"
                  feedback
                  accessibilityLabel={formatDate(k)}
                  accessibilityHint={
                    [k === today && "Today", marked?.has(k) && "Has reminders"]
                      .filter(Boolean)
                      .join(". ") || undefined
                  }
                  accessibilityState={{ selected: on }}
                  onPress={() => select(k)}
                  style={{
                    width: "14.28%",
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 44,
                    borderWidth: 1,
                    borderColor: k === today ? c.accent : "transparent",
                    borderRadius: 12,
                    backgroundColor: on ? c.accentFill : c.surface,
                  }}
                >
                  {!month && (
                    <Text
                      style={{ color: on ? c.onAccent : c.muted, fontSize: 12 }}
                    >
                      {dt.toLocaleDateString(undefined, { weekday: "narrow" })}
                    </Text>
                  )}
                  <Text style={{ color: on ? c.onAccent : c.fg, fontSize: 18 }}>
                    {dt.getDate()}
                  </Text>
                  {marked?.has(k) && (
                    <View
                      testID={"reminder-dot-" + k}
                      style={{
                        position: "absolute",
                        bottom: 4,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: on ? c.onAccent : c.accent,
                      }}
                    />
                  )}
                </Touch>
              );
            })}
          </Reveal>
        </CalendarSwipe>
      </Panel>
      {lists.length > 0 && (
        <Row>
          <Btn
            title="All lists"
            selected={!filter}
            onPress={() => setFilter(null)}
          />
          {lists.map(
            (r) =>
              r.kind === "reminders.list" && (
                <Btn
                  key={r.id}
                  title={r.value.name}
                  selected={filter === r.id}
                  onPress={() => setFilter(r.id)}
                />
              ),
          )}
        </Row>
      )}
      <Panel title={formatDate(selected)}>
        <List
          items={itemsOn(
            source,
            selected,
            today,
            now,
            settings(rows).morning,
          ).filter((i) => !filter || i.details.list === filter)}
          today={today}
          swipeToDelete
        />
      </Panel>
    </Page>
  );
}
