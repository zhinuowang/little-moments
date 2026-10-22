import { motion } from 'motion/react'
import { LiveMomo } from '../components/momo/LiveMomo'
import { useRef, useState } from 'react'
import { JournalPage } from '../components/journal/JournalPage'
import { Confirm } from '../components/ui/Bits'
import { ACTIVITY_BY_ID } from '../data/activities'
import { useI18n } from '../i18n'
import { downloadBlob } from '../lib/backup'
import { blobToDataURL } from '../lib/image'
import { play } from '../lib/sound'
import { dateLocale, fromISODate, prettyDate } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'

export async function exportPageImage(node: HTMLElement, name: string) {
  const { toBlob } = await import('html-to-image')
  // html-to-image can't embed blob: photos reliably, so inline them as data URLs for the snapshot
  const imgs = [...node.querySelectorAll('img')]
  const original = imgs.map((i) => i.src)
  try {
    for (const img of imgs) {
      if (!img.src.startsWith('blob:')) continue
      img.src = await blobToDataURL(await (await fetch(img.src)).blob())
      await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1500))])
    }
    const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#F8F7F3' })
    if (!blob) throw new Error('empty image')
    downloadBlob(blob, name)
  } finally {
    imgs.forEach((img, i) => { img.src = original[i] })
  }
}

const monthName = (d: string) => fromISODate(d.slice(0, 7) + '-01').toLocaleDateString(dateLocale(), { month: 'long' })

export function EntryView({ id }: { id?: string }) {
  const { entries, deleteEntry, saveEntry, toast } = useApp()
  const { t } = useI18n()
  const i = entries.findIndex((e) => e.id === id)
  const entry = entries[i]
  const pageRef = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [justSealed, setJustSealed] = useState<string | null>(null)

  if (!entry) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="w-32"><LiveMomo state="thinking" label={t('home.petMomo')} ground /></div>
        <p className="mt-6 text-lg">{t('entry.missing')}</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate('diary')}>{t('editor.backDiary')}</button>
      </div>
    )
  }
  const newer = entries[i - 1]
  const older = entries[i + 1]
  const activity = entry.activityId ? ACTIVITY_BY_ID[entry.activityId] : undefined

  const seal = async () => {
    try {
      await saveEntry({ ...entry, sealed: true })
      play('stamp')
      setJustSealed(entry.id)
      toast(t('entry.stamped'), 'love')
    } catch { /* saveEntry has already said why */ }
  }

  const doExport = async () => {
    if (!pageRef.current) return
    setExporting(true)
    try {
      await exportPageImage(pageRef.current, `little-moment-${entry.date}.png`)
      toast(t('entry.exported'), 'love')
    } catch (err) {
      console.warn(err)
      toast(t('entry.exportFail'), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <button className="btn btn-quiet btn-sm -ml-3" onClick={() => navigate(`diary?month=${entry.date.slice(0, 7)}`)}>← {t('diary.monthBook', { m: monthName(entry.date) })}</button>
        <span className="text-[13px] text-muted">{prettyDate(entry.date, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <motion.div key={entry.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <JournalPage ref={pageRef} entry={entry} stamp={justSealed === entry.id ? 'animate' : 'static'} />
      </motion.div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-1">
        <button className="btn btn-primary" onClick={() => { play('tap'); navigate(`journal/${entry.id}`) }}>{t('entry.edit')}</button>
        {entry.sealed === false && (
          <button className="btn" onClick={seal}>
            <svg viewBox="0 0 20 20" className="-ml-1 mr-1.5 h-4 w-4" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#C8372D" strokeWidth="2.2" /><circle cx="10" cy="10" r="2.2" fill="#C8372D" /></svg>
            {t('entry.stampIt')}
          </button>
        )}
        <button className="btn btn-quiet" onClick={doExport} disabled={exporting}>{exporting ? t('entry.exporting') : t('entry.export')}</button>
        {activity && <button className="btn btn-quiet" onClick={() => navigate(`ritual/${activity.id}`)}>{t('entry.doAgain')}</button>}
        <button className="btn btn-quiet" onClick={() => setConfirm(true)}>{t('entry.delete')}</button>
      </div>
      <div className="mt-6 flex justify-between border-t border-line pt-4">
        <button className="btn btn-quiet btn-sm -ml-3" disabled={!older} onClick={() => older && navigate(`entry/${older.id}`, { replace: true })}>← {t('entry.earlier')}</button>
        <button className="btn btn-quiet btn-sm -mr-3" disabled={!newer} onClick={() => newer && navigate(`entry/${newer.id}`, { replace: true })}>{t('entry.later')} →</button>
      </div>
      <Confirm
        open={confirm}
        title={t('entry.deleteTitle')}
        body={t('entry.deleteBody')}
        confirmLabel={t('entry.deleteConfirm')}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false)
          try {
            await deleteEntry(entry.id)
            toast(t('entry.deleted'))
            navigate(`diary?month=${entry.date.slice(0, 7)}`, { replace: true })
          } catch {
            toast(t('entry.deleteFail'), 'error')
          }
        }}
      />
    </div>
  )
}
