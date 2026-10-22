import { AnimatePresence, motion } from 'motion/react'
import { LiveMomo } from '../components/momo/LiveMomo'
import { useEffect, useRef, useState } from 'react'
import { MoodArt } from '../components/art/Icons'
import { STICKER_KINDS, StickerArt } from '../components/art/Stickers'
import { FRAMES, FrameThumb, JournalPage, LAYOUTS, THEMES, slotCount, textHint } from '../components/journal/JournalPage'
import { Confirm } from '../components/ui/Bits'
import { ACTIVITY_BY_ID, localizeActivity } from '../data/activities'
import { MOODS } from '../data/meta'
import { photosDb } from '../db/db'
import { useI18n, type Key, type Lang } from '../i18n'
import { compressImage, PhotoError } from '../lib/image'
import { play } from '../lib/sound'
import { registerTempPhoto } from '../lib/usePhoto'
import { clamp, toISODate, uid } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'
import type { JournalEntry, LayoutId, PageTheme, PlacedSticker } from '../types'

type Tab = 'words' | 'photos' | 'layout' | 'stickers' | 'details'
const TABS: Tab[] = ['words', 'photos', 'layout', 'stickers', 'details']
const MAX_TEXT = 900

function blankEntry(query: URLSearchParams, lang: Lang, todayMood?: JournalEntry['mood']): JournalEntry {
  const base = ACTIVITY_BY_ID[query.get('activity') ?? '']
  const a = base ? localizeActivity(base, lang) : undefined
  const title = query.get('title') ?? ''
  const date = query.get('date')
  const prompt = query.get('prompt')
  return {
    id: uid(),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toISODate(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mood: todayMood,
    activityId: a?.id,
    activityTitle: a?.title ?? (title || undefined),
    title: a ? a.title : title,
    text: prompt ? `${prompt}\n` : '',
    photoIds: [],
    stickers: [],
    layout: a?.place === 'outdoor' ? 'pair' : 'polaroid',
    theme: 'cream',
    frame: 'stamp',
    sealed: false,
  }
}

export function Editor({ id, query }: { id?: string; query: URLSearchParams }) {
  const { entries, saveEntry, prefs, toast } = useApp()
  const { t, tl, lang } = useI18n()
  const isNew = !id || id === 'new'
  const existing = isNew ? undefined : entries.find((e) => e.id === id)
  const todayMood = prefs.todayMood?.date === toISODate() ? prefs.todayMood.mood : undefined

  const [draft, setDraft] = useState<JournalEntry | null>(() => (existing ? structuredClone(existing) : isNew ? blankEntry(query, lang, todayMood) : null))
  const initial = useRef(JSON.stringify(draft))
  const tempPhotos = useRef(new Map<string, Blob>())
  const [tab, setTab] = useState<Tab>('words')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const slotTarget = useRef(0)

  const dirty = draft ? JSON.stringify(draft) !== initial.current : false

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!draft) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="w-32"><LiveMomo state="thinking" label={t('home.petMomo')} ground /></div>
        <p className="mt-6 text-lg">{t('editor.notFound')}</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate('diary')}>{t('editor.backDiary')}</button>
      </div>
    )
  }

  const set = (patch: Partial<JournalEntry>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const slots = slotCount(draft.layout)

  const pickPhoto = (slot: number) => {
    slotTarget.current = slot
    fileRef.current?.click()
  }

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressImage(file)
      const pid = uid()
      tempPhotos.current.set(pid, blob)
      registerTempPhoto(pid, blob)
      setDraft((d) => {
        if (!d) return d
        const ids = [...d.photoIds]
        while (ids.length < slotTarget.current) ids.push(null)
        ids[slotTarget.current] = pid
        return { ...d, photoIds: ids }
      })
      play('pop')
    } catch (err) {
      toast(err instanceof PhotoError ? t(`photo.${err.code}` as Key) : t('photo.generic'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = (slot: number) => setDraft((d) => d && ({ ...d, photoIds: d.photoIds.map((p, i) => (i === slot ? null : p)) }))

  const addSticker = (kind: PlacedSticker['kind']) => {
    play('pop')
    const s: PlacedSticker = { id: uid(), kind, x: 25 + Math.random() * 50, y: 30 + Math.random() * 40, rotate: Math.round(Math.random() * 20 - 10), scale: 1 }
    set({ stickers: [...draft.stickers, s] })
    setSelected(s.id)
  }
  const changeSticker = (sid: string, patch: Partial<PlacedSticker>) =>
    setDraft((d) => d && ({ ...d, stickers: d.stickers.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }))
  const removeSticker = (sid: string) => {
    setDraft((d) => d && ({ ...d, stickers: d.stickers.filter((s) => s.id !== sid) }))
    setSelected(null)
  }
  const sel = draft.stickers.find((s) => s.id === selected)

  const save = async () => {
    const hasContent = draft.title.trim() || draft.text.trim() || draft.photoIds.some(Boolean) || draft.stickers.length > 0 || draft.layout === 'mood'
    if (!hasContent) { toast(t('editor.empty')); return }
    setBusy(true)
    try {
      const entry: JournalEntry = { ...draft, title: draft.title.trim(), updatedAt: Date.now() }
      for (const pid of entry.photoIds) {
        const blob = pid ? tempPhotos.current.get(pid) : undefined
        if (pid && blob) await photosDb.put({ id: pid, blob, createdAt: Date.now() })
      }
      await saveEntry(entry)
      tempPhotos.current.clear()
      initial.current = JSON.stringify(entry)
      setDraft(entry)
      setSelected(null)
      play('flip')
      // the diary shelf takes it from here: the page closes into its month's notebook
      navigate(`diary?placed=${entry.id}`, { replace: true })
    } catch {
      // saveEntry has already told the user what went wrong
    } finally {
      setBusy(false)
    }
  }

  const back = existing ? `entry/${existing.id}` : `diary?month=${draft.date.slice(0, 7)}`
  const leave = () => (dirty ? setLeaving(true) : navigate(back))

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <button className="btn btn-quiet btn-sm -ml-3" onClick={leave}>← {dirty ? t('editor.discard') : t('common.back')}</button>
        <h1 className="text-lg">{existing ? t('editor.edit') : t('editor.new')}</h1>
        <span className="w-16" aria-hidden="true" />
      </div>

      <div className="grid gap-10 md:grid-cols-[minmax(0,24rem)_1fr] md:gap-14">
        {/* page preview */}
        <div className="min-w-0 md:sticky md:top-6 md:self-start">
          <div className="mx-auto max-w-[24rem]">
            <JournalPage
              entry={draft}
              stamp="none"
              edit={{ selected, onSelect: setSelected, onStickerChange: changeSticker, onStickerRemove: removeSticker, onSlotClick: (i) => { setTab('photos'); pickPhoto(i) } }}
            />
            <AnimatePresence>
              {sel && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex flex-wrap items-center justify-center gap-0.5" role="toolbar" aria-label={t('editor.selected')}>
                  <button className="icon-btn" onClick={() => changeSticker(sel.id, { rotate: sel.rotate - 15 })} aria-label={t('editor.rotL')}>⟲</button>
                  <button className="icon-btn" onClick={() => changeSticker(sel.id, { rotate: sel.rotate + 15 })} aria-label={t('editor.rotR')}>⟳</button>
                  <button className="icon-btn" onClick={() => changeSticker(sel.id, { scale: clamp(sel.scale - 0.2, 0.5, 2.2) })} aria-label={t('editor.smaller')}>−</button>
                  <button className="icon-btn" onClick={() => changeSticker(sel.id, { scale: clamp(sel.scale + 0.2, 0.5, 2.2) })} aria-label={t('editor.bigger')}>+</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => removeSticker(sel.id)}>{t('common.remove')}</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setSelected(null)}>{t('common.done')}</button>
                </motion.div>
              )}
            </AnimatePresence>
            {!sel && <p className="mt-3 text-center text-[12px] text-faint">{t('editor.dragHint')}</p>}
          </div>
        </div>

        {/* tools */}
        <div className="min-w-0">
          <div className="mb-6 flex items-start gap-3">
            <div className="w-14 shrink-0"><LiveMomo state="journaling" label={t('home.petMomo')} /></div>
            <p className="pt-3 text-[15px] text-ink-2">{existing ? t('editor.momoEdit') : t('editor.momoNew')}</p>
          </div>

          <div role="tablist" aria-label={t('editor.tools')} className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-1 no-scrollbar">
            {TABS.map((tb) => (
              <button key={tb} role="tab" id={`tab-${tb}`} aria-controls="editor-panel" aria-selected={tab === tb} className="tab" onClick={() => setTab(tb)}>{t(`editor.tab.${tb}` as Key)}</button>
            ))}
          </div>

          <div id="editor-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6 min-h-[14rem]">
            {tab === 'words' && (
              <div className="space-y-5">
                <label className="block">
                  <span className="label">{t('editor.title')}</span>
                  <input className="field" maxLength={60} value={draft.title} placeholder={t('editor.titlePh')} onChange={(e) => set({ title: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label flex justify-between">{t('editor.text')}<span>{draft.text.length}/{MAX_TEXT}</span></span>
                  <textarea className="field min-h-44 resize-y leading-relaxed" maxLength={MAX_TEXT} value={draft.text} placeholder={t('editor.textPh')} onChange={(e) => set({ text: e.target.value })} />
                </label>
                {draft.text.length > textHint(draft.layout) && draft.layout !== 'text' && (
                  <p className="text-[13px] text-muted">
                    {t('editor.longHint')}{' '}
                    <button className="text-ink underline underline-offset-4" onClick={() => set({ layout: 'text' })}>{t('editor.switchText')}</button>
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {tl('editor.prompts').map((p) => (
                    <button key={p} className="chip" onClick={() => set({ text: (draft.text ? draft.text.trimEnd() + '\n' : '') + p + ' ' })}>+ {p}</button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'photos' && (
              <div>
                {slots === 0 ? (
                  <p className="text-sm text-muted">{t('editor.photosNone')}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted">{slots === 1 ? t('editor.photosRoom1') : t('editor.photosRoomN', { n: slots })} {t('editor.photosLocal')}</p>
                    <ul className="mt-4 divide-y divide-line">
                      {Array.from({ length: slots }, (_, i) => {
                        const pid = draft.photoIds[i]
                        return (
                          <li key={i} className="flex items-center justify-between py-3">
                            <span className="text-[15px] text-ink-2">{t('editor.photoN', { n: i + 1 })}</span>
                            <span className="flex gap-1">
                              {pid && <button className="btn btn-quiet btn-sm" onClick={() => removePhoto(i)}>{t('common.remove')}</button>}
                              <button className="btn btn-sm" disabled={busy} onClick={() => pickPhoto(i)}>{pid ? t('editor.replace') : t('editor.upload')}</button>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
                {busy && <p className="mt-3 text-sm text-muted" role="status">{t('editor.photoBusy')}</p>}
              </div>
            )}

            {tab === 'layout' && (
              <div className="space-y-8">
                <div role="radiogroup" aria-label={t('editor.frame')}>
                  <p className="label">{t('editor.frame')}</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {FRAMES.map((f) => (
                      <button key={f} role="radio" aria-checked={(draft.frame ?? 'stamp') === f} onClick={() => { play('tap'); set({ frame: f }) }} className="group flex flex-col items-center gap-1.5 text-[12px] text-muted aria-checked:text-ink">
                        <span className={`rounded-lg p-1 transition ${(draft.frame ?? 'stamp') === f ? 'ring-1 ring-ink' : 'ring-1 ring-transparent group-hover:ring-line'}`}><FrameThumb frame={f} /></span>
                        {t(`frame.${f}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
                <div role="radiogroup" aria-label={t('editor.layout')}>
                  <p className="label">{t('editor.layout')}</p>
                  <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {LAYOUTS.map((l) => (
                      <button key={l.id} role="radio" aria-checked={draft.layout === l.id} onClick={() => { play('tap'); set({ layout: l.id }) }} className="group flex flex-col items-center gap-1.5 text-[12px] text-muted aria-checked:text-ink">
                        <span className={`rounded-lg p-1 transition ${draft.layout === l.id ? 'ring-1 ring-ink' : 'ring-1 ring-transparent group-hover:ring-line'}`}><LayoutThumb id={l.id} /></span>
                        {t(`layout.${l.id}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
                <div role="radiogroup" aria-label={t('editor.paper')}>
                  <p className="label">{t('editor.paper')}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(Object.keys(THEMES) as PageTheme[]).map((th) => (
                      <button key={th} role="radio" aria-checked={draft.theme === th} onClick={() => { play('tap'); set({ theme: th }) }} className="flex flex-col items-center gap-1 text-[12px] text-muted aria-checked:text-ink">
                        <span className={`block h-9 w-9 rounded-full ${draft.theme === th ? 'ring-1 ring-ink ring-offset-2 ring-offset-bg' : 'ring-1 ring-line'}`} style={{ background: THEMES[th].bg }} />
                        {t(`theme.${th}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'stickers' && (
              <div>
                <p className="text-sm text-muted">{t('editor.stickersHint')}</p>
                <div className="mt-4 grid grid-cols-6 gap-1 sm:grid-cols-8">
                  {STICKER_KINDS.map((k) => (
                    <button key={k} onClick={() => addSticker(k)} className="grid aspect-square place-items-center rounded-xl p-2 transition-colors hover:bg-surface" aria-label={t('editor.addSticker', { name: t(`sticker.${k}` as Key) })}>
                      <StickerArt kind={k} className="h-full w-full" />
                    </button>
                  ))}
                </div>
                {draft.stickers.length > 0 && (
                  <button className="btn btn-quiet btn-sm mt-4 -ml-2" onClick={() => { set({ stickers: [] }); setSelected(null) }}>{t('editor.removeAll')}</button>
                )}
              </div>
            )}

            {tab === 'details' && (
              <div className="space-y-6">
                <label className="block">
                  <span className="label">{t('editor.date')}</span>
                  <input type="date" className="field" value={draft.date} max={toISODate()} onChange={(e) => e.target.value && set({ date: e.target.value })} />
                </label>
                <div role="radiogroup" aria-label={t('editor.mood')}>
                  <p className="label">{t('editor.mood')} {t('common.optional')}</p>
                  <div className="flex flex-wrap gap-1">
                    <button role="radio" aria-checked={!draft.mood} className="chip" onClick={() => set({ mood: undefined })}>{t('editor.none')}</button>
                    {MOODS.map((m) => (
                      <button key={m.id} role="radio" aria-checked={draft.mood === m.id} className="chip" onClick={() => set({ mood: m.id })}>
                        <MoodArt mood={m.id} className="h-4 w-4" /> {t(`mood.${m.id}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="label">{t('editor.place')} {t('common.optional')}</span>
                  <input className="field" maxLength={40} value={draft.place ?? ''} placeholder={t('editor.placePh')} onChange={(e) => set({ place: e.target.value || undefined })} />
                </label>
                <label className="block">
                  <span className="label">{t('editor.linked')} {t('common.optional')}</span>
                  <input className="field" maxLength={60} value={draft.activityTitle ?? ''} placeholder={t('editor.linkedPh')} onChange={(e) => set({ activityTitle: e.target.value || undefined, activityId: undefined })} />
                </label>
              </div>
            )}
          </div>

          <div className="mt-10 flex justify-end">
            <button className="btn btn-primary" onClick={save} disabled={busy}>{t('editor.save')}</button>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} aria-hidden="true" tabIndex={-1} />

      <Confirm
        open={leaving}
        title={t('editor.leaveTitle')}
        body={t('editor.leaveBody')}
        confirmLabel={t('editor.discard')}
        onCancel={() => setLeaving(false)}
        onConfirm={() => { initial.current = JSON.stringify(draft); setLeaving(false); navigate(back) }}
      />

    </div>
  )
}

function LayoutThumb({ id }: { id: LayoutId }) {
  const K = '#242424'
  const box = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx={1} fill="#ECEAE4" />
  const lines = (y: number, n: number) => Array.from({ length: n }, (_, i) => <path key={i} d={`M8 ${y + i * 4.5} H${i === n - 1 ? 30 : 40}`} stroke="#C9C5BC" strokeWidth={1.2} strokeLinecap="round" />)
  return (
    <svg viewBox="0 0 48 64" className="h-16 w-12" aria-hidden="true">
      <rect x={0.5} y={0.5} width={47} height={63} rx={3} fill="#fff" stroke="#ECEAE4" />
      {id === 'polaroid' && <>{box(8, 9, 32, 22)}<path d="M8 38 H30" stroke={K} strokeWidth={1.8} strokeLinecap="round" />{lines(45, 3)}</>}
      {id === 'pair' && <>{box(8, 9, 15, 20)}{box(25, 12, 15, 20)}<path d="M8 39 H28" stroke={K} strokeWidth={1.8} strokeLinecap="round" />{lines(46, 3)}</>}
      {id === 'text' && <><path d="M8 14 H34 M8 19 H24" stroke={K} strokeWidth={2} strokeLinecap="round" />{lines(28, 6)}</>}
      {id === 'mood' && <><circle cx={24} cy={20} r={9} fill="none" stroke={K} strokeWidth={1.4} /><circle cx={21} cy={19} r={0.9} fill={K} /><circle cx={27} cy={19} r={0.9} fill={K} /><path d="M14 38 H34" stroke={K} strokeWidth={1.8} strokeLinecap="round" />{lines(45, 3)}</>}
      {id === 'collage' && <>{box(8, 9, 18, 24)}{box(28, 9, 12, 11)}{box(28, 22, 12, 11)}<path d="M8 40 H28" stroke={K} strokeWidth={1.8} strokeLinecap="round" />{lines(46, 3)}</>}
    </svg>
  )
}
