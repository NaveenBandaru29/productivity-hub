import React, { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { View, Platform } from "react-native";
import { Btn, useColors } from "./ui";
import { formatDate } from "./format-date";
import { clockTime, formatTime } from "./format-time";
import { useTimeFormat } from "./storage";
import { dayKey, localDay } from "../reminders/model";
export function Picker({
  mode,
  value,
  onChange,
}: {
  mode: "date" | "time";
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, set] = useState(false);
  const c = useColors();
  const format = useTimeFormat();
  const date =
    mode === "date" ? localDay(value) : new Date("2000-01-01T" + value);
  return (
    <View>
      <Btn
        title={mode === "date" ? formatDate(value) : formatTime(value, format)}
        onPress={() => set(!open)}
      />
      {open && (
        <DateTimePicker
          value={date}
          mode={mode}
          themeVariant={c.dark ? "dark" : "light"}
          accentColor={c.accent}
          textColor={c.fg}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          is24Hour={mode === "time" ? format === "24-hour" : undefined}
          locale={
            mode === "time" && Platform.OS === "ios"
              ? format === "24-hour"
                ? "en-GB"
                : "en-US"
              : undefined
          }
          onValueChange={(_, selected) => {
            if (Platform.OS !== "ios") set(false);
            onChange(
              mode === "date"
                ? dayKey(selected)
                : clockTime(selected.getHours(), selected.getMinutes()),
            );
          }}
          onDismiss={() => set(false)}
        />
      )}
    </View>
  );
}
