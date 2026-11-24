import { useHub } from "../hub/storage";
import { reconcileFocus } from "./focus-actions";
import { focusPolicy } from "./focus-model";
import { nativeLimitPolicy } from "./limits";
import { preferences } from "./preferences";
import { syncUsagePolicy } from "./usage";

let queue = Promise.resolve();
export function reconcileWellbeing() {
  const work = queue.then(async () => {
    if (!useHub.getState().rows.some(r => r.kind.startsWith("wellbeing."))) return;
    await reconcileFocus();
    const rows = useHub.getState().rows;
    await syncUsagePolicy({
      warningsEnabled: preferences(rows).warnings,
      limits: nativeLimitPolicy(rows),
      ...focusPolicy(rows),
    });
  });
  queue = work.catch(() => {});
  return work;
}
