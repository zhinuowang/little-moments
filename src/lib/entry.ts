/**
 * How this person came into Little Moments, remembered on this device so the welcome screen
 * isn't shown on every visit. 'guest' = chose to look around without an account,
 * 'account' = has signed in here before. Nothing about the diary is stored here.
 */

export type Entry = 'guest' | 'account'

const KEY = 'lm-entry'

export function getEntry(): Entry | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'guest' || v === 'account' ? v : null
  } catch { return null }
}

export function setEntry(v: Entry | null) {
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY) } catch { /* private mode */ }
}
