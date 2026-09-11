import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[5.5rem] rounded-lg border border-border bg-background text-foreground",
          "px-4 py-2.5 text-sm placeholder:text-muted input-premium-focus",
          "disabled:cursor-not-allowed disabled:opacity-40 resize-y",
          className,
        )}
        {...props}
      />
    );
  },
);
