/**
 * runtime/lib/supabase.mjs
 * Mock/Stub Supabase client for runtime tools compatibility.
 */

export function getClient() {
  console.warn("⚠️ Called mock Supabase client.");
  return {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null })
  };
}

export function getUrl() {
  return "https://mock-supabase.co";
}

export function getServiceKey() {
  return "mock-service-key";
}

export function getAnonKey() {
  return "mock-anon-key";
}

export function getProjectRef() {
  return "mock-project";
}
