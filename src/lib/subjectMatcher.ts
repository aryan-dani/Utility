/**
 * subjectMatcher.ts
 * Smart subject matching helper that resolves abbreviations, clean titles,
 * and common aliases for computer science and engineering subjects.
 */

export const isSubjectMatch = (nameA: string, nameB: string): boolean => {
  if (!nameA || !nameB) return false;

  const clean = (s: string) => {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const a = clean(nameA);
  const b = clean(nameB);
  
  // If one is a Lab/Practical and the other is not, they must not match
  const isLabA = a.includes('lab') || a.includes('practical');
  const isLabB = b.includes('lab') || b.includes('practical');
  if (isLabA !== isLabB) {
    return false;
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }
  
  // Helper to extract acronyms (e.g. "design and analysis of algorithms" -> "daa")
  const getAbbreviation = (str: string) => {
    const words = str
      .split(/\s+/)
      .filter(w => w !== 'and' && w !== 'of' && w !== 'the' && w !== 'basic' && w !== 'basics' && w !== 'lab');
    if (words.length === 1) {
      return words[0];
    }
    return words
      .map(w => w[0])
      .join('');
  };
  
  const abbrA = getAbbreviation(a);
  const abbrB = getAbbreviation(b);
  
  if (
    abbrA && 
    abbrB && 
    (abbrA === abbrB || 
      (abbrA.length > 1 && abbrB.length > 1 && (abbrA.includes(abbrB) || abbrB.includes(abbrA))))
  ) {
    return true;
  }
  
  // Specific manual aliases for computer science and engineering subjects
  const aliases: Record<string, string[]> = {
    'aies': ['artificial intelligence', 'ai', 'expert systems'],
    'daa': ['design and analysis of algorithms', 'algorithms'],
    'det': ['data engineering techniques', 'data engineering'],
    'pbl': ['project based learning'],
    'cn': ['computer networks', 'computer networks and security'],
    'dbms': ['database management systems', 'database'],
    'coa': ['computer organization and architecture', 'computer organization'],
    'os': ['operating systems']
  };
  
  for (const [key, list] of Object.entries(aliases)) {
    const matchA = a.includes(key) || list.some(item => a.includes(item));
    const matchB = b.includes(key) || list.some(item => b.includes(item));
    if (matchA && matchB) {
      return true;
    }
  }
  
  return false;
};
