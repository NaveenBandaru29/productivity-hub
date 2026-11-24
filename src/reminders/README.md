# Reminders

## Overview

Reminders is the scheduling mini-app inside [Minimal Productivity Hub](../../MINIMAL_PRODUCTIVITY_HUB.md). It lets users plan timed, all-day, and repeating reminders locally. The module also contributes today’s list and shortcuts to Home, and completion history to Insights.

## Features and user experience

| Area | Implemented functionality |
| --- | --- |
| Calendar | Opens on today in week view and expands to a month. The selected day uses a fill and today has an outline. The month shows one dot per scheduled date for the selected list filter. Selecting a day updates the list and prefills the date for Add reminder. |
| Reminder list | Rounded rows show the title, time or all-day status, repeat rule, overdue or missed status, and a short note preview. Stars highlight items while preserving order. Completed items stay visible with a checked control and a struck-through title. |
| Editor | Supports date, time, repeat rules, notes, stars, custom lists, and recurring edit scope. Quick Add previews supported phrases such as `Pay rent Friday at 9 AM`. Unrecognized input remains available as the title. |
| Home and Insights | Home shows today’s reminders and active overdue items with completion progress. Insights shows a seven-day completion chart and a total based on local history. |
| Gestures | Swipe the calendar to navigate. Swipe left on a Home or calendar row, then tap Delete. A recurring row removes only its selected occurrence. |

Dates and times follow the hub’s display settings. Full dates use `DD-MMM-YYYY`. Times default to 24-hour display and can switch to 12-hour AM/PM in Settings.

## Technologies and structure

The module uses TypeScript, React Native, and Expo Router. It uses Zod schemas for reminder data, Gesture Handler and Reanimated for interactions, and the hub’s SQLite or IndexedDB persistence. It uses the shared native and web picker and notification adapters.

| Location | Responsibility |
| --- | --- |
| `../../app/reminders.tsx`, `../../app/edit.tsx` | Calendar and editor route entry points. |
| `screens.tsx`, `editor.tsx`, `repeat-fields.tsx` | Calendar, lists, dashboard contributions, and reminder form. |
| `model.ts`, `quick-add.ts` | Validation, recurrence, occurrence status, calendar indicators, and text parsing. |
| `actions.ts`, `records.ts`, `migration.ts` | Mutations, record mapping, and native schema. |
| `alerts.ts` | Computes upcoming occurrence alerts for the platform adapters. |
| `swipe-to-delete.tsx`, `week-chart.tsx` | Shared row swipe action and completion visualization. |

## Schedule, completion, and deletion

The model stores dates as local `YYYY-MM-DD` values and time as `HH:mm`. An occurrence uses its series ID and original local date as its identity, so an individual move preserves that identity. Display formatting leaves the stored schedule and alert time intact.

Repeat rules support daily, weekly on selected weekdays, and monthly. Monthly defaults to the first of the month. A monthly rule on the 31st clamps to April 30, then returns to May 31. Editing one occurrence writes an override. Editing this and future reminders ends the original series and creates a successor. The split preserves completed future exceptions as independent history records.

Unfinished one-time reminders remain active after their date. Older unfinished recurring occurrences can appear as missed in history. The editor can delete one occurrence or end the series from a selected occurrence. Completion, removal, and snooze changes are recorded with the affected occurrence. All reminder records participate in the hub’s [manual backup and restore](../../MINIMAL_PRODUCTIVITY_HUB.md#storage-and-restore).

## Alerts

Timed alerts use their scheduled local time. All-day alerts default to 09:00 and can be changed in Settings. Saving a reminder stores it before asking for permission. Native notification actions can open or complete a reminder or open the 5-, 10-, or 15-minute snooze picker. Snooze applies to one occurrence.

The planner selects the earliest 60 future alerts. Native reconciliation cancels obsolete alerts and schedules missing ones on startup, foregrounding, and data changes. The browser uses an open-tab timer and the browser Notification API.

## Verification and limitations

Run `npm test` and `npm run typecheck` from the project root. The suite covers recurrence, moved and removed occurrences, month dots, schedule ordering, Quick Add, notification reconciliation, and reminder navigation.

- Quick Add supports a limited set of English date and time expressions. Use the editor for other schedules.
- The native queue is replenished during reconciliation. Browser alerts require notification permission and an open app tab.
- Verify background and closed-app notification delivery, permission recovery, snooze, and occurrence edits on physical Android and iOS devices before release. See the [native checklist](../../README.md#verification).
