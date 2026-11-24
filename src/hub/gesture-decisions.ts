// A short flick must travel far enough to be distinct from tapping a date.
export function calendarPageOffset(
  distance: number,
  velocity: number,
  canceled: boolean,
) {
  "worklet";
  if (canceled) return 0;
  const flick = Math.abs(distance) > 20 && Math.sign(distance) * velocity > 650;
  if (Math.abs(distance) <= 48 && !flick) return 0;
  return distance < 0 ? 1 : -1;
}

export function widgetDropIndex(
  ids: readonly string[],
  centers: ReadonlyMap<string, number>,
  index: number,
  distance: number,
) {
  const origin = centers.get(ids[index]);
  if (origin === undefined || distance === 0) return index;
  const position = origin + distance;
  return ids.reduce((target, id, i) => {
    const center = centers.get(id);
    if (center === undefined) return target;
    if (distance > 0 && i > index && position >= center)
      return Math.max(target, i);
    if (distance < 0 && i < index && position <= center)
      return Math.min(target, i);
    return target;
  }, index);
}
