import React, { useState } from "react";
import { Text } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Icon } from "../hub/icons";
import { Touch } from "../hub/motion";
import { run, useColors } from "../hub/ui";
import { remove } from "./actions";
import type { Item } from "./model";

export function SwipeToDelete({
  item,
  children,
}: {
  item: Item;
  children: React.ReactNode;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const label =
    item.series.rule.kind === "once" ? "Delete reminder" : "Delete occurrence";
  return (
    <Swipeable
      rightThreshold={38}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => setOpen(true)}
      onSwipeableWillClose={() => setOpen(false)}
      childrenContainerStyle={{ backgroundColor: c.surface }}
      renderRightActions={(_progress, _offset, swipe) => (
        <Touch
          feedback
          accessibilityRole="button"
          accessibilityLabel={label + ": " + item.details.title}
          disabled={!open}
          accessible={open}
          aria-hidden={!open}
          importantForAccessibility={open ? "yes" : "no-hide-descendants"}
          onPress={() => {
            swipe.close();
            run(() => remove(item, "one"));
          }}
          style={{
            width: 80,
            minHeight: 48,
            gap: 3,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: c.danger,
          }}
        >
          <Icon name="delete" size={20} color={c.surface} />
          <Text style={{ fontWeight: "600", color: c.surface }}>Delete</Text>
        </Touch>
      )}
    >
      {children}
    </Swipeable>
  );
}
