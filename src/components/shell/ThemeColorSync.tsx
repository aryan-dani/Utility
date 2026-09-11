"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useIsClient } from "@/lib/clientHooks";

const LIGHT = "#ffffff";
const DARK = "#09090b";

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  const ready = useIsClient();

  useEffect(() => {
    if (!ready) return;
    const color = resolvedTheme === "light" ? LIGHT : DARK;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [ready, resolvedTheme]);

  return null;
}
