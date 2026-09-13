"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type IconButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<IconButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-90 disabled:opacity-40",
  secondary:
    "bg-surface border border-border text-foreground hover:bg-surface-hover disabled:opacity-40",
  ghost:
    "text-muted hover:text-foreground hover:bg-surface/80 border border-transparent disabled:opacity-40",
  destructive:
    "text-muted hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 disabled:opacity-40",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "min-h-8 min-w-8 h-8 w-8",
  md: "min-h-11 min-w-11 h-11 w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9",
  lg: "min-h-11 min-w-11 h-11 w-11",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
  label: string;
}

export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  children,
  label,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={title ?? label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-premium)] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
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
