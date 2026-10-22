/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd1234.supabase.co — public. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (anon) key — public by design; Row Level Security protects the data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
