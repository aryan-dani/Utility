import {
  AIDS_SEM_4_SUBJECTS,
  AIDS_SEM_5_SUBJECTS,
} from "@/lib/syllabusData";
import { stemWord } from "./tokenize";

/** British ↔ American spelling pairs for query expansion. */
export const SPELLING_PAIRS: Record<string, string[]> = {
  normalisation: ["normalization"],
  normalization: ["normalisation"],
  colour: ["color"],
  color: ["colour"],
  behaviour: ["behavior"],
  behavior: ["behaviour"],
  analyse: ["analyze"],
  analyze: ["analyse"],
  optimisation: ["optimization"],
  optimization: ["optimisation"],
  organisation: ["organization"],
  organization: ["organisation"],
  programme: ["program"],
  program: ["programme"],
  centre: ["center"],
  center: ["centre"],
  modelling: ["modeling"],
  modeling: ["modelling"],
  labelled: ["labeled"],
  labeled: ["labelled"],
};

/** Static academic abbreviations → expanded terms. */
export const ABBREVIATIONS: Record<string, string[]> = {
  dbms: ["database", "management", "system", "sql", "normalization"],
  daa: ["design", "analysis", "algorithms", "complexity"],
  aies: ["artificial", "intelligence", "expert", "systems"],
  ai: ["artificial", "intelligence"],
  ml: ["machine", "learning"],
  dl: ["deep", "learning"],
  nlp: ["natural", "language", "processing"],
  etl: ["extract", "transform", "load", "data", "engineering"],
  olap: ["online", "analytical", "processing", "warehouse"],
  bfs: ["breadth", "first", "search"],
  dfs: ["depth", "first", "search"],
  dp: ["dynamic", "programming"],
  np: ["nondeterministic", "polynomial", "complexity"],
  ui: ["user", "interface"],
  ux: ["user", "experience"],
  pyq: ["previous", "year", "question"],
  os: ["operating", "system"],
  cn: ["computer", "networks"],
  oop: ["object", "oriented", "programming"],
  ds: ["data", "structure", "structures"],
  cov: ["covariance", "variance"],
};

function buildSubjectMaps() {
  const codeToName: Record<string, string> = {};
  const nameToCode: Record<string, string> = {};
  const allSubjects = [...AIDS_SEM_4_SUBJECTS, ...AIDS_SEM_5_SUBJECTS];

  for (const subject of allSubjects) {
    codeToName[subject.code.toLowerCase()] = subject.name;
    nameToCode[subject.name.toLowerCase()] = subject.code;
    const short = subject.name
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .map((w) => w.toLowerCase());
    codeToName[subject.id] = subject.name;
    for (const word of short) {
      if (!codeToName[word]) codeToName[word] = subject.name;
    }
  }

  return { codeToName, nameToCode };
}

const { codeToName } = buildSubjectMaps();

/** Expand a query into additional search terms deterministically. */
export function expandQueryTerms(terms: string[]): string[] {
  const expanded = new Set<string>(terms);
  const addWithStem = (term: string) => {
    expanded.add(term);
    const stemmed = stemWord(term);
    if (stemmed.length >= 2) expanded.add(stemmed);
  };

  for (const term of terms) {
    const lower = term.toLowerCase();

    if (ABBREVIATIONS[lower]) {
      for (const t of ABBREVIATIONS[lower]) addWithStem(t);
    }

    if (SPELLING_PAIRS[lower]) {
      for (const t of SPELLING_PAIRS[lower]) addWithStem(t);
    }

    if (codeToName[lower]) {
      for (const t of tokenizeSubjectName(codeToName[lower])) addWithStem(t);
    }
  }

  return Array.from(expanded).slice(0, 40);
}

function tokenizeSubjectName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export function detectCategoryBoost(query: string): string[] {
  const q = query.toLowerCase();
  if (/\b(pyq|previous\s+year|question\s+paper|exam\s+paper)\b/.test(q)) {
    return ["pyq", "question-bank", "solved-question-bank"];
  }
  if (/\b(notes|note)\b/.test(q)) return ["notes"];
  if (/\b(ppt|slides|presentation|deck)\b/.test(q)) return ["ppt"];
  if (/\b(code|program|implementation)\b/.test(q)) return ["codes"];
  return [];
}

export { codeToName };
