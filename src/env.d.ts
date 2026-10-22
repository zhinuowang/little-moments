/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd1234.supabase.co — public. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (anon) key — public by design; Row Level Security protects the data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** 'open' once email sign-in reaches real inboxes; anything else shows a "still being set up" note */
  readonly VITE_EMAIL_SIGNIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
