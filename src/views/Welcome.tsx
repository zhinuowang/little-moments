import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EmailLinkForm } from '../components/account/EmailLinkForm'
import { GoogleMark } from '../components/account/GoogleMark'
import { LiveMomo } from '../components/momo/LiveMomo'
import { LangSwitch } from '../components/ui/Nav'
import { useI18n } from '../i18n'
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
 * The front door, shown once to a first-time visitor (and again only if asked for in Settings).
 * Google first where it's set up and reachable, email for everyone else (including mainland China),
 * or straight in as a guest. Nothing here touches the diary.
 */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { t } = useI18n()
  const auth = useAuth()
  const [mode, setMode] = useState<'choose' | 'email'>('choose')
  const [google, setGoogle] = useState<'checking' | 'yes' | 'off' | 'unreachable'>('checking')
  const [leaving, setLeaving] = useState(false)
  const [googleError, setGoogleError] = useState(false)

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
    setLeaving(true); setGoogleError(false)
    const err = await auth.signInWithGoogle() // leaves for Google; comes back signed in
    if (err) { setLeaving(false); setGoogleError(true) }
  }
  const googleFirst = google === 'yes'

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-10">
      <header className="flex justify-end pt-5"><LangSwitch /></header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div {...rise(0)} className="w-36 sm:w-40">
          <LiveMomo state="greeting" label={t('home.petMomo')} ground />
        </motion.div>
        <motion.h1 {...rise(1)} className="mt-7 font-hand text-[32px] leading-none">{t('welcome.title')}</motion.h1>
        <motion.p {...rise(2)} className="mt-3 text-[15px] text-muted">{t('welcome.tagline')}</motion.p>

        <div className="mt-12 w-full">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'choose' ? (
              <motion.div key="choose" {...rise(3)} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col items-stretch gap-3">
                {googleFirst && (
                  <button className="btn btn-primary w-full" onClick={withGoogle} disabled={leaving}>
                    <span className="-ml-1 mr-2.5 grid h-5 w-5 place-items-center rounded-full bg-white"><GoogleMark className="h-3.5 w-3.5" /></span>
                    {leaving ? t('welcome.toGoogle') : t('auth.google')}
                  </button>
                )}
                <button className={`btn w-full ${googleFirst ? '' : 'btn-primary'}`} onClick={() => { play('tap'); setMode('email') }} disabled={leaving}>
                  {t('welcome.email')}
                </button>
                {google === 'unreachable' && <p className="text-[12px] leading-relaxed text-muted">{t('auth.googleUnreachable')}</p>}
                {googleError && <p role="alert" className="text-[12px] leading-relaxed text-ink">{t('auth.err.offline')}</p>}
                <button className="mx-auto mt-5 text-[14px] text-muted underline decoration-faint underline-offset-4 transition-colors hover:text-ink" onClick={asGuest} disabled={leaving}>
                  {t('welcome.guest')}
                </button>
              </motion.div>
            ) : (
              <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <EmailLinkForm autoFocus />
                <div className="mt-6 flex items-center justify-between text-[13px]">
                  <button className="btn btn-quiet btn-sm -ml-3" onClick={() => setMode('choose')}>← {t('common.back')}</button>
                  <button className="text-[13px] text-muted underline decoration-faint underline-offset-4 hover:text-ink" onClick={asGuest}>{t('welcome.guest')}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
