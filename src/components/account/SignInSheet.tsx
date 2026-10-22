import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n, type Key } from '../../i18n'
import { play } from '../../lib/sound'
import { useApp } from '../../store/AppContext'
import { useAuth, type AuthError } from '../../store/AuthContext'
import { Momo } from '../momo/Momo'
import { Sheet } from '../ui/Bits'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESEND_AFTER = 60

/**
 * Optional sign-in, in a small sheet: an email, then the 6-digit code Supabase emails
 * (signInWithOtp → verifyOtp). Works the same for a first visit and a returning one.
 * Google sits underneath only when it's switched on and reachable from this network.
 */
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { toast } = useApp()
  const auth = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthError | 'need-email' | null>(null)
  const [wait, setWait] = useState(0)
  const [digitsOnly, setDigitsOnly] = useState(false)
  const [google, setGoogle] = useState<'checking' | 'yes' | 'off' | 'unreachable'>('checking')
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setGoogle('checking')
    auth.googleAvailable().then((g) => { if (alive) setGoogle(g) })
    return () => { alive = false }
  }, [open, auth])

  useEffect(() => {
    if (wait <= 0) return
    const tm = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(tm)
  }, [wait])

  useEffect(() => { if (auth.status === 'signed-in' && open) { toast(t('auth.welcome'), 'love'); close() } }, [auth.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setStep('email'); setCode(''); setError(null); onClose() }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!EMAIL.test(email.trim())) { setError('need-email'); return }
    setBusy(true); setError(null)
    const err = await auth.sendLink(email)
    setBusy(false)
    if (err) { setError(err); if (err === 'rate-limit') setWait(RESEND_AFTER); return }
    play('pop')
    setStep('code'); setWait(RESEND_AFTER); setCode('')
    setTimeout(() => codeRef.current?.focus(), 80)
  }

  const verify = async (e?: FormEvent, value = code) => {
    e?.preventDefault()
    if (value.length !== 6 || busy) return
    setBusy(true); setError(null)
    const err = await auth.verifyCode(email, value)
    setBusy(false)
    if (err) { setError(err === 'expired' ? 'bad-code' : err); setCode(''); setTimeout(() => codeRef.current?.focus(), 50) }
  }

  // digits only: spaces and dashes from a pasted "123 456" are ignored, anything else is refused
  const typeCode = (raw: string) => {
    const refused = /[^\d\s-]/.test(raw)
    setDigitsOnly(refused)
    if (refused) return
    const next = raw.replace(/\D/g, '').slice(0, 6)
    setCode(next); setError(null)
    if (next.length === 6) void verify(undefined, next)
  }

  const errorText = error && t(`auth.err.${error}` as Key)

  return (
    <Sheet open={open} onClose={close} title={t('auth.title')}>
      <div className="-mt-2 mb-5 flex items-center gap-3">
        <Momo state={step === 'code' ? 'curious' : 'happy'} className="h-14 w-14 shrink-0" decorative />
        <p className="text-[14px] leading-relaxed text-ink-2">{step === 'code' ? t('auth.sentTo', { email: email.trim() }) : t('auth.intro')}</p>
      </div>

      {step === 'email' ? (
        <form onSubmit={send} noValidate className="space-y-4">
          <label className="block">
            <span className="label">{t('auth.email')}</span>
            <input
              className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder={t('auth.emailPh')} aria-invalid={!!error} aria-describedby={error ? 'auth-err' : undefined} data-autofocus
            />
          </label>
          {errorText && (
            <p id="auth-err" role="alert" className="text-[13px] leading-relaxed text-ink">
              {errorText}
              {error !== 'need-email' && auth.lastErrorDetail && <span className="mt-1 block text-[11px] text-faint">{t('auth.errDetail', { d: auth.lastErrorDetail })}</span>}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? t('auth.sending') : t('auth.send')}</button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="space-y-4">
          <label className="block">
            <span className="label">{t('auth.code')}</span>
            <input
              ref={codeRef}
              className="field text-center font-[family-name:var(--font-type)] text-[24px] tracking-[0.5em]"
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
              value={code} onChange={(e) => typeCode(e.target.value)} disabled={busy}
              placeholder="······" aria-describedby="auth-code-hint" aria-invalid={!!error || digitsOnly}
            />
          </label>
          <p id="auth-code-hint" className="text-[13px] leading-relaxed text-muted">{digitsOnly ? t('auth.digitsOnly') : t('auth.codeHint')}</p>
          {errorText && <p role="alert" className="text-[13px] text-ink">{errorText}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? t('auth.checking') : t('auth.verify')}</button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <button type="button" className="btn btn-quiet btn-sm -ml-3" onClick={() => { setStep('email'); setError(null) }}>← {t('auth.otherEmail')}</button>
            <button type="button" className="btn btn-quiet btn-sm -mr-3" disabled={wait > 0 || busy} onClick={() => send()}>
              {wait > 0 ? t('auth.resendIn', { s: wait }) : t('auth.resend')}
            </button>
          </div>
        </form>
      )}

      {step === 'email' && google !== 'off' && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3 text-[12px] text-faint" aria-hidden="true"><span className="h-px flex-1 bg-line" />{t('auth.or')}<span className="h-px flex-1 bg-line" /></div>
          <button
            type="button" className="btn w-full" disabled={google !== 'yes' || busy}
            onClick={async () => { setBusy(true); const err = await auth.signInWithGoogle(); if (err) { setBusy(false); setError(err) } }}
          >
            <GoogleMark />{t('auth.google')}
          </button>
          {google === 'unreachable' && <p className="mt-2 text-center text-[12px] text-muted">{t('auth.googleUnreachable')}</p>}
          {google === 'checking' && <p className="mt-2 text-center text-[12px] text-faint">{t('auth.googleChecking')}</p>}
        </div>
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-faint">{t('auth.guestNote')}</p>
    </Sheet>
  )
}

/** Google's "G", in its required colours — the only colour in this sheet. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="mr-2 h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
