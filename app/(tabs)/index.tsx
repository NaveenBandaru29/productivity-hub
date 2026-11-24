import { DayCover } from "../../src/hub/art";
import { reconcile } from "../../src/hub/module-notifications";
import { Reveal } from "../../src/hub/motion";
import React from "react";
import { View, useWindowDimensions } from "react-native";
import { layout } from "../../src/hub/design";
import { initialize, settings, useHub } from "../../src/hub/storage";
import { modules, widgets } from "../../src/hub/registry";
import { Page, useNow } from "../../src/hub/ui";
export default function Home() {
  const wide = useWindowDimensions().width >= layout.tablet;
  const p = settings(useHub((s) => s.rows)).dashboard,
    now = useNow();
  return (
    <Page
      title="Today"
      onRefresh={async () => {
        await initialize();
        await reconcile();
      }}
    >
      <DayCover now={now} />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          flexWrap: wide ? "wrap" : "nowrap",
          gap: 16,
        }}
      >
        {p.widgets.map((id) => {
          if (
            p.hidden.includes(id) &&
            modules.some((m) => m.shortcuts.some((s) => s.id === id))
          )
            return null;
          const Widget = widgets.find((w) => w.id === id)?.render;
          return Widget ? (
            <Reveal
              key={id}
              style={
                wide
                  ? {
                      flexGrow: 1,
                      flexBasis: modules.some((m) =>
                        m.widgets.some((w) => w.id === id),
                      )
                        ? 360
                        : 220,
                    }
                  : undefined
              }
            >
              <Widget />
            </Reveal>
          ) : null;
        })}
      </View>
    </Page>
  );
}
