import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ButtonSize, ButtonVariant } from "@/components/ui/Button";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary:
    "bg-surface border border-border text-foreground hover:bg-surface-hover",
  ghost: "text-muted hover:text-foreground hover:bg-surface/80",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizeClasses: Record<ButtonSize | "icon", string> = {
  sm: "min-h-8 px-3 text-xs gap-1.5",
  md: "min-h-11 px-4 text-sm gap-2",
  lg: "min-h-12 px-5 text-sm gap-2",
  icon: "min-h-11 min-w-11 h-11 w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9 px-0",
};

export interface ButtonLinkProps
  extends Omit<ComponentProps<typeof Link>, "className" | "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize | "icon";
  className?: string;
  children: ReactNode;
}

/** Link styled like Button - for Share/Open external actions. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch = false,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}
