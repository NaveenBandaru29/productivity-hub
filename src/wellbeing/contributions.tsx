import { router } from "expo-router";
import { Btn, Panel } from "../hub/ui";
import { TodayUsage, WeeklyUsage } from "./reports-panels";

export const WellbeingWidget = TodayUsage;
export const WellbeingInsights = WeeklyUsage;
export function FocusShortcut() {
  return <Panel title="Digital Wellbeing">
    <Btn title="Start focus" icon="time" primary onPress={() => router.push({pathname:"/wellbeing",params:{section:"focus"}})}/>
  </Panel>;
}
