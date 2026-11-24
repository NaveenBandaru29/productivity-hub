import React from "react";
import { formatDate } from "../src/hub/format-date";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, render, screen, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as N from "expo-notifications";
import { router } from "expo-router";
import {
  initialize,
  write,
  restore,
  useHub,
  setSetting,
} from "../src/hub/storage";
import { seriesRow, selectReminders, eventRow } from "../src/reminders/records";
import { encodeBackup } from "../src/hub/backup";
import {
  reconcile,
  requestAlerts,
  handleResponse,
} from "../src/hub/notifications";
import {
  emptyEvent,
  dayKey,
  shiftDay,
  Series,
  itemAt,
} from "../src/reminders/model";
import { saveReminder } from "../src/reminders/actions";
import { CalendarScreen } from "../src/reminders/screens";
import Home from "../app/(tabs)/index";
import Apps from "../app/(tabs)/apps";
import { AppearancePanel } from "../src/hub/appearance";
import { settings } from "../src/hub/storage";
import { Editor } from "../src/reminders/editor";
import { recordSchema, type Row } from "../src/hub/backup";
import { nativeLimitPolicy } from "../src/wellbeing/limits";
import { handleResponse as handleModuleResponse } from "../src/hub/module-notifications";

jest.mock("expo-sqlite", () => {
  const db = new (
    process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite")
  ).DatabaseSync(":memory:");
  const tx = {
    getFirstAsync: async (sql: string, ...args: string[]) =>
      db.prepare(sql).get(...args),
    runAsync: async (sql: string, ...args: string[]) =>
      db.prepare(sql).run(...args),
  };
  return {
    openDatabaseAsync: async () => ({
      execAsync: async (sql: string) => db.exec(sql),
      getAllAsync: async (sql: string) => db.prepare(sql).all(),
      withExclusiveTransactionAsync: async (
        fn: (t: typeof tx) => Promise<void>,
      ) => {
        db.exec("BEGIN");
        try {
          await fn(tx);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    }),
  };
});
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { HIGH: 4 },
}));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("node:crypto").randomUUID(),
}));
jest.mock("@react-native-community/datetimepicker", () => () => null);
const title = "Pay electricity bill",
  id = "a014058d-31b3-4893-b28a-184b4190f308";
const today = dayKey(new Date()),
  future = shiftDay(today, 14);
const series: Series = {
  id,
  details: {
    date: future,
    title,
    time: "09:00",
    note: "",
    list: null,
    star: false,
  },
  end: null,
  rule: { kind: "once" },
};
beforeAll(initialize);
test("wellbeing backup keeps portable rules, preserves ties, and invalidates only changed device bindings", async () => {
  const ruleId = "05a574cb-2bf3-4414-9c16-c3dd0c252734";
  const limit: Row = {kind:"wellbeing.limit", id:ruleId, updated:0, deleted:false,
    value:{id:ruleId, targetKind:"app", minutes:30, enabled:true, warnAt80:true}};
  const binding: Row = {kind:"wellbeing.binding", id:ruleId, updated:0, deleted:false,
    value:{ruleId, target:"private.example", label:"Private app", extendedDate:null}};
  await write([limit, binding]);
  const original = useHub.getState().rows.filter(row => row.id === ruleId);
  const exported = encodeBackup(original);
  expect(JSON.parse(exported).version).toBe(2);
  expect(exported).not.toContain("private.example");
  await restore(exported);
  expect(nativeLimitPolicy(useHub.getState().rows)).toContainEqual(expect.objectContaining({id:ruleId, minutes:30}));

  const newer = {...limit, value:{...limit.value, minutes:45}, updated: Math.max(...original.map(row => row.updated)) + 1};
  const otherDevice = encodeBackup([newer]);
  await restore(otherDevice);
  expect(nativeLimitPolicy(useHub.getState().rows).some(rule => rule.id === ruleId)).toBe(false);
  const first = useHub.getState().rows.filter(row => row.id === ruleId);
  await restore(otherDevice);
  await initialize();
  expect(useHub.getState().rows.filter(row => row.id === ruleId)).toEqual(first);
  expect(first.find(row => row.kind === "wellbeing.limit")).toEqual(newer);
  expect(recordSchema.safeParse({...limit, id:"mismatch"}).success).toBe(false);
  expect(() => restore(JSON.stringify({app:"minimal-productivity-hub",version:2,records:[binding]}))).toThrow();
  expect(() => restore(JSON.stringify({app:"minimal-productivity-hub",version:1,records:[limit]}))).toThrow();
  await restore(JSON.stringify({app:"minimal-productivity-hub",version:1,records:[]}));
});
test("wellbeing alert opens its own destination", async () => {
  await handleModuleResponse({actionIdentifier:"open",notification:{request:{content:{data:{module:"wellbeing",section:"focus"},title:"",body:""},identifier:"",trigger:{}} as any},date:Date.now(),trigger:{}} as unknown as N.NotificationResponse);
  expect(router.push).toHaveBeenCalledWith({pathname:"/wellbeing",params:{section:"focus"}});
});
beforeEach(() => {
  jest.clearAllMocks();
  (N.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
  (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
});
test("SQLite restore merges by timestamp, retains ties and deletions, and survives reload", async () => {
  const initial = { ...seriesRow(series), updated: 10 };
  const unique = {
    ...seriesRow({ ...series, id: "f296d736-cdfd-4403-a34e-d3638c5a6c92" }),
    updated: 12,
  };
  const backup = encodeBackup([initial, unique]);
  await restore(backup);
  await write([
    seriesRow({
      ...series,
      details: { ...series.details, title: "Edited locally" },
    }),
  ]);
  const local = useHub.getState().rows.find((r) => r.id === id)!;
  await restore(encodeBackup([{ ...initial, updated: local.updated }]));
  expect(useHub.getState().rows.find((r) => r.id === id)).toEqual(local);
  await write([seriesRow(series, true)]);
  await restore(backup);
  const merged = useHub.getState().rows;
  await restore(backup);
  useHub.setState({ rows: [] });
  await initialize();
  expect(useHub.getState().rows).toEqual(merged);
  expect(merged.find((r) => r.id === id)?.deleted).toBe(true);
  expect(merged.some((r) => r.id === unique.id)).toBe(true);
});
test("denial preserves the reminder, recovery schedules it once, completion cancels it", async () => {
  await write([seriesRow(series)]);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  (N.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: false,
    canAskAgain: false,
  });
  await requestAlerts();
  expect(alert).toHaveBeenCalled();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(
    selectReminders(useHub.getState().rows).series.some((s) => s.id === id),
  ).toBe(true);
  (N.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  await reconcile();
  const scheduled = (N.scheduleNotificationAsync as jest.Mock).mock.calls.map(
    (c) => c[0],
  );
  const target = scheduled.find((n) => n.content.data.series === id);
  expect(target).toBeDefined();
  (N.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(
    scheduled,
  );
  (N.scheduleNotificationAsync as jest.Mock).mockClear();
  await reconcile();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  await handleResponse({
    actionIdentifier: "complete",
    notification: { request: target },
  } as N.NotificationResponse);
  await reconcile();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    target.identifier,
  );
  expect(
    [...selectReminders(useHub.getState().rows).events.values()].some(
      (e) => e.series === id && e.completed,
    ),
  ).toBe(true);
  alert.mockRestore();
});
test("Home is today-only, Apps opens Reminders, calendar forwards the selected date to creation", async () => {
  await render(<Home />);
  expect(screen.getByText("Today's reminders")).toBeTruthy();
  expect(screen.queryByText(title)).toBeNull();
  await act(async () => {
    await setSetting({
      key: "dashboard",
      widgets: ["reminders.shortcuts"],
      hidden: [],
    });
  });
  expect(screen.queryByText("Today's reminders")).toBeNull();
  await screen.unmount();
  await render(<Apps />);
  await fireEvent.press(screen.getByText("Reminders"));
  expect(router.push).toHaveBeenCalledWith("/reminders");
  await screen.unmount();
  await render(<CalendarScreen />, { wrapper: GestureHandlerRootView });
  const monday = shiftDay(today, -((new Date().getDay() + 6) % 7)),
    friday = shiftDay(monday, 4);
  await fireEvent.press(screen.getByLabelText(formatDate(friday)));
  await fireEvent.press(screen.getByLabelText("Add reminder"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/edit",
    params: { date: friday },
  });
  await screen.unmount();
  (require("expo-router").useLocalSearchParams as jest.Mock).mockReturnValue({
    date: friday,
  });
  await render(<Editor />);
  expect(screen.getByText(formatDate(friday))).toBeTruthy();
  expect(screen.getByLabelText("Title")).toBeTruthy();
});
test("Apps switches layouts, remembers the grid after reload, and launches the same module", async () => {
  await render(<Apps />);
  expect(
    screen.getByRole("button", { name: "Card view", selected: true }),
  ).toBeTruthy();
  expect(screen.getByText("Planning")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "App grid view" }));
  await screen.findByRole("button", { name: "App grid view", selected: true });
  expect(screen.queryByText("Planning")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Reminders" }));
  expect(router.push).toHaveBeenCalledWith("/reminders");
  await screen.unmount();
  useHub.setState({ rows: [] });
  await initialize();
  await render(<Apps />);
  expect(
    screen.getByRole("button", { name: "App grid view", selected: true }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Card view" }));
  await screen.findByText("Planning");
  expect(
    screen.getByRole("button", { name: "Card view", selected: true }),
  ).toBeTruthy();
});

test("series split preserves the previous completion and applies only future changes", async () => {
  const s = {
    ...series,
    details: { ...series.details, date: "2024-01-01" },
    rule: { kind: "daily" as const },
  };
  await write([
    seriesRow(s),
    eventRow({ ...emptyEvent(id, "2024-01-02"), completed: 123 }),
  ]);
  const item = itemAt(
    s,
    "2024-01-03",
    selectReminders(useHub.getState().rows).events,
  )!;
  await saveReminder(
    { ...item.details, title: "Updated" },
    s.rule,
    item,
    "future",
  );
  const d = selectReminders(useHub.getState().rows),
    previous = d.series.find((x) => x.id === id)!;
  expect(previous.end).toBe("2024-01-02");
  expect(itemAt(previous, "2024-01-02", d.events)?.event?.completed).toBe(123);
  expect(
    d.series.some(
      (x) => x.details.title === "Updated" && x.details.date === "2024-01-03",
    ),
  ).toBe(true);
});

test("selecting an accent repaints a mounted reminder form and persists after SQLite reload", async () => {
  function AppearanceAndEditor() {
    const appearance = settings(useHub((s) => s.rows)).appearance;
    return (
      <>
        <AppearancePanel appearance={appearance} />
        <Editor />
      </>
    );
  }
  await render(<AppearanceAndEditor />);
  await fireEvent.press(screen.getByRole("radio", { name: "Indigo accent" }));
  await screen.findByRole("radio", { name: "Indigo accent", checked: true });
  expect(screen.getByRole("button", { name: "Save reminder" })).toHaveStyle({
    backgroundColor: "#5856D6",
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Custom accent color" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Custom accent (#RRGGBB)"),
    "#F6C744",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Apply color" }));
  await screen.findByText("#F6C744");
  await fireEvent.press(screen.getByRole("radio", { name: "Dark theme" }));
  await screen.findByRole("radio", { name: "Dark theme", checked: true });
  await screen.unmount();
  useHub.setState({ rows: [] });
  await initialize();
  await render(<Editor />);
  expect(screen.getByRole("button", { name: "Save reminder" })).toHaveStyle({
    backgroundColor: "#F6C744",
  });
});
