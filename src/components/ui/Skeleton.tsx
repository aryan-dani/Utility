import { cn } from "@/lib/cn";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}
