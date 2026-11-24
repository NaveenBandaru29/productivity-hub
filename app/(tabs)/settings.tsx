import { AppearancePanel } from "../../src/hub/appearance";
import { DraggableWidget } from "../../src/hub/gestures";
import { widgetDropIndex } from "../../src/hub/gesture-decisions";
import React from "react";
import { Alert, Linking, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Documents from "expo-document-picker";
import { widgets, modules } from "../../src/hub/registry";
import { Page, Panel, Label, Row, Btn, useColors, run } from "../../src/hub/ui";
import { Picker } from "../../src/hub/picker";
import { settings, useHub, setSetting, restore } from "../../src/hub/storage";
import { encodeBackup } from "../../src/hub/backup";
export default function Settings() {
  const rows = useHub((s) => s.rows),
    { appearance, dashboard, morning, timeFormat } = settings(rows);
  const colors = useColors();
  const positions = React.useRef(new Map<string, number>());
  function drop(id: string, index: number, offset: number) {
    const destination = widgetDropIndex(
      dashboard.widgets,
      positions.current,
      index,
      offset,
    );
    if (destination !== index) run(() => move(id, destination - index));
  }
  async function backup() {
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(
        new Blob([encodeBackup(rows)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "productivity-hub-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }
    const f = new File(Paths.cache, "productivity-hub-backup.json");
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is unavailable on this device.");
    await f.write(encodeBackup(rows));
    await Sharing.shareAsync(f.uri, {
      mimeType: "application/json",
      UTI: "public.json",
    });
  }
  async function load() {
    const doc = await Documents.getDocumentAsync({
      type: ["application/json", "text/plain", "application/octet-stream"],
      copyToCacheDirectory: true,
    });
    if (doc.canceled) return;
    await restore(
      Platform.OS === "web"
        ? await (await fetch(doc.assets[0].uri)).text()
        : await new File(doc.assets[0].uri).text(),
    );
    if (Platform.OS === "web") {
      window.alert("Backup restored");
      return;
    }
    Alert.alert(
      "Backup restored",
      "Your reminders, settings, and portable wellbeing rules have been combined.",
    );
  }
  function order(ids: string[]) {
    return setSetting({ ...dashboard, widgets: ids });
  }
  function move(id: string, by: number) {
    const ids = [...dashboard.widgets],
      i = ids.indexOf(id);
    ids.splice(i, 1);
    ids.splice(i + by, 0, id);
    return order(ids);
  }
  return (
    <Page title="Settings" narrow>
      <AppearancePanel appearance={appearance} />
      <Panel title="Home dashboard">
        {dashboard.widgets.map((id, i) => (
          <DraggableWidget
            key={id}
            label={widgets.find((w) => w.id === id)?.title ?? id}
            color={colors.fg}
            background={colors.surface}
            onDrop={(offset) => drop(id, i, offset)}
            onMeasure={(y, height) => positions.current.set(id, y + height / 2)}
          >
            <Row>
              <Btn
                icon="up"
                iconOnly
                title="Move up"
                disabled={i === 0}
                onPress={() => move(id, -1)}
              />
              <Btn
                icon="down"
                iconOnly
                title="Move down"
                disabled={i === dashboard.widgets.length - 1}
                onPress={() => move(id, 1)}
              />
              <Btn
                icon="delete"
                iconOnly
                title="Remove"
                onPress={() => order(dashboard.widgets.filter((v) => v !== id))}
              />
            </Row>
          </DraggableWidget>
        ))}
        {widgets
          .filter((w) => !dashboard.widgets.includes(w.id))
          .map((w) => (
            <Btn
              key={w.id}
              title={"Add " + w.title}
              onPress={() => order([...dashboard.widgets, w.id])}
            />
          ))}
        {modules.flatMap((m) =>
          m.shortcuts.map((short) => (
            <Btn
              key={short.id}
              title={
                (dashboard.hidden.includes(short.id) ? "Show " : "Hide ") +
                short.title
              }
              onPress={() =>
                setSetting({
                  ...dashboard,
                  hidden: dashboard.hidden.includes(short.id)
                    ? dashboard.hidden.filter((v) => v !== short.id)
                    : [...dashboard.hidden, short.id],
                })
              }
            />
          )),
        )}
      </Panel>
      <Panel title="Time format">
        <Row>
          {(["12-hour", "24-hour"] as const).map((format) => (
            <Btn
              key={format}
              title={format}
              selected={timeFormat === format}
              onPress={() => setSetting({ key: "timeFormat", format })}
            />
          ))}
        </Row>
      </Panel>
      <Panel title="Notifications">
        <Label small>All-day reminder time</Label>
        <Picker
          mode="time"
          value={morning}
          onChange={(v) => {
            void setSetting({ key: "morning", time: v }).catch((e) =>
              Alert.alert("Could not save", String(e)),
            );
          }}
        />
        {Platform.OS === "web" ? (
          <Label small>
            Browser alerts require notification permission and an open tab.
          </Label>
        ) : (
          <Btn
            title="Open device settings"
            onPress={() => Linking.openSettings()}
          />
        )}
      </Panel>
      <Panel title="Manual backup">
        <Row>
          <Btn title="Export backup" onPress={backup} />
          <Btn title="Restore and merge" onPress={load} />
        </Row>
      </Panel>
    </Page>
  );
}
