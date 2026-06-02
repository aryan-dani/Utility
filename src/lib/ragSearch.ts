import { adminDb } from "./firebaseAdmin";

export interface RAGSearchResult {
  title: string;
  subject_name: string;
  snippet: string;
  file_url?: string;
  branch?: string;
  semester?: number;
  resource_id?: string;
}

/**
 * Shared utility for searching resources via Firestore with a robust text-scoring fallback.
 * @param query The search term
 * @param limit The maximum number of results to return
 * @returns Array of formatted search results
 */
export async function performRAGSearch(
  query: string,
  limit: number = 3,
  resourceId?: string,
): Promise<RAGSearchResult[]> {
  try {
    const db = adminDb();
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    if (searchTerms.length === 0) return [];

    const stopWords = new Set([
      "the", "is", "a", "and", "or", "in", "of", "to", "for", "with", "on", 
      "at", "by", "an", "this", "that", "it", "from", "as", "are", "be", "was",
      "were", "but", "not", "he", "she", "they", "them", "his", "her", "their"
    ]);
    const cleanTerms = searchTerms.filter(t => !stopWords.has(t));
    const queryTerms = (cleanTerms.length > 0 ? cleanTerms : searchTerms).slice(0, 10);

    // 1. Search in resource_content collection
    let contentRef = db.collection("resource_content") as any;
    if (resourceId) {
      contentRef = contentRef.where("resource_id", "==", resourceId);
    } else if (queryTerms.length > 0) {
      contentRef = contentRef.where("search_tokens", "array-contains-any", queryTerms);
    } else {
      return [];
    }
    const snapshot = await contentRef.get();
    
    const matches: any[] = [];
    snapshot.docs.forEach((doc: any) => {
      const d = doc.data();
      const content = (d.content || "").toLowerCase();
      const title = (d.title || "").toLowerCase();
      const subjectName = (d.subject_name || "").toLowerCase();

      let score = 0;
      searchTerms.forEach(term => {
        if (title.includes(term)) score += 10;        // Title match is highly relevant
        if (subjectName.includes(term)) score += 5;    // Subject match is moderately relevant
        if (content.includes(term)) score += 2;        // Body content match
      });

      if (resourceId) score += 1; // Guarantee inclusion if explicitly selected

      if (score > 0) {
        matches.push({
          resource_id: d.resource_id,
          title: d.title || "Untitled",
          snippet: d.snippet || d.content?.substring(0, 1500) + "..." || "",
          subject_name: d.subject_name || "Unknown",
          branch: d.branch,
          semester: d.semester,
          file_url: d.file_url,
          score
        });
      }
    });

    // 2. Fallback: Search in resources by title if no content matches found
    if (matches.length === 0) {
      let resourcesRef = db.collection("resources") as any;
      if (resourceId) {
        resourcesRef = resourcesRef.where("__name__", "==", resourceId);
      }
      const resSnapshot = await resourcesRef.get();

      resSnapshot.docs.forEach((doc: any) => {
        const d = doc.data();
        const title = (d.title || "").toLowerCase();

        let score = 0;
        searchTerms.forEach(term => {
          if (title.includes(term)) score += 1;
        });

        if (score > 0) {
          matches.push({
            resource_id: doc.id,
            title: d.title || "Untitled",
            snippet: `Matched by title: ${d.title}`,
            subject_name: d.subject_name || "Unknown",
            branch: d.branch,
            semester: d.semester,
            file_url: d.file_url,
            score
          });
        }
      });
    }

    // Sort by relevance score desc
    matches.sort((a, b) => b.score - a.score);

    return matches.slice(0, limit).map(r => ({
      resource_id: r.resource_id,
      title: r.title,
      file_url: r.file_url,
      subject_name: r.subject_name,
      branch: r.branch,
      semester: r.semester,
      snippet: r.snippet
    }));

  } catch (err) {
    console.error("RAG Search Critical Error:", err);
  }

  return [];
}
