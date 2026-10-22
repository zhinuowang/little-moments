import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { EmailLinkForm } from '../components/account/EmailLinkForm'
import { LiveMomo } from '../components/momo/LiveMomo'
import { LangSwitch } from '../components/ui/Nav'
import { YarnDot } from '../components/ui/Yarn'
import { useI18n } from '../i18n'
import { setEntry } from '../lib/entry'
import { play } from '../lib/sound'
import { navigate } from '../store/router'

const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.15 + i * 0.12, ease: [0.2, 0.7, 0.2, 1] as const },
})

/**
 * The front door, shown once to a first-time visitor (and again only if asked for in Settings).
 * Two ways in: an emailed sign-in link, or straight in as a guest. Nothing here touches the diary.
 */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'choose' | 'email'>('choose')

  const asGuest = () => {
    play('tap')
    setEntry('guest')
    navigate('', { replace: true })
    onEnter()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10">
      <header className="flex justify-end pt-5"><LangSwitch /></header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div {...rise(0)} className="w-40 sm:w-44">
          <LiveMomo state="greeting" label={t('home.petMomo')} ground />
        </motion.div>

        <motion.h1 {...rise(1)} className="mt-6 font-hand text-[30px] leading-none">
          {t('app.name')}<YarnDot className="ml-0.5 inline-block h-[0.4em] w-[0.4em] align-baseline" />
        </motion.h1>
        <motion.p {...rise(2)} className="mt-3 text-[16px] text-ink-2">{t('welcome.tagline')}</motion.p>

        <div className="mt-10 w-full">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'choose' ? (
              <motion.div key="choose" {...rise(3)} exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }} className="space-y-3">
                <button className="btn btn-primary w-full" onClick={() => { play('tap'); setMode('email') }}>
                  <svg viewBox="0 0 20 20" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 6 L10 11 L16.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t('welcome.email')}
                </button>
                <button className="btn w-full" onClick={asGuest}>{t('welcome.guest')}</button>
                <p className="pt-2 text-[12px] leading-relaxed text-faint">{t('welcome.guestNote')}</p>
              </motion.div>
            ) : (
              <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <EmailLinkForm autoFocus />
                <div className="mt-5 flex items-center justify-between text-[13px]">
                  <button className="btn btn-quiet btn-sm -ml-3" onClick={() => setMode('choose')}>← {t('common.back')}</button>
                  <button className="btn btn-quiet btn-sm -mr-3" onClick={asGuest}>{t('welcome.guestInstead')}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
