/** Mirror of src/lib/rag/config.ts for the home-server package. */
export const CHUNK_TARGET_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 150;
export const RRF_K = 60;
export const CONTEXT_BUDGET_CHARS = 6000;
export const EMBED_DIMS = 768;
export const EMBED_MODEL = "gemini-embedding-001";
export const BM25_CANDIDATE_LIMIT = 80;
export const VECTOR_CANDIDATE_LIMIT = 60;
export const MAX_CHUNKS_PER_RESOURCE = 3;
export const NEIGHBOR_EXPANSION_TOP = 3;
export const SEMANTIC_CACHE_DISTANCE = 0.12;
export const CHAT_TEMPERATURE = 0.2;
export const EMBED_BATCH_SIZE = 100;
