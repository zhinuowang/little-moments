import { useState } from 'react'
import { useI18n } from '../../i18n'
import { exportBackup } from '../../lib/backup'
import { play } from '../../lib/sound'
import { useApp } from '../../store/AppContext'
import { Confirm } from '../ui/Bits'

/**
 * For a signed-in account: diary pages that were on this device before diary sync started are
 * never uploaded on their own. This quiet note offers a backup and an explicit upload (a copy —
 * the pages stay on this device). "Not now" hides it for this visit only.
 */
export function LocalPagesNotice() {
  const { t } = useI18n()
  const { profile, localOnlyPages, uploadLocalOnlyPages, toast } = useApp()
  const [hidden, setHidden] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [backedUp, setBackedUp] = useState(false)
  const [busy, setBusy] = useState(false)
  if (profile !== 'account' || localOnlyPages === 0 || hidden) return null

  const backup = async () => {
    setBusy(true)
    try { await exportBackup(); setBackedUp(true); toast(t('localPages.backedUp'), 'love') }
    catch { toast(t('settings.exportFail'), 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="mb-8 border-y border-line py-4 text-[13px] leading-relaxed text-ink-2" role="region" aria-label={t('localPages.title')}>
      <p>{t(localOnlyPages === 1 ? 'localPages.body1' : 'localPages.bodyN', { n: localOnlyPages })}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-sm" onClick={backup} disabled={busy}>{backedUp ? `✓ ${t('localPages.backup')}` : t('localPages.backup')}</button>
        <button className="btn btn-primary btn-sm" onClick={() => setConfirm(true)} disabled={busy}>{t('localPages.upload', { n: localOnlyPages })}</button>
        <button className="btn btn-quiet btn-sm" onClick={() => setHidden(true)}>{t('localPages.notNow')}</button>
      </div>
      <Confirm
        open={confirm}
        title={t('localPages.confirmTitle', { n: localOnlyPages })}
        body={`${t('localPages.confirmBody')}${backedUp ? '' : ` ${t('localPages.confirmNoBackup')}`}`}
        confirmLabel={t('localPages.upload', { n: localOnlyPages })}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false); setBusy(true)
          try { const n = await uploadLocalOnlyPages(); play('pop'); toast(t('localPages.queued', { n }), 'love') }
          catch { toast(t('editor.saveFail'), 'error') }
          finally { setBusy(false) }
        }}
      />
    </div>
  )
}
