import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { setDateLocale } from '../lib/util'
import { en, type Key } from './en'
import { zh } from './zh'

export type Lang = 'en' | 'zh'
export type { Key }
type Vars = Record<string, string | number>

const DICTS: Record<Lang, Record<Key, string | readonly string[]>> = { en, zh }
const STORAGE_KEY = 'lm-lang'

/** Saved choice first, then the browser's language, then English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh') return saved
  } catch { /* storage blocked — fall through */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return langs.some((l) => l?.toLowerCase().startsWith('zh')) ? 'zh' : 'en'
}

function applyLang(lang: Lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  setDateLocale(lang === 'zh' ? 'zh-CN' : 'en-US')
}

function fill(s: string, vars?: Vars) {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  /** a single string (first item if the entry is a list) */
  t: (key: Key, vars?: Vars) => string
  /** a list of strings, e.g. Momo's lines */
  tl: (key: Key) => readonly string[]
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = detectLang()
    applyLang(l)
    return l
  })

  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* fine */ }
    applyLang(l)
    setLangState(l)
  }, [])

  const value = useMemo<I18n>(() => {
    const dict = DICTS[lang]
    const raw = (key: Key) => dict[key] ?? en[key]
    return {
      lang,
      setLang,
      t: (key, vars) => {
        const v = raw(key)
        return fill(typeof v === 'string' ? v : v[0], vars)
      },
      tl: (key) => {
        const v = raw(key)
        return typeof v === 'string' ? [v] : v
      },
    }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n must be used inside I18nProvider')
  return c
}

/** Locale-aware duration text, e.g. "20 min" / "20 分钟". */
export function useDuration() {
  const { t } = useI18n()
  return (min: number) => {
    if (min < 60) return t('time.min', { n: min })
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? t('time.hm', { h, m }) : t('time.h', { h })
  }
}
