import { parseTaskWhen } from "@/lib/taskDate";

export type PrefixCommand = {
  id: string;
  title: string;
  hint: string;
  kind: "timer" | "clip" | "todo" | "gpa" | "ask";
  payload: string;
};

export function parseCommandPrefix(raw: string): PrefixCommand[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(">")) return [];
  const body = trimmed.slice(1).trim();
  const [head, ...rest] = body.split(/\s+/);
  const arg = rest.join(" ").trim();
  const verb = (head || "").toLowerCase();

  if (!verb || "timer".startsWith(verb)) {
    const minutes = Number(arg) || 25;
    return [
      {
        id: "prefix-timer",
        title: `Start ${minutes}m focus timer`,
        hint: "Keeps running in the top bar",
        kind: "timer",
        payload: String(minutes),
      },
    ];
  }
  if ("clip".startsWith(verb) || "clipboard".startsWith(verb)) {
    return [
      {
        id: "prefix-clip",
        title: arg ? `Open clipboard ${arg}` : "Enter a share code",
        hint: "24-hour lab code",
        kind: "clip",
        payload: arg,
      },
    ];
  }
  if ("todo".startsWith(verb) || "task".startsWith(verb)) {
    const when = arg ? parseTaskWhen(arg) : null;
    return [
      {
        id: "prefix-todo",
        title: when ? `Add “${when.text}” on ${when.label}` : "Describe the task",
        hint: "Study planner",
        kind: "todo",
        payload: arg,
      },
    ];
  }
  if ("gpa".startsWith(verb)) {
    return [
      {
        id: "prefix-gpa",
        title: "Show saved GPA target",
        hint: arg ? `Set target ${arg}` : "From this browser",
        kind: "gpa",
        payload: arg,
      },
    ];
  }
  if ("ask".startsWith(verb)) {
    return [
      {
        id: "prefix-ask",
        title: arg ? `Ask “${arg}”` : "Ask AI",
        hint: "Grounded in your semester",
        kind: "ask",
        payload: arg,
      },
    ];
  }
  return [
    {
      id: "prefix-help",
      title: "Commands: timer, clip, todo, gpa, ask",
      hint: "Prefix with >",
      kind: "ask",
      payload: body,
    },
  ];
}
