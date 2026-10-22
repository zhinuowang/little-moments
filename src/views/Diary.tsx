import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { StickerArt } from '../components/art/Stickers'
import { JournalPage } from '../components/journal/JournalPage'
import { LiveMomo } from '../components/momo/LiveMomo'
import type { MomoState } from '../components/momo/Momo'
import { Confirm, EmptyState, MomoLine } from '../components/ui/Bits'
import { SyncStatus } from '../components/ui/SyncStatus'
import { LocalPagesNotice } from '../components/account/LocalPagesNotice'
import { useI18n } from '../i18n'
import { play } from '../lib/sound'
import { dateLocale, fromISODate, prettyDate, toISODate } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'
import type { JournalEntry, StickerKind } from '../types'

const INK = '#1F1F1F'
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
const monthDate = (key: string) => fromISODate(`${key}-01`)
const monthLong = (key: string) => monthDate(key).toLocaleDateString(dateLocale(), { month: 'long' })
const isReduced = () =>
  document.documentElement.classList.contains('motion-reduce') ||
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-full'))

function useByMonth(entries: JournalEntry[]) {
  return useMemo(() => {
    const m = new Map<string, JournalEntry[]>()
    for (const e of entries) {
      const k = e.date.slice(0, 7)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [entries])
}

export function Diary({ query }: { query: URLSearchParams }) {
  const month = query.get('month')
  if (month && /^\d{4}-\d{2}$/.test(month)) return <MonthBook key={month} month={month} />
  return <Shelf query={query} />
}

/* ───────────────────────── the bookshelf ───────────────────────── */

function Shelf({ query }: { query: URLSearchParams }) {
  const { entries } = useApp()
  const { t } = useI18n()
  const byMonth = useByMonth(entries)
  const now = new Date()
  const thisYear = now.getFullYear()
  const placedId = query.get('placed')
  const placed = placedId ? entries.find((e) => e.id === placedId) : undefined
  const qYear = Number(query.get('year'))
  const [year, setYear] = useState(() => (placed ? Number(placed.date.slice(0, 4)) : qYear > 1900 ? qYear : thisYear))
  const firstYear = Math.min(thisYear, ...entries.map((e) => Number(e.date.slice(0, 4))))

  // the save ritual: which book is waiting for its page, and which one just settled
  const [waiting, setWaiting] = useState<string | null>(placed ? placed.date.slice(0, 7) : null)
  const [settled, setSettled] = useState<{ key: string; msg: string } | null>(null)
  const [ritual] = useState(() => {
    if (!placed) return null
    let seen = false
    try { seen = sessionStorage.getItem('lm-shelved') === '1'; sessionStorage.setItem('lm-shelved', '1') } catch { /* private mode */ }
    return { entry: placed, full: !seen }
  })

  const settle = (key: string, full: boolean) => {
    setWaiting(null)
    play('tap')
    setSettled({ key, msg: full ? t('diary.placedFull', { m: monthLong(key) }) : t('diary.placedQuick') })
    navigate(year === thisYear ? 'diary' : `diary?year=${year}`, { replace: true })
  }
  useEffect(() => {
    if (!settled) return
    const tm = window.setTimeout(() => setSettled(null), 3600)
    return () => clearTimeout(tm)
  }, [settled])

  const changeYear = (y: number) => { play('flip'); setYear(y); navigate(y === thisYear ? 'diary' : `diary?year=${y}`, { replace: true }) }
  const momo: MomoState = waiting ? 'watching' : settled ? 'happy' : 'reading'
  const count = entries.length

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight">{t('diary.title')}</h1>
          <p className="mt-1 text-sm text-muted">{count === 1 ? t('diary.count1') : count ? t('diary.countN', { n: count }) : t('diary.shelfSub')}</p>
          <SyncStatus className="mt-1" />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('journal/new')}>+ {t('diary.new')}</button>
      </header>

      <LocalPagesNotice />

      <div className="mb-6 flex items-center justify-center gap-3">
        <button className="icon-btn text-muted hover:text-ink" onClick={() => changeYear(year - 1)} disabled={year <= firstYear} aria-label={t('diary.prevYear')}>←</button>
        <h2 className="min-w-16 text-center font-hand text-[18px] tabular-nums" aria-live="polite">{year}</h2>
        <button className="icon-btn text-muted hover:text-ink" onClick={() => changeYear(year + 1)} disabled={year >= thisYear} aria-label={t('diary.nextYear')}>→</button>
      </div>

      <section aria-label={t('diary.shelf')} className="mx-auto max-w-sm space-y-9">
        {[0, 6].map((start) => (
          <ShelfRow key={start}>
            {Array.from({ length: 6 }, (_, i) => {
              const m = start + i
              const key = monthKey(year, m)
              const list = byMonth.get(key) ?? []
              const future = year > thisYear || (year === thisYear && m > now.getMonth())
              return (
                <Book
                  key={key}
                  monthKey={key}
                  count={list.length}
                  sticker={peekSticker(list)}
                  current={year === thisYear && m === now.getMonth()}
                  future={future}
                  hidden={waiting === key}
                  settling={settled?.key === key}
                />
              )
            })}
            {start === 6 && (
              <div className="-mb-0.5 ml-auto w-[46px] shrink-0 self-end sm:w-[60px]">
                <LiveMomo state={momo} label={t('home.petMomo')} />
              </div>
            )}
            {start === 0 && <ShelfPlant />}
          </ShelfRow>
        ))}
      </section>

      <div className="mt-10 min-h-12 text-center">
        <AnimatePresence mode="wait">
          {settled ? (
            <motion.div key="msg" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <MomoLine className="text-[17px]">{settled.msg}</MomoLine>
            </motion.div>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted">
              {count ? t('diary.shelfHint') : t('diary.shelfEmptyHint')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {ritual && waiting && (
        <ShelveRitual entry={ritual.entry} full={ritual.full} onSettle={() => settle(ritual.entry.date.slice(0, 7), ritual.full)} />
      )}
    </div>
  )
}

/** A tiny potted plant keeping the upper shelf company. Purely decorative. */
function ShelfPlant() {
  const o = { stroke: INK, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 36 46" className="ml-auto mr-1 h-[42px] w-[33px] shrink-0 self-end sm:h-[46px] sm:w-9" aria-hidden="true">
      <g className="anim-sway" style={{ transformOrigin: '18px 27px' }}>
        <path d="M18 27 C 18 20, 17.5 14, 16 9" fill="none" {...o} />
        <path d="M17.6 18 C 12 18, 7.5 14.5, 7 9.5 C 12.5 9.5, 16.5 13, 17.6 18 Z" fill="#FFFFFF" {...o} />
        <path d="M17.9 22 C 23.5 21.5, 28 17.5, 28.5 12.5 C 23 12.5, 18.8 16.5, 17.9 22 Z" fill="#FFFFFF" {...o} />
        <path d="M16 9 C 13.5 6.5, 14 3, 16.5 1.8 C 18.6 4, 18.4 7, 16 9 Z" fill="#FFFFFF" {...o} />
        <path d="M10.5 12.3 L 14.5 15.6 M25 15.2 L 21 18.6" fill="none" {...o} strokeWidth={1.1} stroke="#B8B8B3" />
      </g>
      <path d="M7.5 27 H28.5 L 26.4 43 C 26.2 44.2, 25.3 45, 24.1 45 H11.9 C 10.7 45, 9.8 44.2, 9.6 43 Z" fill="#FFFFFF" {...o} />
      <path d="M8 31.5 H28" fill="none" {...o} strokeWidth={1.3} />
    </svg>
  )
}

/** The latest sticker used this month, to peek out of the top of the notebook. */
function peekSticker(list: JournalEntry[]): StickerKind | undefined {
  const withStickers = list.filter((e) => e.stickers.length).sort((a, b) => b.updatedAt - a.updatedAt)
  return withStickers[0]?.stickers[0]?.kind
}

/** Books stand on a hand-drawn plank; month names sit under it. */
function ShelfRow({ children }: { children: ReactNode }) {
  return (
    <div className="relative px-2">
      <div className="flex min-h-[146px] items-end gap-[6px] px-2 sm:gap-2.5">{children}</div>
      <svg viewBox="0 0 600 16" preserveAspectRatio="none" className="block h-4 w-full" aria-hidden="true">
        <path d="M2 4 C 150 3, 320 5.5, 598 3.6 M8 11 C 200 12, 400 10, 592 11 M2 4 L8 11 M598 3.6 L592 11" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

const HEIGHTS = [6, 12, 2, 14, 8, 0, 10, 4, 13, 1, 9, 5] // a little irregular, like real notebooks

/** One month's notebook, seen from the spine. Thicker as pages are added. */
function Book({ monthKey: key, count, sticker, current, future, hidden, settling }: {
  monthKey: string; count: number; sticker?: StickerKind; current: boolean; future: boolean; hidden: boolean; settling: boolean
}) {
  const { t } = useI18n()
  const m = Number(key.slice(5)) - 1
  const empty = count === 0
  const w = empty ? 20 : 26 + Math.min(count, 8) * 1.5
  const h = 104 + HEIGHTS[m] + (current ? 6 : 0)
  const short = monthDate(key).toLocaleDateString(dateLocale(), { month: 'short' })
  const name = monthLong(key)
  const line = empty ? '#B8B8B3' : INK
  const label = empty ? t('diary.bookEmpty', { m: name }) : count === 1 ? t('diary.bookAria1', { m: name }) : t('diary.bookAria', { m: name, n: count })

  const spine = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      {current && <path d={`M${w * 0.62} 2 V-10 L${w * 0.62 + 3} -7 L${w * 0.62 + 6} -10 V2`} fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />}
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={3.5} fill={future ? 'transparent' : '#FFFFFF'} stroke={future ? '#D6D6D1' : line} strokeWidth={1.8} strokeDasharray={future ? '3 3.5' : undefined} />
      {!future && (
        <g stroke={line} strokeWidth={1.3} strokeLinecap="round" fill="none">
          <path d={`M4 13 H${w - 4}`} />
          <path d={`M4 ${h - 13} H${w - 4}`} />
          {!empty && <path d={`M4 17 H${w - 4}`} />}
          {!empty && count >= 4 && <path d={`M4 ${h - 17} H${w - 4}`} />}
          {!empty && <rect x={w * 0.26} y={28} width={w * 0.48} height={Math.min(30, h * 0.26)} rx={1.5} strokeWidth={1.1} />}
        </g>
      )}
    </svg>
  )

  return (
    <div className="relative flex shrink-0 flex-col items-center" style={{ width: w }}>
      {sticker && !hidden && (
        <span className="pointer-events-none absolute" style={{ width: 16, height: 16, top: -8, left: -5, transform: 'rotate(-16deg)' }} aria-hidden="true">
          <StickerArt kind={sticker} className="h-full w-full" />
        </span>
      )}
      <motion.button
        type="button"
        data-book={key}
        className="relative block rounded-[4px] outline-offset-4 disabled:cursor-default"
        disabled={future}
        aria-hidden={future || undefined}
        tabIndex={future ? -1 : undefined}
        aria-label={future ? undefined : label}
        onClick={() => { play('flip'); navigate(`diary?month=${key}`) }}
        style={{ opacity: hidden ? 0 : 1 } as CSSProperties}
        whileHover={future ? undefined : { y: -6, rotate: -2 }}
        whileTap={future ? undefined : { y: -10, scale: 0.98 }}
        animate={settling ? { y: [-12, 2, 0], rotate: [-3, 1, 0] } : { y: 0, rotate: 0 }}
        transition={settling ? { duration: 0.55, ease: [0.3, 0.7, 0.3, 1] } : { type: 'spring', stiffness: 380, damping: 22 }}
      >
        {spine}
      </motion.button>
      <span className={`absolute top-full mt-[22px] whitespace-nowrap text-[11px] ${current ? 'text-ink' : future ? 'text-faint/70' : 'text-muted'}`} aria-hidden="true">
        {short}
        {current && <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-ink" />}
      </span>
    </div>
  )
}

/** The front of a closed monthly notebook — used as the cover that closes over a page. */
function NotebookCover({ monthKey: key, labelOpacity = 1 }: { monthKey: string; labelOpacity?: number }) {
  const year = key.slice(0, 4)
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ containerType: 'inline-size', background: '#FFFFFF', border: `2px solid ${INK}`, borderRadius: '3px 8px 8px 3px' }}>
      <div className="absolute inset-y-0 left-0" style={{ width: '11%', borderRight: `1.5px solid ${INK}` }} />
      <div className="absolute inset-y-0" style={{ right: '13%', borderLeft: `1.5px solid ${INK}` }} />
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{ left: '24%', right: '24%', top: '22%', padding: '5cqw 2cqw', border: `1.5px solid ${INK}`, borderRadius: '2cqw', opacity: labelOpacity, transition: 'opacity 0.25s 0.15s' }}
      >
        <span className="font-hand" style={{ fontSize: '11cqw', lineHeight: 1.1 }}>{monthLong(key)}</span>
        <span style={{ fontFamily: 'var(--font-type)', fontSize: '5.5cqw', letterSpacing: '0.2em', color: '#8A8A86', marginTop: '2cqw' }}>{year}</span>
      </div>
    </div>
  )
}

/**
 * The saving ritual. The page closes into its month's notebook, the notebook shrinks
 * and slides back into its gap on the shelf, then settles. The first save of a visit
 * gets the whole thing (~1.8s); later saves get a quick version. Tap to skip.
 */
function ShelveRitual({ entry, full, onSettle }: { entry: JournalEntry; full: boolean; onSettle: () => void }) {
  const { t } = useI18n()
  const key = entry.date.slice(0, 7)
  const reduced = useMemo(isReduced, [])
  const [phase, setPhase] = useState<'page' | 'closing' | 'flying'>(full ? 'page' : 'flying')
  const [target, setTarget] = useState<DOMRect | null>(null)
  const done = useRef(false)
  const finish = useRef(onSettle)
  finish.current = onSettle
  const end = () => { if (!done.current) { done.current = true; finish.current() } }

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-book="${key}"]`)
    if (!el) { end(); return }
    el.scrollIntoView({ block: 'center' })
    setTarget(el.getBoundingClientRect())
    if (reduced) end()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduced || !target) return
    const timers = full
      ? [window.setTimeout(() => { setPhase('closing'); play('flip') }, 450), window.setTimeout(() => setPhase('flying'), 1150)]
      : []
    return () => timers.forEach(clearTimeout)
  }, [full, reduced, target])

  if (reduced || !target) return null
  const W = Math.min(220, window.innerWidth * 0.56)
  const H = (W * 4) / 3
  const start = { left: (window.innerWidth - W) / 2, top: Math.max(24, (window.innerHeight - H) / 2 - 40), width: W, height: H }
  const flying = phase === 'flying'

  return (
    <div className="fixed inset-0 z-50" onClick={end} role="status" aria-label={t('diary.ritual')}>
      <motion.div
        className="absolute inset-0 bg-bg"
        initial={{ opacity: full ? 0.94 : 0.6 }}
        animate={{ opacity: flying ? 0 : 0.94 }}
        transition={{ duration: flying ? 0.5 : 0.2 }}
      />
      <motion.div
        className="absolute"
        style={{ perspective: 900 }}
        initial={full ? { ...start, opacity: 0, y: 10 } : { ...start, opacity: 1 }}
        animate={flying
          ? { left: target.left, top: target.top, width: target.width, height: target.height, opacity: 1, y: 0, rotate: [0, -4, 0] }
          : { ...start, opacity: 1, y: 0 }}
        transition={flying ? { duration: full ? 0.75 : 0.55, ease: [0.45, 0, 0.2, 1] } : { duration: 0.35 }}
        onAnimationComplete={() => { if (flying) end() }}
      >
        {/* the page, until the cover has closed over it */}
        {!flying && <div className="absolute inset-0" style={{ isolation: 'isolate', zIndex: 0 }}><JournalPage entry={entry} stamp="static" /></div>}
        {/* the cover swings shut from the left edge */}
        <motion.div
          className="absolute inset-0"
          style={{ zIndex: 1, transformOrigin: 'left center', backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
          initial={{ rotateY: full ? -178 : 0 }}
          animate={{ rotateY: phase === 'page' ? -178 : 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <NotebookCover monthKey={key} labelOpacity={flying ? 0 : 1} />
        </motion.div>
      </motion.div>
      {full && !flying && <p className="absolute inset-x-0 bottom-10 text-center text-[12px] text-faint">{t('diary.skip')}</p>}
    </div>
  )
}

/* ───────────────────────── one month's notebook ───────────────────────── */

function MonthBook({ month }: { month: string }) {
  const { entries, deleteEntry, toast } = useApp()
  const { t } = useI18n()
  const list = useMemo(
    () => entries.filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [entries, month],
  )
  const d = monthDate(month)
  const nowKey = toISODate().slice(0, 7)
  const prevD = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const prev = monthKey(prevD.getFullYear(), prevD.getMonth())
  const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  const next = monthKey(nextD.getFullYear(), nextD.getMonth())
  const title = d.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
  // a new page lands on today in the current month, or the last day of a past month
  const newDate = month === nowKey ? toISODate() : toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  const go = (k: string) => { play('flip'); navigate(`diary?month=${k}`, { replace: true }) }

  // selection mode: pick pages, then delete them together after a confirmation
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()) }
  const toggle = (id: string) => {
    play('tap')
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  useEffect(() => { if (!list.length) stopSelecting() }, [list.length])
  useEffect(() => {
    if (!selecting) return
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !confirming) stopSelecting() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [selecting, confirming])

  const removePicked = async () => {
    const ids = [...picked]
    setDeleting(true)
    let failed = 0
    for (const id of ids) {
      try { await deleteEntry(id) } catch { failed++ }
    }
    setDeleting(false)
    setConfirming(false)
    stopSelecting()
    if (failed) toast(t('diary.deleteSomeFail'), 'error')
    else toast(ids.length === 1 ? t('entry.deleted') : t('diary.deletedN', { n: ids.length }))
  }
  const n = picked.size

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <button className="btn btn-quiet btn-sm -ml-3" onClick={() => navigate(d.getFullYear() === new Date().getFullYear() ? 'diary' : `diary?year=${d.getFullYear()}`)}>← {t('diary.backShelf')}</button>
        <span className="flex items-center gap-1">
          <button className="icon-btn text-muted hover:text-ink" onClick={() => go(prev)} disabled={selecting} aria-label={t('diary.prevMonth')}>←</button>
          <button className="icon-btn text-muted hover:text-ink" onClick={() => go(next)} disabled={selecting || next > nowKey} aria-label={t('diary.nextMonth')}>→</button>
        </span>
      </div>

      <motion.header
        className="mb-6 flex items-center gap-5"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative h-[76px] w-[57px] shrink-0" aria-hidden="true"><NotebookCover monthKey={month} labelOpacity={0} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{list.length === 1 ? t('diary.monthCount1') : t('diary.monthCountN', { n: list.length })}{month === nowKey && ` · ${t('diary.thisMonth')}`}</p>
          <SyncStatus className="mt-1" />
        </div>
        {!selecting && <button className="btn btn-primary btn-sm" onClick={() => navigate(`journal/new?date=${newDate}`)}>+ {t('diary.new')}</button>}
      </motion.header>

      {list.length > 0 && (
        <div className={`mb-8 flex min-h-11 items-center justify-between gap-2 border-y py-1.5 transition-colors ${selecting ? 'border-line' : 'border-transparent'}`} role="toolbar" aria-label={t('diary.select')}>
          {selecting ? (
            <>
              <span className="flex items-center gap-1">
                <button className="btn btn-quiet btn-sm -ml-2" onClick={stopSelecting}>{t('common.cancel')}</button>
                <button className="btn btn-quiet btn-sm" onClick={() => { play('tap'); setPicked(n === list.length ? new Set() : new Set(list.map((e) => e.id))) }}>
                  {n === list.length ? t('diary.selectNone') : t('diary.selectAll')}
                </button>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[13px] text-muted" aria-live="polite">{n ? t('diary.selectedN', { n }) : t('diary.selectHint')}</span>
                <button className="btn btn-sm btn-danger" disabled={!n} onClick={() => setConfirming(true)}>
                  <svg viewBox="0 0 20 20" className="-ml-0.5 mr-1 h-4 w-4" aria-hidden="true"><path d="M4.5 6 H15.5 M8 6 V4.5 H12 V6 M6 6 L6.8 15.5 C 6.9 16.3, 7.4 16.8, 8.2 16.8 H11.8 C 12.6 16.8, 13.1 16.3, 13.2 15.5 L14 6 M8.7 9 V13.8 M11.3 9 V13.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t('diary.deleteSelected')}{n ? ` (${n})` : ''}
                </button>
              </span>
            </>
          ) : (
            <button className="btn btn-quiet btn-sm -mr-2 ml-auto" onClick={() => { play('tap'); setSelecting(true) }}>
              <svg viewBox="0 0 20 20" className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6.8 10.3 L9 12.4 L13.3 7.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {t('diary.select')}
            </button>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState momo="writing" title={t('diary.monthEmpty')}>
          <p>{t('diary.monthEmptyBody')}</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate(`journal/new?date=${newDate}`)}>{t('diary.empty.cta')}</button>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {list.map((e, i) => {
            const on = picked.has(e.id)
            const name = e.title || t('page.untitled')
            return (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}>
                <button
                  className="group block w-full text-left"
                  onClick={() => (selecting ? toggle(e.id) : navigate(`entry/${e.id}`))}
                  aria-label={selecting ? t('diary.toggle', { t: name }) : t('diary.open', { t: name })}
                  aria-pressed={selecting ? on : undefined}
                >
                  <div className="relative">
                    <motion.div
                      className={selecting ? '' : 'transition-transform duration-300 group-hover:-translate-y-1'}
                      animate={{ scale: on ? 0.93 : 1, opacity: selecting && !on ? 0.8 : 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    >
                      <JournalPage entry={e} />
                    </motion.div>
                    {on && <div className="pointer-events-none absolute -inset-1.5 rounded-[10px] border-2 border-ink" aria-hidden="true" />}
                    {selecting && <PickMark on={on} />}
                  </div>
                  <span className="mt-3 block truncate text-[14px] text-ink">{name}</span>
                  <span className="block text-[12px] text-muted">{prettyDate(e.date)}</span>
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}

      <Confirm
        open={confirming}
        title={n === 1 ? t('entry.deleteTitle') : t('diary.deleteTitleN', { n })}
        body={n === 1 ? t('entry.deleteBody') : t('diary.deleteBodyN')}
        confirmLabel={deleting ? '…' : n === 1 ? t('entry.deleteConfirm') : t('diary.deleteConfirmN', { n })}
        onCancel={() => { if (!deleting) setConfirming(false) }}
        onConfirm={() => { if (!deleting) void removePicked() }}
      />
    </div>
  )
}

/** The round tick in a page's corner while choosing pages. */
function PickMark({ on }: { on: boolean }) {
  return (
    <span className="pointer-events-none absolute -top-2.5 -left-2.5 z-10 grid h-7 w-7 place-items-center rounded-full border-2 border-ink" style={{ background: on ? INK : '#FFFFFF' }} aria-hidden="true">
      <motion.svg viewBox="0 0 20 20" className="h-4 w-4" initial={false} animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
        <path d="M5 10.5 L8.6 14 L15 6.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </span>
  )
}
