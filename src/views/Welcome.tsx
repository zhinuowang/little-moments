import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { GoogleMark } from '../components/account/GoogleMark'
import { LiveMomo } from '../components/momo/LiveMomo'
import { LangSwitch } from '../components/ui/Nav'
import { useI18n, type Key } from '../i18n'
import { setEntry } from '../lib/entry'
import { play } from '../lib/sound'
import { useAuth } from '../store/AuthContext'
import { navigate } from '../store/router'

const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.2, 0.7, 0.2, 1] as const },
})

/**
 * The front door, shown once to a first-time visitor (and again only if asked for in Settings):
 * Continue with Google, or Continue as Guest. Nothing here touches the diary.
 */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { t } = useI18n()
  const auth = useAuth()
  const [google, setGoogle] = useState<'checking' | 'yes' | 'off' | 'unreachable'>('checking')
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    auth.googleAvailable().then((g) => { if (alive) setGoogle(g) })
    return () => { alive = false }
  }, [auth])

  const asGuest = () => {
    play('tap')
    setEntry('guest')
    navigate('', { replace: true })
    onEnter()
  }
  const withGoogle = async () => {
    play('tap')
    setLeaving(true); setError(null)
    const err = await auth.signInWithGoogle() // leaves for Google and comes back signed in
    if (err) { setLeaving(false); setError(t(`auth.err.${err}` as Key)) }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-10">
      <header className="flex justify-end pt-5"><LangSwitch /></header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div {...rise(0)} className="w-36 sm:w-40">
          <LiveMomo state="greeting" label={t('home.petMomo')} ground />
        </motion.div>
        <motion.h1 {...rise(1)} className="mt-7 font-hand text-[32px] leading-none">{t('welcome.title')}</motion.h1>
        <motion.p {...rise(2)} className="mt-3 text-[15px] text-muted">{t('welcome.tagline')}</motion.p>

        <motion.div {...rise(3)} className="mt-12 flex w-full flex-col items-stretch gap-3">
          <button className="btn btn-primary w-full" onClick={withGoogle} disabled={leaving || google !== 'yes'}>
            <span className="-ml-1 mr-2.5 grid h-5 w-5 place-items-center rounded-full bg-white"><GoogleMark className="h-3.5 w-3.5" /></span>
            {leaving ? t('welcome.toGoogle') : t('auth.google')}
          </button>
          {google === 'unreachable' && <p className="text-[12px] leading-relaxed text-muted">{t('auth.googleUnreachable')}</p>}
          {google === 'off' && <p className="text-[12px] leading-relaxed text-muted">{t('auth.googleOff')}</p>}
          {error && <p role="alert" className="text-[12px] leading-relaxed text-ink">{error}</p>}
          <button className="mx-auto mt-5 text-[14px] text-muted underline decoration-faint underline-offset-4 transition-colors hover:text-ink" onClick={asGuest} disabled={leaving}>
            {t('welcome.guest')}
          </button>
          <p className="text-[12px] leading-relaxed text-faint">{t('welcome.guestNote')}</p>
        </motion.div>
      </main>
    </div>
  )
}
