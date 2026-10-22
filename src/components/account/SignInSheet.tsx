import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { useAuth } from '../../store/AuthContext'
import { Momo } from '../momo/Momo'
import { Sheet } from '../ui/Bits'
import { EmailLinkForm } from './EmailLinkForm'
import { GoogleMark } from './GoogleMark'

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
            <GoogleMark className="mr-2 h-4 w-4" />{t('auth.google')}
          </button>
          {google === 'unreachable' && <p className="mt-2 text-center text-[12px] text-muted">{t('auth.googleUnreachable')}</p>}
          {google === 'checking' && <p className="mt-2 text-center text-[12px] text-faint">{t('auth.googleChecking')}</p>}
        </div>
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-faint">{t('auth.guestNote')}</p>
    </Sheet>
  )
}
