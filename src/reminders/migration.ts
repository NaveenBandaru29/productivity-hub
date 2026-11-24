export const reminderTables = {
  "reminders.series": "reminder_series",
  "reminders.list": "reminder_lists",
  "reminders.event": "reminder_events",
} as const;

export const reminderMigration = Object.values(reminderTables)
  .map(
    (table) =>
      "CREATE TABLE IF NOT EXISTS " +
      table +
      " (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, body TEXT NOT NULL);",
  )
  .join("\n");
