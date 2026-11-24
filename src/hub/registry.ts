import type { ComponentType } from "react";
import type { Href } from "expo-router";
import type { IconName } from "./icons";
import { WellbeingWidget, FocusShortcut, WellbeingInsights } from "../wellbeing/contributions";
import {
  TodayWidget,
  ReminderShortcuts,
  CompletionInsights,
} from "../reminders/screens";
export interface HubModule {
  id: string;
  name: string;
  category: string;
  icon: IconName;
  entry: Href;
  widgets: { id: string; title: string; render: ComponentType }[];
  shortcuts: { id: string; title: string; render: ComponentType }[];
  insights?: ComponentType;
}
export const modules: HubModule[] = [
  {
    id: "reminders",
    name: "Reminders",
    category: "Planning",
    icon: "calendar",
    entry: "/reminders",
    widgets: [
      {
        id: "reminders.today",
        title: "Today's reminders",
        render: TodayWidget,
      },
    ],
    shortcuts: [
      {
        id: "reminders.shortcuts",
        title: "Reminder shortcuts",
        render: ReminderShortcuts,
      },
    ],
    insights: CompletionInsights,
  },
  {
    id: "wellbeing",
    name: "Digital Wellbeing",
    category: "Health & focus",
    icon: "wellbeing",
    entry: "/wellbeing",
    widgets: [{ id: "wellbeing.today", title: "Screen time today", render: WellbeingWidget }],
    shortcuts: [{ id: "wellbeing.focus", title: "Start focus", render: FocusShortcut }],
    insights: WellbeingInsights,
  },
];
export const widgets = modules.flatMap((m) => [...m.widgets, ...m.shortcuts]);
