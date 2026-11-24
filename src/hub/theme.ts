import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { accentColors } from "./accent";
import { useHub, settings } from "./storage";
import { useShallow } from "zustand/react/shallow";
import type { Row as StoredRow } from "./backup";

const defaultAppearance = settings([]).appearance;
const appearanceBySnapshot = new WeakMap<
  StoredRow[],
  typeof defaultAppearance
>();
function selectAppearance({ rows }: { rows: StoredRow[] }) {
  const cached = appearanceBySnapshot.get(rows);
  if (cached) return cached;
  const row = rows.find(
    (row) =>
      row.kind === "hub.setting" && row.id === "appearance" && !row.deleted,
  );
  const appearance =
    row?.kind === "hub.setting" && row.value.key === "appearance"
      ? row.value
      : defaultAppearance;
  appearanceBySnapshot.set(rows, appearance);
  return appearance;
}
export function useColors() {
  const os = useColorScheme(),
    p = useHub(useShallow(selectAppearance));
  const dark = (p.mode === "system" ? os : p.mode) === "dark";
  return useMemo(
    () => ({ dark, ...accentColors(p.accent, dark) }),
    [dark, p.accent],
  );
}
