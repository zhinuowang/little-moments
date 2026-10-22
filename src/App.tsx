import { MotionConfig } from 'motion/react'
import { LiveMomo } from './components/momo/LiveMomo'
import { lazy, Suspense, useEffect } from 'react'
import { Momo } from './components/momo/Momo'
import { Toasts } from './components/ui/Bits'
import { BottomNav, LangSwitch, TopNav } from './components/ui/Nav'
import { YarnDot } from './components/ui/Yarn'
import { useI18n } from './i18n'
import { useApp } from './store/AppContext'
import { navigate, useRoute } from './store/router'
import { Discover } from './views/Discover'
import { Home } from './views/Home'
import { RitualView } from './views/Ritual'

const Diary = lazy(() => import('./views/Diary').then((m) => ({ default: m.Diary })))
const Editor = lazy(() => import('./views/Editor').then((m) => ({ default: m.Editor })))
const EntryView = lazy(() => import('./views/EntryView').then((m) => ({ default: m.EntryView })))
const Plans = lazy(() => import('./views/Plans').then((m) => ({ default: m.Plans })))
const Settings = lazy(() => import('./views/Settings').then((m) => ({ default: m.Settings })))

export default function App() {
  const { loaded, storageOk, prefs } = useApp()
  const { t } = useI18n()
  const route = useRoute()
  const [section = '', id] = route.path

  useEffect(() => { window.scrollTo({ top: 0 }) }, [section, id])

  const active = section === '' ? 'home'
    : section === 'journal' || section === 'entry' ? 'diary'
    : section === 'ritual' ? 'discover'
    : section

  let view
  switch (section) {
    case '': view = <Home />; break
    case 'discover': view = <Discover query={route.query} />; break
    case 'plans': view = <Plans />; break
    case 'diary': view = <Diary query={route.query} />; break
    case 'entry': view = <EntryView id={id} />; break
    case 'journal': view = <Editor key={`${id}-${route.query.toString()}`} id={id} query={route.query} />; break
    case 'ritual': view = <RitualView key={id} id={id} />; break
    case 'settings': view = <Settings />; break
    case 'momo-sheet': view = import.meta.env.DEV ? <MomoSheet /> : <NotFound />; break
    default: view = <NotFound />
  }

  return (
    <MotionConfig reducedMotion={prefs.motion === 'reduced' ? 'always' : prefs.motion === 'full' ? 'never' : 'user'}>
      <a href="#main" className="sr-only-focusable btn btn-primary fixed top-2 left-2 z-[70]">{t('common.skipToContent')}</a>
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pb-28 md:px-8 md:pb-12">
        <header className="flex items-center justify-between gap-4 pt-5 pb-2 md:pt-7">
          <a href="#/" onClick={(e) => { e.preventDefault(); navigate('') }} className="font-hand text-[22px] leading-none font-semibold tracking-tight text-ink" aria-label={t('app.home')}>
            {t('app.name')}<YarnDot className="ml-0.5 inline-block h-[0.42em] w-[0.42em] align-baseline" />
          </a>
          <div className="flex items-center gap-6">
            <div className="hidden md:block"><TopNav active={active} /></div>
            <LangSwitch />
          </div>
        </header>
        {!storageOk && <p className="mt-3 rounded-2xl bg-pink px-4 py-3 text-sm text-ink" role="alert">{t('common.storageOff')}</p>}
        <main id="main" className="flex-1 pt-6 md:pt-10">
          {loaded ? <Suspense fallback={<Loading />}>{view}</Suspense> : <Loading waking />}
        </main>
      </div>
      <div className="md:hidden"><BottomNav active={active} /></div>
      <Toasts />
    </MotionConfig>
  )
}

function Loading({ waking }: { waking?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="grid place-items-center py-24 text-center" aria-busy="true">
      <Momo state="resting" className="h-24 w-24" decorative />
      <p className="mt-4 text-sm text-muted">{t(waking ? 'common.waking' : 'common.loading')}</p>
    </div>
  )
}

function NotFound() {
  const { t } = useI18n()
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="w-32"><LiveMomo state="thinking" label={t('home.petMomo')} ground /></div>
      <h1 className="mt-6 text-xl">{t('notFound.title')}</h1>
      <button className="btn btn-primary mt-6" onClick={() => navigate('')}>{t('notFound.back')}</button>
    </div>
  )
}

/** Dev-only: every pose on one page, for drawing review. */
function MomoSheet() {
  const states = ['idle', 'greeting', 'happy', 'thinking', 'calm', 'tea', 'quiet', 'excited', 'reading', 'journaling', 'celebrating', 'playing', 'resting', 'walking', 'poked', 'peek', 'curious', 'writing', 'presenting', 'watching'] as const
  return (
    <div className="grid grid-cols-3 gap-6 sm:grid-cols-5">
      {states.map((s) => <div key={s} className="text-center"><Momo state={s} className="w-full" ground /><p className="text-sm text-muted">{s}</p></div>)}
    </div>
  )
}
