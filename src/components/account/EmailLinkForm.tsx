import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useI18n, type Key } from '../../i18n'
import { play } from '../../lib/sound'
import { emailSigninOpen } from '../../lib/cloud/config'
import { useAuth, type AuthError } from '../../store/AuthContext'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESEND_AFTER = 60

/**
 * Email → "check your inbox". Typing an address signs no one in: only opening the emailed link
 * (which Supabase verifies) does. Used on the welcome screen and in Settings.
 */
export function EmailLinkForm({ autoFocus }: { autoFocus?: boolean }) {
  const { t } = useI18n()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthError | 'need-email' | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const tm = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(tm)
  }, [wait])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!EMAIL.test(email.trim())) { setError('need-email'); return }
    setBusy(true); setError(null)
    const err = await auth.sendLink(email)
    setBusy(false)
    if (err) { setError(err); if (err === 'rate-limit') setWait(RESEND_AFTER); return }
    play('pop')
    setSent(true); setWait(RESEND_AFTER)
  }

  const errorLine = error && (
    <p id="auth-err" role="alert" className="text-[13px] leading-relaxed text-ink">
      {t(`auth.err.${error}` as Key)}
      {error !== 'need-email' && auth.lastErrorDetail && <span className="mt-1 block text-[11px] text-faint">{t('auth.errDetail', { d: auth.lastErrorDetail })}</span>}
    </p>
  )

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-center" aria-live="polite">
        <Envelope />
        <h2 className="mt-3 text-[20px]">{t('auth.inboxTitle')}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t('auth.inboxBody', { email: email.trim() })}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{t('auth.inboxHint')}</p>
        <div className="mt-3">{errorLine}</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-[13px]">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setSent(false); setError(null) }}>{t('auth.otherEmail')}</button>
          <button type="button" className="btn btn-quiet btn-sm" disabled={wait > 0 || busy} onClick={() => send()}>
            {wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.resend')}
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={send} noValidate className="space-y-4 text-left">
      <label className="block">
        <span className="label">{t('auth.email')}</span>
        <input
          className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} autoFocus={autoFocus}
          placeholder={t('auth.emailPh')} aria-invalid={!!error} aria-describedby={error ? 'auth-err' : undefined} data-autofocus
        />
      </label>
      {errorLine}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || wait > 0}>
        {busy ? t('auth.sending') : wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.send')}
      </button>
      <p className="text-center text-[12px] leading-relaxed text-faint">{t('auth.noPassword')}</p>
      {!emailSigninOpen && <p className="text-center text-[12px] leading-relaxed text-muted">{t('auth.emailLimited')}</p>}
    </form>
  )
}

/** A small doodle envelope with a heart seal. */
function Envelope() {
  const o = { fill: '#FFFFFF', stroke: '#1F1F1F', strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 80 56" className="mx-auto h-14 w-20" aria-hidden="true">
      <rect x={6} y={8} width={68} height={42} rx={5} {...o} />
      <path d="M8 12 L40 33 L72 12" {...o} fill="none" />
      <path d="M40 30 C 40 26.5, 45 26.5, 45 30 C 45 33, 40 36, 40 36 C 40 36, 35 33, 35 30 C 35 26.5, 40 26.5, 40 30 Z" fill="#1F1F1F" stroke="#1F1F1F" strokeWidth={1} />
    </svg>
  )
}
