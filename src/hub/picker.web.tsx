import React, { useRef, useState } from "react";
import { Btn, useColors } from "./ui";
import { formatDate } from "./format-date";
import { clockTime } from "./format-time";
import { useTimeFormat } from "./storage";

// Browser time inputs follow the browser locale, so use explicit time fields.
function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  const twelve = useTimeFormat() === "12-hour";
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? 12 : 0;
  const style = {
    colorScheme: c.dark ? "dark" : "light",
    backgroundColor: c.surface,
    color: c.fg,
    border: "1px solid " + c.border,
    borderRadius: 12,
    minHeight: 44,
    padding: "0 8px",
    font: "inherit",
  };
  return (
    <div
      role="group"
      aria-label="Reminder time"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      <select
        style={style}
        aria-label="Hour"
        value={twelve ? hours % 12 || 12 : hours}
        onChange={(e) => {
          const hour = Number(e.target.value);
          onChange(clockTime(twelve ? (hour % 12) + period : hour, minutes));
        }}
      >
        {Array.from({ length: twelve ? 12 : 24 }, (_, i) => {
          const hour = twelve ? i + 1 : i;
          return (
            <option key={hour} value={hour}>
              {twelve ? hour : String(hour).padStart(2, "0")}
            </option>
          );
        })}
      </select>
      <span aria-hidden="true" style={{ color: c.fg }}>
        :
      </span>
      <select
        style={style}
        aria-label="Minute"
        value={minutes}
        onChange={(e) => onChange(clockTime(hours, Number(e.target.value)))}
      >
        {Array.from({ length: 60 }, (_, minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, "0")}
          </option>
        ))}
      </select>
      {twelve && (
        <select
          style={style}
          aria-label="AM or PM"
          value={period}
          onChange={(e) =>
            onChange(clockTime((hours % 12) + Number(e.target.value), minutes))
          }
        >
          <option value={0}>AM</option>
          <option value={12}>PM</option>
        </select>
      )}
    </div>
  );
}
export function Picker({
  mode,
  value,
  onChange,
}: {
  mode: "date" | "time";
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  const input = useRef<HTMLInputElement>(null);
  const [inline, setInline] = useState(false);
  if (mode === "time") return <TimePicker value={value} onChange={onChange} />;
  const useButton = !inline;
  const control = (
    <input
      ref={input}
      tabIndex={useButton ? -1 : undefined}
      aria-hidden={useButton}
      aria-label="Reminder date"
      type="date"
      value={value}
      onChange={(e) => {
        if (e.target.validity.valid && e.target.value) {
          onChange(e.target.value);
          setInline(false);
        }
      }}
      style={{
        colorScheme: c.dark ? "dark" : "light",
        background: c.surface,
        color: c.fg,
        border: "1px solid " + c.border,
        borderRadius: 12,
        padding: "12px 14px",
        minHeight: 44,
        font: "inherit",
        maxWidth: "100%",
        boxSizing: "border-box",
        ...(useButton && {
          position: "absolute",
          inset: 0,
          width: "100%",
          opacity: 0,
          pointerEvents: "none",
        }),
      }}
    />
  );
  return (
    <div style={{ position: "relative" }}>
      <Btn
        title={formatDate(value)}
        hint={"Reminder date, " + formatDate(value)}
        onPress={() => {
          try {
            if (input.current?.showPicker) {
              input.current.showPicker();
              return;
            }
          } catch {
            // Embedded browsers can restrict showPicker; expose the native input.
          }
          setInline(true);
        }}
      />
      {control}
    </div>
  );
}
