import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { useHub } from "../src/hub/storage";
import type { Row } from "../src/hub/backup";
import { dayKey } from "../src/reminders/model";
import { OverviewUsage, UsagePanel } from "../src/wellbeing/reports-panels";
import { LimitsPanel } from "../src/wellbeing/limits-panel";
import { useWellbeingUsage } from "../src/wellbeing/usage-context";
import type { UsageDay } from "../src/wellbeing/usage";

jest.mock("../src/wellbeing/usage-context", () => ({
  useWellbeingUsage: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("node:crypto").randomUUID(),
}));
jest.mock("../src/wellbeing/notification-access", () => ({
  requestWellbeingAlerts: jest.fn(),
}));
jest.mock("../src/hub/database", () => ({
  loadRecords: async () => mockRecords,
  saveRecords: async (incoming: Row[]) => {
    for (const row of incoming) {
      mockRecords = [
        ...mockRecords.filter((r) => r.kind !== row.kind || r.id !== row.id),
        row,
      ];
    }
  },
}));
let mockRecords: Row[] = [];
const today = dayKey(new Date());
const id = "10000000-aaaa-4000-8000-aaaaaaaaaaaa";
const day: UsageDay = {
  date: today,
  totalMs: 6000000,
  unlocks: 10,
  matchedTotalMs: null,
  coverageEnd: Date.now(),
  coverage: "complete",
  apps: ["Reader", "Games", "Maps", "Video"].map((label, i) => ({
    label,
    packageName: "demo." + label,
    category: "News",
    launches: i + 1,
    durationMs: (4 - i) * 600000,
  })),
};
beforeEach(() => {
  jest.clearAllMocks();
  mockRecords = [];
  useHub.setState({ rows: [], ready: true });
  jest.mocked(useWellbeingUsage).mockReturnValue({
    days: [day],
    loading: false,
    error: null,
    refresh: jest.fn(),
    status: {
      supported: true,
      granted: true,
      enabled: true,
      locked: false,
      notificationsGranted: true,
      lastRefresh: Date.now(),
    },
  });
});

test("overview links remaining allowance and the top three observed apps", async () => {
  useHub.setState({
    rows: [
      {
        id,
        kind: "wellbeing.goal",
        deleted: false,
        updated: 1,
        value: { id, period: "daily", startDate: today, minutes: 120 },
      },
    ],
  });
  await render(<OverviewUsage />);
  expect(
    screen.getByRole("button", { name: "20 min remaining of 2 h" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Video ·/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Maps · 20 min" }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/wellbeing",
    params: { section: "usage", period: "today", app: "demo.Maps" },
  });
});

test("selecting an app exposes its trend, foreground-entry estimate and limit link", async () => {
  await render(<UsagePanel />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Reader · 40 min" }),
  );
  expect(screen.getByText("Seven-day usage trend")).toBeTruthy();
  expect(
    screen.getByText("40 min · 1 estimated foreground entry"),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Set app limit" }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/wellbeing",
    params: { section: "limits", target: "demo.Reader", targetKind: "app" },
  });
});

test("a reached limit extends only after confirmation and only once today", async () => {
  mockRecords = [
    {
      kind: "wellbeing.limit",
      id,
      updated: 0,
      deleted: false,
      value: {
        id,
        targetKind: "app",
        minutes: 40,
        enabled: true,
        warnAt80: false,
      },
    },
    {
      kind: "wellbeing.binding",
      id,
      updated: 0,
      deleted: false,
      value: {
        ruleId: id,
        target: "demo.Reader",
        label: "Reader",
        extendedDate: null,
      },
    },
  ];
  useHub.setState({ rows: mockRecords });
  await render(<LimitsPanel />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Extend by 10 minutes" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Cancel extension" }),
  );
  expect(screen.getByText("Daily limit reached")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Extend by 10 minutes" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Confirm extension" }),
  );
  await waitFor(() =>
    expect(
      screen.getByText("Today's 10-minute extension is active."),
    ).toBeTruthy(),
  );
  expect(
    screen.queryByRole("button", { name: "Extend by 10 minutes" }),
  ).toBeNull();
  expect(screen.getByText("40 min of 50 min used")).toBeTruthy();
});
