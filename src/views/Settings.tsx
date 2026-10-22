import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Confirm, PageTitle } from '../components/ui/Bits'
import { clearEverything, storageAvailable } from '../db/db'
import { useI18n, type Lang } from '../i18n'
import { BackupError, exportBackup, importBackup } from '../lib/backup'
import { play } from '../lib/sound'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { SignInSheet } from '../components/account/SignInSheet'
import type { MotionPref } from '../types'

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-line'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-line pt-6">
      <h2 className="eyebrow mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <div>
        <p className="text-[15px] text-ink">{title}</p>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export function Settings() {
  const { prefs, setPrefs, toast, reload, entries, plans } = useApp()
  const { t, lang, setLang } = useI18n()
  const [name, setName] = useState(prefs.name)
  const [usage, setUsage] = useState<number | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const est = await navigator.storage?.estimate?.()
        if (est?.usage != null) setUsage(est.usage / 1024 / 1024)
        setPersisted((await navigator.storage?.persisted?.()) ?? null)
      } catch { /* not supported — fine */ }
    })()
  }, [entries.length])

  const doExport = async () => {
    setBusy(true)
    try {
      const r = await exportBackup()
      toast(t('settings.exported', { e: r.entries, ph: r.photos, p: r.plans }), 'love')
    } catch {
      toast(t('settings.exportFail'), 'error')
    } finally { setBusy(false) }
  }
  const doImport = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!f) return
    setBusy(true)
    try {
      const r = await importBackup(f)
      await reload()
      toast(t('settings.imported', { e: r.entries, p: r.plans }), 'love')
    } catch (err) {
      toast(err instanceof BackupError ? t(err.code === 'notJson' ? 'settings.notJson' : 'settings.notBackup') : t('settings.importFail'), 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <PageTitle title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Section title={t('settings.language')}>
        <div role="radiogroup" aria-label={t('settings.language')} className="flex gap-1">
          {([['en', 'English'], ['zh', '简体中文']] as [Lang, string][]).map(([l, label]) => (
            <button key={l} role="radio" aria-checked={lang === l} lang={l === 'zh' ? 'zh-CN' : 'en'} className="chip" onClick={() => { play('tap'); setLang(l) }}>{label}</button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">{t('settings.languageHint')}</p>
      </Section>

      <AccountSection />

      <Section title={t('settings.you')}>
        <label className="block">
          <span className="label">{t('settings.nameLabel')}</span>
          <div className="flex gap-2">
            <input className="field" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t('settings.namePh')} />
            <button className="btn btn-primary" onClick={() => { setPrefs({ name: name.trim() }); toast(name.trim() ? t('settings.nameSaved', { name: name.trim() }) : t('settings.nameCleared'), 'love') }}>{t('common.save')}</button>
          </div>
        </label>
      </Section>

      <Section title={t('settings.soundMotion')}>
        <Row title={t('settings.sound')} hint={t('settings.soundHint')}>
          <Switch label={t('settings.sound')} checked={prefs.sound} onChange={(v) => { setPrefs({ sound: v }); if (v) setTimeout(() => play('chime'), 50) }} />
        </Row>
        <div className="mt-5" role="radiogroup" aria-label={t('settings.motion')}>
          <p className="text-[15px] text-ink">{t('settings.motion')}</p>
          <p className="mb-3 text-[13px] text-muted">{t('settings.motionHint')}</p>
          <div className="flex flex-wrap gap-1">
            {(['system', 'reduced', 'full'] as MotionPref[]).map((v) => (
              <button key={v} role="radio" aria-checked={prefs.motion === v} className="chip" onClick={() => setPrefs({ motion: v })}>{t(`settings.motion.${v}`)}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('settings.data')}>
        <p className="text-[14px] leading-relaxed text-ink-2">{t('settings.dataBody')}</p>
        <p className="mt-4 text-[13px] text-muted">
          {t('settings.counts', { e: entries.length, p: plans.length })}
          {usage != null ? ` · ${t('settings.usage', { mb: usage.toFixed(1) })}` : ''}
        </p>
        {!storageAvailable && <p className="mt-2 text-[13px] text-ink">{t('settings.storageOff')}</p>}
        {persisted === false && (
          <p className="mt-2 text-[13px] text-muted">
            {t('settings.persistHint')}{' '}
            <button className="text-ink underline underline-offset-4" onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(!!ok); toast(ok ? t('settings.persistOk') : t('settings.persistNo'), ok ? 'love' : 'info') }}>
              {t('settings.persistAsk')}
            </button>
          </p>
        )}
        {persisted && <p className="mt-2 text-[13px] text-muted">✓ {t('settings.persisted')}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={doExport} disabled={busy}>{t('settings.export')}</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>{t('settings.import')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
        </div>
        <p className="mt-3 text-[12px] text-faint">{t('settings.importHint')}</p>
        <button className="btn btn-quiet btn-sm mt-6 -ml-2" onClick={() => setConfirmWipe(true)}>{t('settings.erase')}</button>
      </Section>

      <Section title={t('settings.about')}>
        <p className="text-[14px] leading-relaxed text-ink-2">{t('settings.aboutBody')}</p>
        <p className="mt-2 text-[12px] text-faint">{t('settings.version', { v: '0.2' })}</p>
      </Section>

      <Confirm
        open={confirmWipe}
        title={t('settings.eraseTitle')}
        body={t('settings.eraseBody')}
        confirmLabel={t('settings.eraseConfirm')}
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          setConfirmWipe(false)
          try { await clearEverything(); await reload(); setName(''); toast(t('settings.erased')) }
          catch { toast(t('settings.eraseFail'), 'error') }
        }}
      />
    </div>
  )
}

/** Optional account. Shown only in builds with cloud sign-in configured; guest is the default. */
function AccountSection() {
  const { t } = useI18n()
  const { toast } = useApp()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  if (!auth.enabled) return null
  return (
    <Section title={t('settings.account')}>
      {auth.status === 'signed-in' ? (
        <>
          <p className="text-[15px] text-ink">{t('settings.signedInAs', { email: auth.email ?? '…' })}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('settings.syncNotYet')}</p>
          <button className="btn btn-quiet btn-sm mt-4 -ml-2" onClick={() => setConfirmOut(true)}>{t('settings.signOut')}</button>
        </>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed text-ink-2">{auth.status === 'checking' ? t('settings.accountChecking') : t('settings.guestBody')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={() => { play('tap'); setOpen(true) }} disabled={auth.status === 'checking'}>{t('settings.signIn')}</button>
            <button className="btn btn-quiet" onClick={() => { play('tap'); window.dispatchEvent(new Event('lm-show-welcome')) }} disabled={auth.status === 'checking'}>{t('settings.showWelcome')}</button>
          </div>
        </>
      )}
      <SignInSheet open={open} onClose={() => setOpen(false)} />
      <Confirm
        open={confirmOut}
        title={t('settings.signOutTitle')}
        body={t('settings.signOutBody')}
        confirmLabel={t('settings.signOut')}
        onCancel={() => setConfirmOut(false)}
        onConfirm={async () => { setConfirmOut(false); await auth.signOut(); toast(t('settings.signedOut')) }}
      />
    </Section>
  )
}
