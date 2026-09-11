"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useIsClient } from "@/lib/clientHooks";

export function SegmentedThemeToggle({
  theme,
  setTheme,
}: {
  theme: string | undefined;
  setTheme: (theme: string) => void;
}) {
  const mounted = useIsClient();

  if (!mounted) {
    return <div className="skeleton h-8 rounded-xl border border-border/80 w-full" aria-hidden />;
  }

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  return (
    <div className="flex bg-background/70 border border-border/80 p-0.5 rounded-xl w-full">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-medium transition-all relative ${
              active
                ? "bg-background border border-border/80 text-foreground shadow-xs font-semibold"
                : "text-muted hover:text-foreground hover:bg-surface/30"
            }`}
            title={opt.label}
            aria-label={`Switch to ${opt.label} theme`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
