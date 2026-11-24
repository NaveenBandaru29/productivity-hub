import { palette } from "./design";

function channels(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

export function mixColor(from: string, to: string, amount: number) {
  const destination = channels(to);
  return (
    "#" +
    channels(from)
      .map((value, index) =>
        Math.round(value + (destination[index] - value) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

function luminance(color: string) {
  const [r, g, b] = channels(color).map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function surfaceColors(accent: string, dark: boolean) {
  if (!dark) return palette.light;
  return {
    ...palette.dark,
    bg: mixColor(palette.dark.bg, accent, 0.035),
    surface: mixColor(palette.dark.surface, accent, 0.075),
    border: mixColor(palette.dark.border, accent, 0.12),
  };
}

export function accentColors(accentFill: string, dark: boolean) {
  const surfaces = surfaceColors(accentFill, dark);
  const { bg, surface } = surfaces;
  const wash = mixColor(surface, accentFill, dark ? 0.17 : 0.1);
  const onAccent =
    contrast(accentFill, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#000000";
  const ink = dark ? "#FFFFFF" : "#000000";
  let accent = accentFill;
  for (
    let step = 1;
    step <= 20 &&
    [bg, surface, wash].some(
      (background) => contrast(accent, background) < 4.5,
    );
    step++
  ) {
    accent = mixColor(accentFill, ink, step / 20);
  }
  return { ...surfaces, accentFill, onAccent, accent, wash };
}
