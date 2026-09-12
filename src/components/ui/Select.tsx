"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDown, Search, Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optional longer label used only inside the open menu. */
  menuLabel?: string;
};

export type SelectSize = "sm" | "md" | "lg";

const triggerSizeClasses: Record<SelectSize, string> = {
  sm: "h-8 px-2.5 text-xs font-medium rounded-lg",
  md: "h-9 px-3 text-xs font-semibold rounded-xl",
  lg: "h-11 px-4 text-sm rounded-xl",
};

const SEARCHABLE_OPTION_THRESHOLD = 8;

export interface SelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  size?: SelectSize;
  className?: string;
  /** Grid layout for options panel (e.g. semester 4-col in settings) */
  optionsLayout?: "list" | "grid-4";
  /** Show a filter field. Defaults to on when there are many options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Align menu to left (default) or right of the trigger button */
  align?: "left" | "right";
  /** Allow creating a custom option when typing in search */
  onCreateOption?: (query: string) => void;
  createOptionLabel?: (query: string) => string;
  /** Action button pinned to the bottom of the dropdown menu */
  footerAction?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
}

function SelectInner<T extends string | number>({
  value,
  options,
  onChange,
  label,
  placeholder = "Select",
  icon: Icon,
  disabled = false,
  size = "md",
  className,
  optionsLayout = "list",
  searchable,
  searchPlaceholder = "Search…",
  align = "left",
  onCreateOption,
  createOptionLabel,
  footerAction,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const enableSearch =
    optionsLayout !== "grid-4" &&
    (searchable ?? options.length >= SEARCHABLE_OPTION_THRESHOLD);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const labelMatch = o.label.toLowerCase().includes(q);
      const menuMatch = o.menuLabel?.toLowerCase().includes(q);
      const valueMatch = String(o.value).toLowerCase().includes(q);
      return labelMatch || Boolean(menuMatch) || valueMatch;
    });
  }, [options, query]);

  const closeMenu = () => {
    setIsOpen(false);
    setQuery("");
    setHighlighted(0);
  };

  const openMenu = () => {
    const selectedIdx = options.findIndex((o) => o.value === value);
    setHighlighted(selectedIdx >= 0 ? selectedIdx : 0);
    setQuery("");
    setIsOpen(true);
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector('[data-active-option="true"]') as HTMLElement | null;
    if (!el) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    if (elTop < list.scrollTop) {
      list.scrollTop = elTop;
    } else if (elBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = elBottom - list.clientHeight;
    }
  }, [highlighted, isOpen, filtered]);

  const selectOption = (next: T) => {
    onChange(next);
    closeMenu();
  };

  const showCreateOption = Boolean(
    onCreateOption &&
      query.trim().length > 0 &&
      !options.some(
        (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
      ),
  );

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 0 && showCreateOption && onCreateOption) {
        onCreateOption(query.trim());
        closeMenu();
        return;
      }
      const opt = filtered[highlighted];
      if (opt) selectOption(opt.value);
    }
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (disabled) return;
          if (isOpen) closeMenu();
          else openMenu();
        }}
        title={selected?.label}
        className={cn(
          "w-full flex items-center justify-between gap-1.5",
          "bg-card/75 backdrop-blur-sm border border-border text-foreground shadow-xs",
          "hover:border-border-strong hover:bg-surface/80 transition-all",
          isOpen && "border-border-strong ring-2 ring-primary/20 bg-surface/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          triggerSizeClasses[size],
        )}
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted shrink-0" />}
          <span className="truncate">{selected?.label ?? label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-muted shrink-0 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={cn(
              "absolute top-full mt-1.5 z-dropdown",
              "bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-popover overflow-hidden",
              align === "right"
                ? "right-0 flex flex-col min-w-full w-max max-w-[min(22rem,calc(100vw-2rem))]"
                : "left-0 flex flex-col min-w-full w-max max-w-[min(22rem,calc(100vw-2rem))]",
              optionsLayout === "grid-4" && "grid grid-cols-4 gap-1 p-1 w-full",
            )}
          >
            {enableSearch && (
              <div className="p-1.5 border-b border-border shrink-0">
                <div className="flex items-center gap-1.5 rounded-lg bg-surface border border-border px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-foreground/45 focus-within:shadow-[0_0_0_3px_rgb(var(--foreground)/0.08)]">
                  <Search className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    placeholder={searchPlaceholder}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setHighlighted(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent text-xs font-medium text-foreground placeholder:text-muted/70 outline-none focus:outline-none focus-visible:outline-none focus:shadow-none focus-visible:shadow-none"
                    aria-label={searchPlaceholder}
                  />
                </div>
              </div>
            )}
            <div
              ref={listRef}
              role="listbox"
              className={cn(
                optionsLayout === "grid-4"
                  ? "contents"
                  : "flex flex-col gap-0.5 p-1 overflow-y-auto overscroll-contain custom-scrollbar max-h-[min(18rem,60vh)]",
              )}
            >
              {filtered.length === 0 ? (
                showCreateOption ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateOption?.(query.trim());
                      closeMenu();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-surface rounded-lg transition-colors text-left"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {createOptionLabel
                        ? createOptionLabel(query.trim())
                        : `Add "${query.trim()}"`}
                    </span>
                  </button>
                ) : (
                  <p className="px-3 py-4 text-xs text-muted text-center">
                    No matches for “{query.trim()}”
                  </p>
                )
              ) : (
                <>
                  {filtered.map((opt, idx) => {
                    const isSelected = value === opt.value;
                    const isActive = highlighted === idx;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-active-option={isActive ? "true" : undefined}
                        title={opt.menuLabel ?? opt.label}
                        onMouseEnter={() => setHighlighted(idx)}
                        onClick={() => selectOption(opt.value)}
                        className={cn(
                          "text-left transition-colors rounded-lg min-w-0",
                          optionsLayout === "grid-4"
                            ? "py-2 text-xs font-semibold text-center"
                            : "w-full flex items-center justify-between px-3 py-2 text-xs font-medium gap-2",
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : isActive
                              ? "bg-surface text-foreground"
                              : "text-muted hover:bg-surface hover:text-foreground",
                        )}
                      >
                        {optionsLayout === "grid-4" ? (
                          String(opt.value)
                        ) : (
                          <>
                            <span className="truncate">{opt.menuLabel ?? opt.label}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 shrink-0 text-primary-foreground" />
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                  {showCreateOption && (
                    <button
                      type="button"
                      onClick={() => {
                        onCreateOption?.(query.trim());
                        closeMenu();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-primary hover:bg-surface rounded-lg transition-colors text-left mt-0.5 border-t border-border/50 pt-2"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {createOptionLabel
                          ? createOptionLabel(query.trim())
                          : `Add "${query.trim()}"`}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
            {footerAction && (
              <div className="p-1 border-t border-border/70 shrink-0 bg-surface/30">
                <button
                  type="button"
                  onClick={() => {
                    footerAction.onClick();
                    closeMenu();
                  }}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface hover:text-primary-hover rounded-lg transition-colors text-left cursor-pointer"
                >
                  {footerAction.icon ? (
                    <footerAction.icon className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{footerAction.label}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const Select = memo(SelectInner) as typeof SelectInner;
