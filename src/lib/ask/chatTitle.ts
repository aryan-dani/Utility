const TITLE_MAX = 48;
const TITLE_MIN_WORD_CUT = 24;

const LEAD_IN =
  /^(outline|explain|create|write|make|give|show|tell me about|tell me|tell|what is|what are|how do|how does|how to|compare|describe|define|list|walk through)\b[\s:,-]*/i;

/** Stable sidebar title from the first user message. Same input, same title. */
export function titleFromFirstMessage(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return "New Chat";

  const firstClause = (collapsed.split(/[.?!\n]/)[0] ?? collapsed).trim();
  let text = firstClause;
  let previous = "";
  while (previous !== text) {
    previous = text;
    text = text.replace(LEAD_IN, "").trim();
  }
  if (!text) text = firstClause;
  if (!text) return "New Chat";

  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length <= TITLE_MAX) return text;

  const sliced = text.slice(0, TITLE_MAX);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut =
    lastSpace >= TITLE_MIN_WORD_CUT ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[.,;:]+$/, "")}…`;
}
