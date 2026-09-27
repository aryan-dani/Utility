"use client";

import { useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { PWAProvider } from "@/contexts/PWAContext";
import { Toaster } from "sonner";
import NavigationProgress from "./NavigationProgress";
import { ThemeColorSync } from "@/components/shell/ThemeColorSync";
import { CampusOriginGuard } from "@/components/CampusOriginGuard";
import { CommandShortcuts } from "@/components/CommandShortcuts";
import { useIsStandalone } from "@/lib/pwa/displayMode";
import { useAcademicStore } from "@/store/academicStore";

const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });
const PwaUpdater = dynamic(() => import("./pwa/PwaUpdater"), { ssr: false });

function CommandPaletteHost() {
  const open = useAcademicStore((s) => s.isCommandPaletteOpen);
  const [ready, setReady] = useState(false);
  if (open && !ready) {
    setReady(true);
  }
  if (!ready) return null;
  return <CommandPalette />;
}

function ToasterProvider() {
  const { theme } = useTheme();
  const standalone = useIsStandalone();

  return (
    <Toaster
      theme={theme as "light" | "dark" | "system"}
      position="bottom-right"
      closeButton={false}
      richColors={false}
      expand={false}
      visibleToasts={4}
      duration={4000}
      offset={
        standalone
          ? "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.25rem))"
          : "max(1rem, env(safe-area-inset-bottom))"
      }
      gap={12}
      toastOptions={{
        unstyled: true,
        className: "app-toast-host",
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="utility-theme"
    >
      <PWAProvider>
        <ThemeColorSync />
        <CampusOriginGuard />
        <NavigationProgress />
        <CommandShortcuts />
        {children}
        <CommandPaletteHost />
        <PwaUpdater />
        <ToasterProvider />
      </PWAProvider>
    </ThemeProvider>
  );
}
