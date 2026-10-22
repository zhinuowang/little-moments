import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { useAuth } from '../../store/AuthContext'
import { Momo } from '../momo/Momo'
import { Sheet } from '../ui/Bits'
import { EmailLinkForm } from './EmailLinkForm'

/**
 * Optional sign-in from Settings: the same email-link form as the welcome screen.
 * Google sits underneath only when it's switched on and reachable from this network.
 */
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { toast } = useApp()
  const auth = useAuth()
  const [google, setGoogle] = useState<'checking' | 'yes' | 'off' | 'unreachable'>('checking')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setGoogle('checking')
    auth.googleAvailable().then((g) => { if (alive) setGoogle(g) })
    return () => { alive = false }
  }, [open, auth])

  useEffect(() => { if (auth.status === 'signed-in' && open) { toast(t('auth.welcome'), 'love'); onClose() } }, [auth.status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={open} onClose={onClose} title={t('auth.title')}>
      <div className="-mt-2 mb-5 flex items-center gap-3">
        <Momo state="happy" className="h-14 w-14 shrink-0" decorative />
        <p className="text-[14px] leading-relaxed text-ink-2">{t('auth.intro')}</p>
      </div>

      {open && <EmailLinkForm />}

      {google !== 'off' && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3 text-[12px] text-faint" aria-hidden="true"><span className="h-px flex-1 bg-line" />{t('auth.or')}<span className="h-px flex-1 bg-line" /></div>
          <button
            type="button" className="btn w-full" disabled={google !== 'yes' || busy}
            onClick={async () => { setBusy(true); const err = await auth.signInWithGoogle(); if (err) setBusy(false) }}
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
