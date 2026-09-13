"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/cn";

interface QAAuthorAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export default function QAAuthorAvatar({
  name,
  photoUrl,
  size = "sm",
  className,
}: QAAuthorAvatarProps) {
  const dim = size === "md" ? "w-10 h-10 rounded-2xl text-sm" : "w-7 h-7 rounded-full text-xs";
  const initial = name?.trim()?.[0]?.toUpperCase();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Google/GitHub avatars; next/image domain allowlist varies
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          dim,
          "object-cover shrink-0 ring-2 ring-border/50 shadow-xs bg-surface",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        "bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 shadow-xs ring-2 ring-border/50",
        className,
      )}
      aria-hidden
    >
      {initial || <User className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />}
    </div>
  );
}
