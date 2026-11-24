import { router, useLocalSearchParams } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { Btn, Label, Page, Panel, Row } from "../hub/ui";
import { layout } from "../hub/design";
import { FocusPanel, FocusSummary } from "./focus";
import { GoalsPanel } from "./goals-panel";
import { LimitsPanel } from "./limits-panel";
import { updatePreferences, usePreferences } from "./preferences";
import { OverviewUsage, UsagePanel } from "./reports-panels";
import { connectUsage, SettingsPanel } from "./settings-panel";
import { useWellbeingUsage } from "./usage-context";

const titles = {
  overview: "Overview", usage: "Usage", focus: "Focus", goals: "Goals & progress",
  limits: "App limits", settings: "Settings & privacy",
} as const;
type Section = keyof typeof titles;

export function WellbeingScreen() {
  const params = useLocalSearchParams<{section?: string}>();
  const section: Section = params.section && Object.hasOwn(titles, params.section)
    ? params.section as Section : "overview";
  const {status, refresh} = useWellbeingUsage();
  const {onboarded} = usePreferences();
  const {width, fontScale} = useWindowDimensions();
  const wide = width / fontScale >= layout.tablet;
  function go(section: Section) {
    router.setParams({section, target: "", targetKind: ""});
  }
  async function begin(focus = false) {
    await updatePreferences({onboarded:true});
    if (focus) go("focus");
    else if (status?.supported) await connectUsage();
  }
  return <Page title={titles[section]} onRefresh={refresh}
    headerAction={<Btn title="Settings and privacy" icon="settings" iconOnly selected={section === "settings"} onPress={() => go("settings")}/>}>
    <Row>{(["overview", "usage", "focus"] as const).map(tab =>
      <Btn key={tab} title={titles[tab]} selected={tab === section} onPress={() => go(tab)}/>
    )}</Row>
    {section === "overview" && <>
      {!onboarded && <Panel title="Meet Digital Wellbeing">
        <Label>See where your time goes, choose a daily allowance, or take a timed focus break.</Label>
        <Label small>{status?.supported ? "Usage Access lets this phone measure foreground app activity. Your activity stays on this device. Limits are advisory." :
          "Focus and goals work offline. Device-wide measurement requires the native Android app with Usage Access."}</Label>
        <Row><Btn primary title={status?.supported ? "Connect usage" : "Continue"} onPress={() => begin()}/>
          <Btn title="Go to focus" icon="time" onPress={() => begin(true)}/></Row>
      </Panel>}
      <View style={{flexDirection: wide ? "row" : "column", gap:16, alignItems:"stretch"}}>
        <View style={wide && {flex: 3}}><OverviewUsage/></View>
        <View style={[wide && {flex: 2}, {gap:12}]}>
          <FocusSummary/>
          <Row><Btn title="App limits" icon="settings" onPress={() => go("limits")}/>
            <Btn title="Goals & progress" icon="insights" onPress={() => go("goals")}/></Row>
        </View>
      </View>
    </>}
    {section === "usage" && <UsagePanel/>}
    {section === "focus" && <FocusPanel/>}
    {section === "goals" && <GoalsPanel/>}
    {section === "limits" && <LimitsPanel/>}
    {section === "settings" && <SettingsPanel/>}
  </Page>;
}
