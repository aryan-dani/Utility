import { createAdminClient } from "./supabaseAdmin";

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
 * Shared utility for searching resources via RPC with a fallback to basic text search.
 * @param query The search term
 * @param limit The maximum number of results to return
 * @returns Array of formatted search results
 */
export async function performRAGSearch(
  query: string,
  limit: number = 3,
): Promise<RAGSearchResult[]> {
  try {
    const supabase = createAdminClient();

    // Try the RPC first (full-text search function)
    const { data: searchResults, error: rpcError } = await supabase.rpc(
      "search_resource_content",
      {
        query_text: query,
      },
    );

    let finalResults = searchResults;

    // Robust Fallback: Use standard ILIKE/textSearch if RPC fails or returns nothing
    // To save egress, this fallback searches 'resources.title' rather than doing unindexed scans on 'resource_content.content'
    if (rpcError || !finalResults || finalResults.length === 0) {
      const { data: fallbackData } = await supabase
        .from("resources")
        .select(
          `
          id,
          title, 
          file_url,
          subjects!inner (
            name,
            branch,
            semester
          )
        `,
        )
        .ilike("title", `%${query}%`)
        .limit(limit);

      if (fallbackData) {
        finalResults = (fallbackData as any[]).map((r) => ({
          resource_id: r.id,
          title: r.title,
          file_url: r.file_url,
          subject_name: r.subjects.name,
          branch: r.subjects.branch,
          semester: r.subjects.semester,
          snippet: `Matched by title: ${r.title}`,
        }));
      }
    }

    if (finalResults && Array.isArray(finalResults)) {
      return finalResults.slice(0, limit).map((r: any) => ({
        resource_id: r.resource_id,
        title: r.title,
        file_url: r.file_url,
        subject_name: r.subject_name,
        branch: r.branch,
        semester: r.semester,
        snippet: r.snippet || r.content?.substring(0, 500) + "..." || "",
      }));
    }
  } catch (err) {
    console.error("RAG Search Critical Error:", err);
  }

  return [];
}
