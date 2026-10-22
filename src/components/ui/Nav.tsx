import type { ReactNode } from 'react'
import { useI18n, type Key, type Lang } from '../../i18n'
import { play } from '../../lib/sound'
import { navigate } from '../../store/router'

const s = { stroke: 'currentColor', strokeWidth: 2.1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, fill: 'none' }

/** Thin, slightly wobbly line icons. */
const ICONS: Record<string, ReactNode> = {
  home: <path d="M4.5 11.5 L12 5 L19.5 11.2 M6.5 10 V19 H17.5 V9.8" {...s} />,
  discover: <><path d="M5 7.5 H19 V17.5 H5 Z" {...s} /><path d="M5.2 8 L12 13 L18.8 8" {...s} /></>,
  plans: <path d="M12 8 C 12 4.5, 19 4.5, 19 9.5 C 19 13.5, 12 18.5, 12 18.5 C 12 18.5, 5 13.5, 5 9.5 C 5 4.5, 12 4.5, 12 8 Z" {...s} />,
  diary: <><path d="M6.5 4.5 H17 C 17.6 4.5, 18 4.9, 18 5.5 V19.5 H7.5 C 6.9 19.5, 6.5 19.1, 6.5 18.5 Z" {...s} /><path d="M10 9 H15 M10 12 H14" {...s} /></>,
  settings: <><path d="M7 9 L6.2 4.5 L10 7 C 11.3 6.6, 12.7 6.6, 14 7 L17.8 4.5 L17 9 C 18.3 10.7, 18.5 13, 17.6 15 C 16.5 17.6, 14.4 19, 12 19 C 9.6 19, 7.5 17.6, 6.4 15 C 5.5 13, 5.7 10.7, 7 9 Z" {...s} /><circle cx="10" cy="12.5" r="0.9" fill="currentColor" /><circle cx="14" cy="12.5" r="0.9" fill="currentColor" /></>,
}

export const NAV_ITEMS: { id: string; key: Key; to: string }[] = [
  { id: 'home', key: 'nav.home', to: '' },
  { id: 'discover', key: 'nav.discover', to: 'discover' },
  { id: 'plans', key: 'nav.plans', to: 'plans' },
  { id: 'diary', key: 'nav.diary', to: 'diary' },
  { id: 'settings', key: 'nav.settings', to: 'settings' },
]

function NavLink({ id, label, to, on, compact }: { id: string; label: string; to: string; on: boolean; compact?: boolean }) {
  return (
    <a
      href={`#/${to}`}
      onClick={(e) => { e.preventDefault(); navigate(to) }}
      aria-current={on ? 'page' : undefined}
      className={compact
        ? `flex flex-col items-center gap-0.5 px-2 py-1 font-hand text-[11.5px] transition-colors ${on ? 'text-ink' : 'text-faint hover:text-ink'}`
        : `relative px-1 py-1 font-hand text-[15px] transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
    >
      {compact && <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">{ICONS[id]}</svg>}
      <span className={on && compact ? 'font-medium' : undefined}>{label}</span>
      {on && !compact && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ink" aria-hidden="true" />}
    </a>
  )
}

/** Desktop: quiet text links in the header. */
export function TopNav({ active }: { active: string }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('nav.main')}>
      <ul className="flex items-center gap-6">
        {NAV_ITEMS.map((n) => (
          <li key={n.id}><NavLink id={n.id} label={t(n.key)} to={n.to} on={active === n.id} /></li>
        ))}
      </ul>
    </nav>
  )
}

/** Phones: a light tab bar with thin icons. */
export function BottomNav({ active }: { active: string }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((n) => (
          <li key={n.id} className="flex-1">
            <NavLink id={n.id} label={t(n.key)} to={n.to} on={active === n.id} compact />
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** "EN / 中文" — compact, always visible in the header. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  const opt = (l: Lang, label: string, aria: string) => (
    <button
      type="button"
      onClick={() => { if (l !== lang) { play('tap'); setLang(l) } }}
      aria-pressed={lang === l}
      aria-label={aria}
      lang={l === 'zh' ? 'zh-CN' : 'en'}
      className={`rounded-full px-2.5 py-0.5 font-hand text-[14px] transition-colors ${lang === l ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex items-center gap-0.5 ${className}`}>
      {opt('en', 'EN', 'English')}
      {opt('zh', '中文', '简体中文')}
    </div>
  )
}
