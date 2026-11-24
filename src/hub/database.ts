import * as SQLite from "expo-sqlite";
import { type Row, recordSchema } from "./backup";
import { reminderMigration, reminderTables } from "../reminders/migration";
import { wellbeingMigration, wellbeingTables } from "../wellbeing/records";
const dbPromise = SQLite.openDatabaseAsync("productivity-hub.db");
const ready = dbPromise.then(async (db) => {
  await db.execAsync(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS hub_settings (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, body TEXT NOT NULL);" +
      reminderMigration + wellbeingMigration,
  );
  return db;
});
const tables = {
  "hub.setting": "hub_settings",
  ...reminderTables,
  ...wellbeingTables,
} as const;

export async function loadRecords() {
  const db = await ready;
  const rows = await db.getAllAsync<{ body: string }>(
    Object.values(tables)
      .map((t) => "SELECT body FROM " + t)
      .join(" UNION ALL "),
  );
  return rows.map((r) => recordSchema.parse(JSON.parse(r.body)));
}
export async function saveRecords(valid: Row[], importing: boolean) {
  const db = await ready;
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const row of valid) {
      const table = tables[row.kind];
      if (row.kind === "wellbeing.focusSession" && row.deleted) {
        await tx.runAsync("DELETE FROM wellbeing_focus_sessions WHERE id=?", row.id);
        continue;
      }
      const previous = await tx.getFirstAsync<{ updated: number }>(
        "SELECT updated FROM " + table + " WHERE id=?",
        row.id,
      );
      if (importing && previous && previous.updated >= row.updated) continue;
      const updated = importing
        ? row.updated
        : Math.max(Date.now(), (previous?.updated ?? 0) + 1);
      await tx.runAsync(
        "INSERT OR REPLACE INTO " + table + " (id,updated,body) VALUES (?,?,?)",
        row.id,
        updated,
        JSON.stringify({ ...row, updated }),
      );
    }
  });
}
