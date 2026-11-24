import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { FocusPanel } from "../src/wellbeing/focus";
import { useHub } from "../src/hub/storage";
import type { Row } from "../src/hub/backup";
import { selectFocus } from "../src/wellbeing/focus-model";

jest.mock("../src/hub/database", () => {
  const rows = new Map<string, Row>();
  return {
    loadRecords: async () => [...rows.values()],
    saveRecords: async (changes: Row[]) => {
      for (const r of changes) rows.set(r.kind + r.id, r);
    },
  };
});
jest.mock("expo-notifications", () => ({}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("node:crypto").randomUUID(),
}));
jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("../src/wellbeing/usage-context", () => ({
  useWellbeingUsage: () => ({ days: [], status: { supported: false } }),
}));

test("starts a default timer offline and requires confirmation to interrupt it", async () => {
  await render(<FocusPanel />);
  expect(screen.getByLabelText("Duration in minutes").props.value).toBe("25");
  await fireEvent.press(screen.getByRole("button", { name: "Start focus" }));
  await waitFor(() => expect(screen.getByRole("progressbar")).toBeTruthy());
  const active = () => selectFocus(useHub.getState().rows).sessions[0];
  expect(active().endAt - active().startAt).toBe(25 * 60000);
  await fireEvent.press(screen.getByRole("button", { name: "End early" }));
  expect(active().status).toBe("active");
  await fireEvent.press(screen.getByRole("button", { name: "Keep focusing" }));
  expect(screen.queryByRole("button", { name: "End session" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "End early" }));
  await fireEvent.press(screen.getByRole("button", { name: "End session" }));
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  expect(active().status).toBe("interrupted");
  expect(screen.getByText(/^Interrupted · /)).toBeTruthy();
});
