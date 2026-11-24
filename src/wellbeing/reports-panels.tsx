import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useHub, useTimeFormat } from "../hub/storage";
import { Btn, Label, Panel, Row, useColors, useNow } from "../hub/ui";
import { Touch } from "../hub/motion";
import { dayKey, localDay, shiftDay } from "../reminders/model";
import { formatDate } from "../hub/format-date";
import { clockTime, formatTime } from "../hub/format-time";
import { useWellbeingUsage } from "./usage-context";
import {
  comparison,
  coverageLabel,
  duration,
  periodDates,
  periodTitles,
  summarize,
  type Period,
} from "./reports";
import type { UsageDay } from "./usage";
import { completedFocusCount } from "./focus-model";

function openSection(section: string, extra?: Record<string, string>) {
  router.push({ pathname: "/wellbeing", params: { section, ...extra } });
}

function UsageState() {
  const { status, loading, error, refresh } = useWellbeingUsage();
  const message = error
    ? error
    : loading
      ? "Loading usage history…"
      : !status?.supported
        ? "Device usage is available in the Android development or production build."
        : status.locked
          ? "Unlock your device to refresh usage."
          : !status.granted
            ? "Grant Usage Access in Android settings to see your activity."
            : !status.enabled
              ? "Turn on local tracking to see your activity."
              : "No usage history for this period.";
  return (
    <View style={{ gap: 8 }}>
      <Label small>{message}</Label>
      {error ? (
        <Btn title="Retry" onPress={refresh} />
      ) : (
        !!status?.supported &&
        (!status.granted || !status.enabled) && (
          <Btn
            title="Tracking settings"
            onPress={() => openSection("settings")}
          />
        )
      )}
    </View>
  );
}

export function CoverageNote({ dates }: { dates: string[] }) {
  const { days, status, error } = useWellbeingUsage();
  const timeFormat = useTimeFormat();
  if (!status) return null;
  const latest = Math.max(
    0,
    ...days
      .filter((d) => dates.includes(d.date))
      .map((d) => d.coverageEnd ?? 0),
  );
  let reason = "";
  if (error) reason = "Refresh failed. Showing saved usage.";
  else if (status.locked) reason = "Android usage data is locked.";
  else if (!status.granted) reason = "Usage Access is off.";
  else if (!status.enabled) reason = "Tracking is paused.";
  if (!latest) return null;
  const end = new Date(latest);
  return (
    <Label small>
      {reason && reason + " "}Recorded through {formatDate(end)} at{" "}
      {formatTime(clockTime(end.getHours(), end.getMinutes()), timeFormat)}.
    </Label>
  );
}

function Total({ ms }: { ms: number }) {
  const c = useColors();
  return (
    <Text
      style={{
        color: c.fg,
        fontSize: 34,
        fontWeight: "700",
        letterSpacing: -1.4,
        fontVariant: ["tabular-nums"],
      }}
    >
      {duration(ms)}
    </Text>
  );
}

function Trend({
  days,
  period,
  today,
}: {
  days: UsageDay[];
  period: Period;
  today: string;
}) {
  const match = comparison(days, period, today);
  if (!match)
    return (
      <Label small>Comparison needs matching coverage in both periods.</Label>
    );
  const diff = match.current - match.prior;
  const direction =
    diff === 0
      ? "No change"
      : duration(Math.abs(diff)) + (diff > 0 ? " more" : " less");
  return (
    <Label small>
      {direction} {match.label}
    </Label>
  );
}

function DailyChart({
  days,
  dates,
  packageName,
}: {
  days: UsageDay[];
  dates: string[];
  packageName?: string;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<string | null>(null);
  const bars = dates.map((date) => {
    const day = days.find((d) => d.date === date);
    const missing = !day || day.coverage === "unavailable";
    const value = missing
      ? null
      : packageName
        ? (day.apps.find((app) => app.packageName === packageName)
            ?.durationMs ?? 0)
        : day.totalMs;
    return { date, value, partial: day?.coverage === "partial" };
  });
  const peak = Math.max(1, ...bars.map((bar) => bar.value ?? 0));
  const describe = (bar: (typeof bars)[number]) =>
    formatDate(bar.date) +
    " · " +
    (bar.value === null
      ? "Unavailable"
      : duration(bar.value) + (bar.partial ? " · partial" : ""));
  const active = bars.find((bar) => bar.date === selected);
  return (
    <View style={{ gap: 6 }}>
      {Array.from({ length: Math.ceil(bars.length / 7) }, (_, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 4 }}>
          {bars.slice(index * 7, (index + 1) * 7).map((bar) => (
            <Touch
              key={bar.date}
              accessibilityRole="button"
              accessibilityLabel={describe(bar)}
              accessibilityState={{ selected: bar.date === selected }}
              onPress={() => setSelected(bar.date)}
              style={{
                flexBasis: "13%",
                flexShrink: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                paddingVertical: 4,
                minHeight: 72,
                borderRadius: 6,
                backgroundColor: bar.date === selected ? c.wash : c.surface,
              }}
            >
              {bar.value !== null ? (
                <View
                  style={{
                    height: Math.max(2, (bar.value / peak) * 45),
                    width: "52%",
                    borderRadius: 4,
                    backgroundColor: c.accent,
                  }}
                />
              ) : (
                <Text style={{ color: c.muted }}>–</Text>
              )}
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {localDay(bar.date).getDate()}
              </Text>
            </Touch>
          ))}
        </View>
      ))}
      <Label small>
        {active
          ? describe(active)
          : formatDate(dates[0]) +
            " – " +
            formatDate(dates[dates.length - 1]) +
            " · Tap a day for details"}
      </Label>
    </View>
  );
}

function Summary({
  period,
  title,
  chart,
  shortcut,
}: {
  period: Period;
  title: string;
  chart?: boolean;
  shortcut?: boolean;
}) {
  const { days } = useWellbeingUsage();
  const today = dayKey(useNow());
  const dates = periodDates(period, today);
  const report = summarize(days, dates);
  const rows = useHub((s) => s.rows);
  const start = localDay(dates[0]);
  start.setHours(0, 0, 0, 0);
  const completed = chart
    ? completedFocusCount(rows, start.getTime(), Date.now() + 1)
    : 0;
  const dailyBudget = rows
    .flatMap((r) =>
      r.kind === "wellbeing.goal" &&
      !r.deleted &&
      r.value.period === "daily" &&
      r.value.startDate <= today &&
      (!r.value.endDate || r.value.endDate >= today)
        ? [r.value]
        : [],
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  return (
    <Panel title={title}>
      {report.observed ? (
        <>
          <Touch
            accessibilityRole="button"
            accessibilityLabel={"View screen time, " + duration(report.totalMs)}
            onPress={() => openSection("usage", { period })}
          >
            <Total ms={report.totalMs} />
          </Touch>
          <Row>
            <Btn
              title={report.unlocks + " unlocks"}
              onPress={() =>
                openSection("usage", { period, metric: "unlocks" })
              }
            />
            <Btn
              title={report.launches + " foreground entries (est.)"}
              onPress={() =>
                openSection("usage", { period, metric: "entries" })
              }
            />
          </Row>
          {chart && <DailyChart dates={dates} days={days} />}
          <Trend days={days} period={period} today={today} />
          {report.complete < report.expected && (
            <Label small>{coverageLabel(report)}</Label>
          )}
          <CoverageNote dates={dates} />
          {report.apps.length > 0 && (
            <View style={{ gap: 5 }}>
              <Label bold>Most used apps</Label>
              {report.apps.slice(0, 3).map((app) => (
                <Btn
                  key={app.packageName}
                  title={app.label + " · " + duration(app.durationMs)}
                  onPress={() =>
                    openSection("usage", { period, app: app.packageName })
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <UsageState />
      )}
      {period === "today" && (
        <Btn
          title={
            dailyBudget
              ? report.observed
                ? duration(
                    Math.max(0, dailyBudget.minutes * 60000 - report.totalMs),
                  ) +
                  " remaining of " +
                  duration(dailyBudget.minutes * 60000) +
                  (report.complete ? "" : " · partial usage")
                : "Daily budget " +
                  duration(dailyBudget.minutes * 60000) +
                  " · remaining unavailable"
              : "Set a daily budget"
          }
          onPress={() => openSection("goals")}
        />
      )}
      {chart && (
        <Btn
          title={
            completed +
            " completed focus " +
            (completed === 1 ? "session" : "sessions") +
            " this week"
          }
          onPress={() => openSection("goals")}
        />
      )}
      {shortcut && (
        <Btn
          title="View usage"
          icon="arrow"
          onPress={() => openSection("usage")}
        />
      )}
    </Panel>
  );
}
export function OverviewUsage() {
  return <Summary period="today" title="Screen time today" shortcut />;
}
export function TodayUsage() {
  return <Summary period="today" title="Today's screen time" shortcut />;
}
export function WeeklyUsage() {
  return <Summary period="week" title="Weekly screen time" chart shortcut />;
}

export function UsagePanel() {
  const { days } = useWellbeingUsage();
  const today = dayKey(useNow());
  const [period, setPeriod] = useState<Period>("today");
  const [rank, setRank] = useState<"duration" | "launches">("duration");
  const [selected, select] = useState<string | null>(null);
  const params = useLocalSearchParams<{
    period?: string;
    app?: string;
    metric?: string;
  }>();
  useEffect(() => {
    if (params.period && Object.hasOwn(periodTitles, params.period))
      setPeriod(params.period as Period);
    select(params.app ?? null);
    setRank(params.metric === "entries" ? "launches" : "duration");
  }, [params.app, params.metric, params.period]);
  const dates = periodDates(period, today);
  const report = summarize(days, dates);
  const apps =
    rank === "duration"
      ? report.apps
      : [...report.apps].sort(
          (a, b) => b.launches - a.launches || b.durationMs - a.durationMs,
        );
  const detail = apps.find((app) => app.packageName === selected);
  const colors = useColors();
  return (
    <>
      <Panel title="Usage">
        <Row>
          {(Object.keys(periodTitles) as Period[]).map((p) => (
            <Btn
              key={p}
              title={periodTitles[p]}
              selected={period === p}
              onPress={() => setPeriod(p)}
            />
          ))}
        </Row>
        {report.observed ? (
          <>
            <Total ms={report.totalMs} />
            <Label>
              {report.unlocks} unlocks · {report.launches} estimated foreground
              entries
            </Label>
            <Label small>{coverageLabel(report)}</Label>
            <CoverageNote dates={dates} />
            {dates.length > 1 ? (
              <DailyChart days={days} dates={dates} />
            ) : (
              report.apps.length > 0 && (
                <View style={{ gap: 7 }}>
                  <Label small>Screen time by app</Label>
                  {report.apps.slice(0, 5).map((app) => (
                    <Touch
                      key={app.packageName}
                      accessibilityRole="button"
                      accessibilityLabel={
                        app.label +
                        ", " +
                        duration(app.durationMs) +
                        ", view trend"
                      }
                      onPress={() => select(app.packageName)}
                      style={{
                        gap: 5,
                        minHeight: 44,
                        justifyContent: "center",
                      }}
                    >
                      <Label small>
                        {app.label} · {duration(app.durationMs)}
                      </Label>
                      <View
                        style={{
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: colors.wash,
                        }}
                      >
                        <View
                          style={{
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: colors.accent,
                            width: `${Math.min(100, (100 * app.durationMs) / Math.max(1, report.apps[0].durationMs))}%`,
                          }}
                        />
                      </View>
                    </Touch>
                  ))}
                </View>
              )
            )}
            <Trend days={days} today={today} period={period} />
          </>
        ) : (
          <UsageState />
        )}
      </Panel>
      {report.observed > 0 && (
        <Panel title="Apps">
          <Row>
            <Btn
              title="Screen time"
              selected={rank === "duration"}
              onPress={() => setRank("duration")}
            />
            <Btn
              title="Foreground entries"
              selected={rank === "launches"}
              onPress={() => setRank("launches")}
            />
          </Row>
          {apps.length ? (
            apps.map((app) => (
              <Btn
                key={app.packageName}
                title={
                  app.label +
                  " · " +
                  (rank === "duration"
                    ? duration(app.durationMs)
                    : app.launches + " est. entries")
                }
                selected={app.packageName === selected}
                onPress={() =>
                  select(app.packageName === selected ? null : app.packageName)
                }
              />
            ))
          ) : (
            <Label small>No app activity recorded.</Label>
          )}
        </Panel>
      )}
      {detail && (
        <Panel title={detail.label}>
          <Label>
            {duration(detail.durationMs)} · {detail.launches} estimated
            foreground {detail.launches === 1 ? "entry" : "entries"}
          </Label>
          <Label small>
            {detail.category} · {detail.packageName}
          </Label>
          <Label small>
            {dates.length === 1 ? "Seven-day usage trend" : "Usage trend"}
          </Label>
          <DailyChart
            days={days}
            dates={
              dates.length === 1
                ? Array.from({ length: 7 }, (_, i) => shiftDay(dates[0], i - 6))
                : dates
            }
            packageName={detail.packageName}
          />
          <Btn
            title="Set app limit"
            onPress={() =>
              openSection("limits", {
                target: detail.packageName,
                targetKind: "app",
              })
            }
          />
        </Panel>
      )}
      {report.categories.length > 0 && (
        <Panel title="Categories">
          <Label small>
            Apps used side by side can each accrue foreground time.
          </Label>
          {report.categories.map(([category, ms]) => (
            <Btn
              key={category}
              title={category + " · " + duration(ms)}
              hint={"Set limit for " + category + ", " + duration(ms)}
              onPress={() =>
                openSection("limits", {
                  target: category,
                  targetKind: "category",
                })
              }
            />
          ))}
        </Panel>
      )}
    </>
  );
}
