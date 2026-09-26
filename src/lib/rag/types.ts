export interface ChunkRecord {
  id: string;
  resource_id: string;
  chunk_index: number;
  text: string;
  section_label: string;
  heading?: string;
  academic_year?: string;
  branch: string;
  semester: number | null;
  subject_id: string;
  subject_name: string;
  category: string;
  title: string;
  file_url: string;
  chunk_tokens: string[];
  token_count: number;
  content_hash?: string;
  embedding?: number[];
}

export interface RetrievalSource {
  id: string;
  marker: string;
  resource_id: string;
  chunk_index: number;
  title: string;
  subject_name: string;
  section_label: string;
  heading?: string;
  file_url?: string;
  branch?: string;
  semester?: number | null;
  category?: string;
  snippet: string;
  score: number;
}

export interface RetrievalResult {
  sources: RetrievalSource[];
  contextBlocks: string[];
  contextChars: number;
  widened: boolean;
  queryTerms: string[];
}

export interface RetrieveParams {
  query: string;
  academicYear?: string;
  branch?: string;
  semester?: number;
  resourceId?: string;
  limit?: number;
  categoryBoost?: string[];
  subjects?: string[];
  queryEmbedding?: number[];
}

export interface CorpusStats {
  total_chunks: number;
  avg_token_count: number;
  doc_freq: Record<string, number>;
  updated_at: string;
}

export type QueryIntent =
  | "definition"
  | "explain"
  | "compare"
  | "pyq"
  | "syllabus"
  | "locate"
  | "capability"
  | "out_of_scope";

export interface RoutedQuery {
  intent: QueryIntent;
  subject?: string;
  unitNumber?: number;
  category?: string;
  cleanQuery: string;
}
