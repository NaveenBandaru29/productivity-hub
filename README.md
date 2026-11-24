# Minimal Productivity Hub

An offline-first Expo mobile app for Android and iOS. Home, Apps, Insights, and Settings are the four persistent tabs. The Apps catalog includes [Reminders](src/reminders/README.md) and [Digital Wellbeing](src/wellbeing/README.md).

## Run locally

Use Node 24 for the test suite, which uses Node's built-in SQLite driver for integration tests. Install dependencies with `npm ci --legacy-peer-deps`. Run `npm start` and scan the QR code with Expo Go for SDK 58. After upgrading from an older SDK, stop the previous server and run `npm start -- --clear` once. To compile and install a native debug build, run `npx expo run:android` with the Android SDK and a connected device, or `npx expo run:ios` on macOS with Xcode. Standalone native builds are needed for final platform acceptance.

## Structure

- `app/` contains the Expo Router navigation and hub tabs. Reminders screen and form behavior live under `src/reminders/`.
- `src/hub/registry.ts` declares the installed modules and their dashboard, shortcut, and Insights contributions.
- SQLite stores typed, versioned records. Recurrence uses local calendar dates. Occurrence overrides use the series ID and original local date, so moving an occurrence preserves its identity.
- The manual JSON backup includes tombstones and per-record modification times. Restore validates the entire file and merges inside one transaction. Local records win ties.
- Reminder and focus alerts use separate identifiers. Reminders schedules up to 60 upcoming alerts. Digital Wellbeing uses the Android Usage Access API in a native build. Expo Go and web support goals and voluntary focus sessions.

## Verification

Run `npm test` for domain, screen, SQLite, and notification-adapter tests, then `npm run typecheck`. Run `npx expo export --platform android --platform ios` to generate production JavaScript bundles under `dist/`.

Before release, run these checks on both native platforms:

1. Deny notification permission when saving a reminder. Restart offline and verify the reminder persists. Enable notifications in device settings and return to the app.
2. Schedule a timed reminder a few minutes ahead. With the app backgrounded, verify delivery, each snooze duration, completion, and opening the corresponding reminder. Repeat after closing the app.
3. Change the all-day alert time, edit a recurring occurrence, and verify the pending alert changes. Check monthly recurrence across a short month.
4. Export a backup through the system share sheet. Edit and delete reminders, then import the same backup twice through the system file picker. Verify that newer changes survive and alerts appear once.
5. Verify Home completion and undo, dashboard ordering, dark mode, system text sizes, and screen-reader navigation on the device.
