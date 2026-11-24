import React from "react";
import { View } from "react-native";
import House from "lucide-react-native/icons/house";
import Leaf from "lucide-react-native/icons/leaf";
import LayoutGrid from "lucide-react-native/icons/layout-grid";
import PanelsTopLeft from "lucide-react-native/icons/panels-top-left";
import ChartColumn from "lucide-react-native/icons/chart-column";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Check from "lucide-react-native/icons/check";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Plus from "lucide-react-native/icons/plus";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import GripVertical from "lucide-react-native/icons/grip-vertical";
import Star from "lucide-react-native/icons/star";
import StickyNote from "lucide-react-native/icons/sticky-note";
import List from "lucide-react-native/icons/list";
import Repeat2 from "lucide-react-native/icons/repeat-2";
import Clock3 from "lucide-react-native/icons/clock-3";
import Bell from "lucide-react-native/icons/bell";
import WandSparkles from "lucide-react-native/icons/wand-sparkles";
import Sun from "lucide-react-native/icons/sun";
import Moon from "lucide-react-native/icons/moon";
import Monitor from "lucide-react-native/icons/monitor";
import Pipette from "lucide-react-native/icons/pipette";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";

const icons = {
  wellbeing: Leaf,
  home: House,
  apps: LayoutGrid,
  cards: PanelsTopLeft,
  insights: ChartColumn,
  settings: SlidersHorizontal,
  calendar: CalendarDays,
  check: Check,
  arrow: ArrowRight,
  plus: Plus,
  previous: ChevronLeft,
  next: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
  grip: GripVertical,
  star: Star,
  note: StickyNote,
  list: List,
  repeat: Repeat2,
  time: Clock3,
  bell: Bell,
  quick: WandSparkles,
  light: Sun,
  dark: Moon,
  system: Monitor,
  custom: Pipette,
  delete: Trash2,
  close: X,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  color,
  size = 22,
  filled = false,
}: {
  name: IconName;
  color: string;
  size?: number;
  filled?: boolean;
}) {
  const Glyph = icons[name];
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Glyph
        color={color}
        size={size}
        strokeWidth={1.8}
        fill={filled ? color : "none"}
      />
    </View>
  );
}
