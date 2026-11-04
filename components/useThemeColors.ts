"use client";

import { useEffect, useState } from "react";

const FALLBACK = {
  accent: "#E4002B",
  accent2: "#2C6E8F",
  accent3: "#8A6A12",
  ink: "#15181D",
  muted: "#5D6570",
  rule: "#DADEE3",
  surface: "#FFFFFF",
};

export type ThemeColors = typeof FALLBACK;

/** Recharts needs real colour values, so read the CSS custom properties and follow light/dark changes. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (name: string, fallback: string) =>
        s.getPropertyValue(name).trim() || fallback;
      setColors({
        accent: get("--accent", FALLBACK.accent),
        accent2: get("--accent-2", FALLBACK.accent2),
        accent3: get("--accent-3", FALLBACK.accent3),
        ink: get("--ink", FALLBACK.ink),
        muted: get("--muted", FALLBACK.muted),
        rule: get("--rule", FALLBACK.rule),
        surface: get("--surface", FALLBACK.surface),
      });
    };
    read();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);

  return colors;
}
