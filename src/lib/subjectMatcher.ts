/**
 * subjectMatcher.ts
 * Smart subject matching helper that resolves abbreviations, clean titles,
 * and common aliases for computer science and engineering subjects.
 */

const ALIASES: Record<string, string[]> = {
  aies: ["artificial intelligence", "ai", "expert systems"],
  daa: ["design and analysis of algorithms", "algorithms"],
  det: ["data engineering techniques", "data engineering"],
  pbl: ["project based learning"],
  cn: ["computer networks", "computer networks and security"],
  cnm: ["calculus and numerical methods"],
  dbms: ["database management systems", "database"],
  ds: ["data structures"],
  oop: [
    "object oriented programming",
    "object oriented programming laboratory",
  ],
  os: ["operating systems", "operating system concepts"],
  coa: ["computer organization and architecture", "computer organization"],
  osl: ["operating systems laboratory", "operating system laboratory", "os lab"],
  ml: ["machine learning"],
  mll: ["machine learning lab", "machine learning laboratory"],
  dvp: ["data visualization using python", "data visualization"],
  sem: ["software engineering and modelling", "software engineering"],
  uiux: ["user interface and user experience design", "ui ux", "ux design"],
  gml: ["graph machine learning", "graph ml"],
  sscd: ["system software and compiler design", "compiler design"],
  aisa: ["ai systems and applications"],
};

/** Exact key / phrase / token hit — no substring includes across subjects. */
function matchesAliasKey(cleaned: string, key: string, list: string[]) {
  if (cleaned === key) return true;
  if (cleaned.split(" ").includes(key)) return true;
  return list.some((item) => cleaned === item);
}

function sharesAlias(a: string, b: string): boolean {
  for (const [key, list] of Object.entries(ALIASES)) {
    if (matchesAliasKey(a, key, list) && matchesAliasKey(b, key, list)) {
      return true;
    }
  }
  return false;
}

export const isSubjectMatch = (nameA: string, nameB: string): boolean => {
  if (!nameA || !nameB) return false;

  const clean = (s: string) => {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const a = clean(nameA);
  const b = clean(nameB);

  if (a === b) {
    return true;
  }

  // Alias hits (e.g. OOP ↔ Object Oriented Programming Laboratory) run before
  // the lab asymmetry gate so codes can link to their lab course titles.
  if (sharesAlias(a, b)) {
    return true;
  }

  // If one is a Lab/Practical and the other is not, they must not match
  const isLabA = a.includes("lab") || a.includes("practical");
  const isLabB = b.includes("lab") || b.includes("practical");
  if (isLabA !== isLabB) {
    return false;
  }

  // Token equality only — never substring containment (GML ≠ ML).
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);
  if (
    tokensA.length === 1 &&
    tokensB.includes(tokensA[0]) &&
    tokensA[0].length >= 2
  ) {
    return true;
  }
  if (
    tokensB.length === 1 &&
    tokensA.includes(tokensB[0]) &&
    tokensB[0].length >= 2
  ) {
    return true;
  }

  // Acronym from multi-word titles (e.g. "design and analysis of algorithms" -> "daa")
  const getAbbreviation = (str: string) => {
    const words = str
      .split(/\s+/)
      .filter(
        (w) =>
          w !== "and" &&
          w !== "of" &&
          w !== "the" &&
          w !== "basic" &&
          w !== "basics" &&
          w !== "lab",
      );
    if (words.length === 1) {
      return words[0];
    }
    return words.map((w) => w[0]).join("");
  };

  const abbrA = getAbbreviation(a);
  const abbrB = getAbbreviation(b);

  // Exact abbreviation equality only — never includes().
  if (abbrA && abbrB && abbrA === abbrB) {
    return true;
  }

  return false;
};
