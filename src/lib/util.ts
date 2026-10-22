export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function toISODate(d: Date = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

let LOCALE = 'en-US'
export const setDateLocale = (l: string) => { LOCALE = l }
export const dateLocale = () => LOCALE

export function prettyDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return fromISODate(s).toLocaleDateString(LOCALE, opts)
}

export function stampDate(s: string) {
  const d = fromISODate(s)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: LOCALE.startsWith('zh') ? `${d.getMonth() + 1}月` : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    year: String(d.getFullYear()),
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Small deterministic PRNG so "random" picks are stable within a day. */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
