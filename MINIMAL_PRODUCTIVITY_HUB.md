# Minimal Productivity Hub

## Overview

Minimal Productivity Hub is an offline-first productivity app for Android and iOS, with a browser build for desktop and mobile. The hub provides navigation, a configurable dashboard, appearance preferences, and backup.

## Mini-apps

- [Reminders](src/reminders/README.md) covers the calendar, editor, recurrence, notifications, and module-specific verification.
- [Digital Wellbeing](src/wellbeing/README.md) combines screen-time reporting, goals, advisory limits and focus sessions. It contributes an optional Home widget and shortcut, and a weekly Insights report.

## Features and user experience

| Area | Implemented functionality |
| --- | --- |
| Home | Today’s date and clock, configurable module widgets, and shortcuts. |
| Apps | Browse the module catalog in Cards or an icon Grid. Cards is the default, and the chosen layout persists locally. Both views use the module registry for navigation. |
| Insights | Displays contributions registered by installed modules. |
| Settings | Light, Dark, and System theme previews, preset and custom hex accents, dashboard widget ordering and visibility, time format, notification preferences, and manual backup and restore. |

The phone navigation uses a rounded bar with a sliding accent highlight. Wide screens use a navigation rail. Components share theme tokens, Lucide icons, accessible labels, and reduced-motion settings through the hub. Full dates display as `DD-MMM-YYYY`. The time display defaults to 24-hour format and can be changed to 12-hour time with AM/PM.

## Technologies

- Expo SDK 58, Expo Router, React 19.3, React Native 0.88, and strict TypeScript. The web build uses React Native Web and Expo’s single-page output.
- Expo SQLite on Android and iOS, IndexedDB on web, Zustand for the loaded application state, and Zod for runtime validation.
- React Native Reanimated, Gesture Handler, Worklets, Expo Haptics, Lucide, and React Native SVG for interaction and presentation.
- Expo Notifications, the community DateTimePicker, Expo Document Picker, Expo FileSystem, and Expo Sharing for platform integrations.
- Node’s test runner through `tsx`, Jest Expo, React Native Testing Library, and Node’s built-in SQLite driver for verification.

## Architecture

| Location | Responsibility |
| --- | --- |
| `app/_layout.tsx` | Loads the local store, initializes notification handling, and configures the root navigation stack. |
| `app/(tabs)/` | Home, Apps, Insights, and Settings routes and the adaptive tab navigator. |
| `src/hub/registry.ts` | Module registration with an ID, name, icon, category, route, widgets, shortcuts, and optional Insights component. |
| `src/hub/` | Shared navigation, theme, formatting, controls, motions, persistence, backup validation, and platform integrations. Web adapters use the `.web.ts` or `.web.tsx` suffix. |
| `src/reminders/` | Reminders mini-app source and its [module guide](src/reminders/README.md). |
| `src/wellbeing/`, `modules/wellbeing-usage/` | Digital Wellbeing screens, rules, storage schemas and local Expo Android adapter. |
| `tests/` | Shared UI, storage, integration, and module tests. |

## Implementation details

### Storage and restore

`src/hub/storage.ts` serializes writes, validates records, and refreshes the Zustand snapshot after the transaction. Native uses the `productivity-hub.db` SQLite database with WAL enabled. Web uses the `minimal-productivity-hub` IndexedDB database and keys records by kind and ID. Settings, series, occurrence events, and reminder lists are stored as separate record kinds.

Settings exports version 2 JSON and accepts both version 1 hub backups and version 2 files. Portable wellbeing records include budgets, daily limit rules and recurring focus schedules. Measured activity, session history, permissions and device bindings stay out of manual backups. Restore validates each file and merges it in a single transaction. Unique records are retained, newer edits win, and the local record wins a timestamp tie. Deletion markers prevent an older backup from reviving deleted rules. A newer imported rule that requires targets must be bound again on this device.

## Development and verification

Use Node 24 for the SQLite integration tests. From the repository root, run:

```sh
npm ci --legacy-peer-deps
npm start
npm run typecheck
npm test
npx expo export --platform android --platform ios --platform web
```

Use Expo Go for SDK 58 during development. For a native debug build, use `npx expo run:android` with Android tooling or `npx expo run:ios` with macOS and Xcode. The export command generates production bundles under `dist/`.

## Known limitations and future work

- App records and preferences are local to the device or browser profile. Transfer uses manual JSON backup and restore.
- Native release acceptance still needs Android and iOS device checks for offline restart, backup import and export, dashboard controls, and accessibility. See the [release checklist](README.md#verification).
- The [product blueprint](PRODUCT_BLUEPRINT.md) describes future mini-apps and product scope.
