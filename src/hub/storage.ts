import { loadRecords, saveRecords } from "./database";
import type { TimeFormat } from "./format-time";
import { create } from "zustand";
import {
  Row,
  Setting,
  type AppsLayout,
  recordSchema,
  backupSchema,
} from "./backup";
export const useHub = create<{
  rows: Row[];
  ready: boolean;
  error: string | null;
}>(() => ({ rows: [], ready: false, error: null }));
let chain: Promise<unknown> = Promise.resolve();
function queued<T>(work: () => Promise<T>) {
  const next = chain.then(work);
  chain = next.catch(() => {});
  return next;
}
let onChange = () => {};
export function onDataChange(fn: () => void) {
  onChange = fn;
}
async function refresh() {
  const rows = await loadRecords();
  useHub.setState({
    rows,
    ready: true,
    error: null,
  });
}
export function initialize() {
  return queued(refresh);
}
export function mutateRows(changes: (rows: Row[]) => Row[], importing = false) {
  return queued(async () => {
    const valid = changes(useHub.getState().rows).map((r) => recordSchema.parse(r));
    if (valid.length === 0) return;
    await saveRecords(valid, importing);
    await refresh();
    onChange();
  });
}
export function write(rows: Row[], importing = false) {
  return mutateRows(() => rows, importing);
}
export function restore(text: string) {
  const backup = backupSchema.parse(JSON.parse(text));
  return mutateRows(local => {
    const changes = [...backup.records];
    for (const row of backup.records) {
      const bindingKind = row.kind === "wellbeing.limit" ? "wellbeing.binding" :
        row.kind === "wellbeing.focusSchedule" ? "wellbeing.focusBinding" : null;
      if (!bindingKind) continue;
      const previous = local.find(r => r.kind === row.kind && r.id === row.id);
      if (previous && previous.updated >= row.updated) continue;
      const binding = local.find(r => r.kind === bindingKind && r.id === row.id && !r.deleted);
      if (binding) changes.push({ ...binding, deleted: true, updated: Math.max(Date.now(), binding.updated + 1) });
    }
    return changes;
  }, true);
}
export function setSetting(value: Setting) {
  return write([
    { kind: "hub.setting", id: value.key, value, updated: 0, deleted: false },
  ]);
}
export function settings(rows: Row[]) {
  let appearance: Extract<Setting, { key: "appearance" }> = {
    key: "appearance",
    mode: "system",
    accent: "#316C56",
  };
  let dashboard: Extract<Setting, { key: "dashboard" }> = {
    key: "dashboard",
    widgets: ["reminders.today", "reminders.shortcuts"],
    hidden: [],
  };
  let morning = "09:00";
  let timeFormat: TimeFormat = "24-hour";
  let appsLayout: AppsLayout = "cards";
  for (const r of rows)
    if (r.kind === "hub.setting" && !r.deleted) {
      if (r.value.key === "appearance") appearance = r.value;
      if (r.value.key === "dashboard") dashboard = r.value;
      if (r.value.key === "morning") morning = r.value.time;
      if (r.value.key === "timeFormat") timeFormat = r.value.format;
      if (r.value.key === "appsLayout") appsLayout = r.value.view;
    }
  return { appearance, dashboard, morning, appsLayout, timeFormat };
}

export function useTimeFormat() {
  return useHub((state) => settings(state.rows).timeFormat);
}
