import { modules } from "../../src/hub/registry";
import { Page } from "../../src/hub/ui";
export default function Insights() {
  return (
    <Page title="Insights">
      {modules.map((m) => (m.insights ? <m.insights key={m.id} /> : null))}
    </Page>
  );
}
