import { useI18n, type Key } from '../../i18n'
import { useApp } from '../../store/AppContext'

/**
 * One quiet line about cloud saving, for a signed-in account. Says "saved to cloud" only after
 * Supabase confirmed every change. Renders nothing for guests.
 */
export function SyncStatus({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const { sync, retrySync } = useApp()
  if (sync.status === 'off') return null
  const key: Key =
    sync.status === 'syncing' ? 'sync.syncing'
    : sync.status === 'synced' ? 'sync.saved'
    : sync.status === 'error' ? (sync.failure === 'auth' ? 'sync.signInAgain' : sync.failure === 'quota' ? 'sync.photoLimit' : 'sync.error')
    : 'sync.waiting'
  const dot = sync.status === 'synced' ? 'bg-ink' : sync.status === 'error' ? 'border border-ink bg-transparent' : 'bg-faint'
  return (
    <p className={`flex items-center gap-1.5 text-[12px] text-muted ${className}`} role="status" aria-live="polite">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot} ${sync.status === 'syncing' ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {t(key, { n: sync.pending })}
      {sync.status === 'error' && sync.failure !== 'auth' && sync.failure !== 'quota' && (
        <button className="ml-1 text-ink underline underline-offset-2" onClick={retrySync}>{t('sync.retry')}</button>
      )}
    </p>
  )
}
