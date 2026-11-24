Minimal Productivity Hub — Product Blueprint

Status: Product discovery in progress
Project type: Personal project
Platforms: Android and iOS
Framework: React Native + Expo
Language: TypeScript

1. Product Vision

Build an all-in-one productivity application containing multiple small, independent applications within a single mobile app.

The purpose is to help people become more productive while reducing unnecessary smartphone usage.

The application should encourage:

Productivity
Digital minimalism
Intentional living

The experience should be simple, distraction-free, private, and useful.

2. Target Audience

People who:

Want to improve their productivity.
Want to reduce unnecessary phone usage.
Prefer multiple useful tools in one application.
Want to manage their everyday activities intentionally.
3. Planned Mini-Applications
#	Mini-Application	Status
1	To-do List / Task Manager	Planned
2	Notes and Quick Thoughts	Planned
3	Pomodoro Timer / Focus Mode	Planned
4	Calendar and Daily Planner	Planned
5	Expense Tracker	Planned
6	Water Intake Tracker	Planned
7	Custom Widgets / Quick Tools	Planned
8–9	Digital Wellbeing	Combined Digital Detox and Screen-Time Tracker module, Android-first
10	Reminders	First development module

These applications must be independently developed modules within one unified mobile application.

4. Critical Development Philosophy

We will build ONE mini-application at a time.

Never attempt to implement all mini-applications simultaneously.

Development workflow:

Build the core application foundation.
Select one mini-application.
Define its complete requirements.
Implement its UI and functionality.
Implement local data persistence.
Implement device integrations.
Write and execute tests.
Fix issues and refine the experience.
Complete the module.
Move to the next mini-application.

A mini-application must be fully functional before starting the next one.

Do not use placeholder functionality to make the application appear complete.

Never break existing functionality when introducing a new module.

5. UI/UX Requirements
Application organization

Use a hybrid architecture combining:

Customizable home dashboard.
Dedicated mini-applications.
Categories for organizing applications.
Customizable widgets and shortcuts.
Home Dashboard

The dashboard should include:

Minimal daily overview.
Customizable widgets.
Mini-app shortcuts.
Relevant daily information.

Users should be able to customize their workspace.

Navigation

Use a bottom navigation bar with:

Home
Apps
Insights
Settings
Design Philosophy

Ultra-minimal design.

Design characteristics:

Black and white foundation.
Clean typography.
Minimal visual clutter.
Thoughtful spacing.
Subtle borders and separators.
Minimal and meaningful animations.
Consistent design language.
Customization

Users should be able to:

Add and remove widgets.
Rearrange widgets.
Hide unused mini-applications.
Customize their dashboard.
Select accent colors.
Personalize their workspace.
Theme Support

Support:

Light mode.
Dark mode.
System-default mode.
Predefined accent color palettes.
Custom accent colors.

Theme changes should update the interface dynamically without restarting the application.

Ensure sufficient accessibility contrast across all themes.

6. Technical Stack

Proposed technology stack:

Layer	Technology
Mobile framework	React Native
Development platform	Expo
Programming language	TypeScript
Navigation	Expo Router
State management	Zustand
Database	To be finalized
Animations	React Native Reanimated
Gestures	React Native Gesture Handler
Notifications	Expo Notifications
Icons	Lucide React Native
Date utilities	date-fns
Validation	Zod
Testing	Jest + React Native Testing Library
Builds	EAS Build

Use strict TypeScript throughout the project.

Database

SQLite using Expo SQLite is the current recommendation.

The final database choice is not yet confirmed.

Consider lightweight key-value storage for preferences and simple configuration data.

Animation Requirements

Use animation libraries for a smooth, polished experience.

Required animation areas:

Screen transitions.
Modal presentations.
Animated lists.
Button interactions.
Gesture-based interactions.
Widget rearrangement.
Expand and collapse interactions.
Micro-interactions.

Use Reanimated and Gesture Handler.

Lottie can optionally be used for illustrations and success animations.

Animations must be purposeful, performant, and accessible.

7. Architecture

Use a hybrid modular architecture.

Requirements:

Every mini-app must be an independent module.
Each module should own its screens and business logic.
Each module should have its own data access layer.
Shared infrastructure should provide common services.
Shared components should maintain design consistency.
Modules should communicate through well-defined interfaces.
New modules should not require major architectural changes.
8. Offline-First and Data Privacy

Offline-first functionality is mandatory.

Requirements:

Core functionality must work without internet.
Store application data locally.
No registration or login required.
No backend required for initial functionality.
Data must persist across application restarts.
Cloud functionality may be introduced later.
Backup and Restore

Support:

Manual data export and import.
Optional cloud-drive backup.

Users should retain control over their data.

9. Notifications

For the initial development phase:

Local notifications only.
No push notification backend.
No mandatory internet connectivity.
Proper permission handling.
Account for Android and iOS differences.

A backend may be introduced in the future without fundamentally changing the architecture.

10. Insights

The Insights section should combine productivity and personal tracking.

Productivity Insights
Tasks completed.
Focus time.
Daily activity.
Productivity trends.
Personal Tracking Insights
Expense summaries.
Water consumption.
Screen-time information.
Personal activity trends.

Keep visualizations simple and meaningful.

11. First Mini-Application: Reminders

Development priority: First

11.1 Interface

Selected interface: Calendar + List.

Requirements:

Calendar navigation.
Reminders associated with dates.
Chronological reminder list.
Floating action button for creating reminders.
Natural-language quick-add input.

Example:

Pay electricity bill tomorrow at 9 AM

11.2 Notification Actions

Users should be able to interact with notifications.

Supported actions:

Mark as completed.
Snooze for 5 minutes.
Snooze for 10 minutes.
Snooze for 15 minutes.
Open the reminder.
11.3 Snooze

Basic snooze presets:

5 minutes.
10 minutes.
15 minutes.
11.4 Reminder Creation

Support:

Floating + button.
Natural-language quick-add.

Voice input is not currently planned for the first release.

11.5 Potential Reminder Features

The following features were discussed but are not finalized:

Feature	Status
Simple reminders	Proposed
Date and time scheduling	Proposed
Recurring reminders	Proposed
All-day reminders	Proposed
Priority levels	Proposed
Categories / Custom lists	Proposed
Checklist reminders	Proposed
Optional notes	Proposed
Location-based reminders	Undecided
Attachments	Undecided

The first release scope must be finalized before implementation.

12. AI Coding Agent Instructions

The eventual development prompt must enforce these rules:

Never implement all mini-applications at once.
Complete one mini-application before starting another.
Never leave placeholder functionality.
Follow the modular architecture.
Use strict TypeScript.
Maintain consistent coding conventions.
Implement proper error handling.
Write meaningful automated tests.
Preserve existing functionality.
Ensure Android and iOS compatibility.
Prioritize offline functionality.
Maintain consistent UI/UX.
Optimize animations and application performance.
Document important architectural decisions.
Ask for clarification rather than making major product assumptions.
Verify the implementation before declaring a module complete.
13. Remaining Product Discovery

Continue with the following topics before generating the final master coding prompt.

Reminders
Finalize reminder types.
Define reminder creation and editing screens.
Define calendar interactions.
Define notification behavior.
Define recurrence behavior.
Define completed and overdue reminders.
Define notification permission handling.
Define database models.
Define testing requirements.
Define acceptance criteria.
Application Architecture
Finalize SQLite and storage decisions.
Define module boundaries.
Define shared component architecture.
Define theme architecture.
Define backup and restore architecture.
Define testing and quality standards.
Final Deliverable

Generate a comprehensive master development prompt for an AI coding agent.

The prompt must describe the entire product vision and application architecture while instructing the coding agent to implement only the Reminders module initially.

Do not start implementing the other mini-applications until the Reminders module is completed, tested, and approved.

14. Instructions for Continuing This Project

We have already completed the initial product discovery.

Continue from the pending Reminders requirements.

Do not restart the discussion or ask questions that have already been answered.

Ask questions one at a time when clarification is necessary.

Do not generate the final master coding prompt yet.

First complete:

Product specifications.
Screens and interactions.
Technical architecture.
Data models.
Acceptance criteria.

Eventually generate a comprehensive development prompt for an AI coding agent.

Most important rule: Build one mini-application at a time, starting with Reminders.
