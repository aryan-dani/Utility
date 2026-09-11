"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import AppLink from "@/components/ui/AppLink";

export type TabBarItem = {
  href?: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export function TabBar({
  items,
  className,
}: {
  items: TabBarItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Primary"
      data-app-tabbar=""
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky md:hidden",
        "border-t border-border/80 bg-background/90 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const content = (
            <>
              <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
              <span className="text-3xs font-medium truncate max-w-full">{item.label}</span>
            </>
          );
          const classNameInner = cn(
            "flex flex-col items-center justify-center gap-0.5 h-full min-h-11 text-muted",
            item.active && "text-foreground",
          );
          return (
            <li key={item.label} className="min-w-0">
              {item.href ? (
                <AppLink
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={classNameInner}
                >
                  {content}
                </AppLink>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-pressed={item.active}
                  className={cn(classNameInner, "w-full")}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
