"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-foreground text-background hover:opacity-90 disabled:opacity-40",
  secondary:
    "bg-surface border border-border text-foreground hover:bg-surface-hover disabled:opacity-40",
  ghost:
    "text-muted hover:text-foreground hover:bg-surface/80 disabled:opacity-40",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-xs gap-1.5",
  md: "min-h-11 px-4 text-sm gap-2",
  lg: "min-h-12 px-5 text-sm gap-2",
  icon: "min-h-11 min-w-11 h-11 w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9 px-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-premium)] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
