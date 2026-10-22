import { motion } from 'motion/react'
import { forwardRef, useId, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { ACTIVITY_BY_ID, localizeActivity } from '../../data/activities'
import { MOOD_BY_ID } from '../../data/meta'
import { useI18n, type Key } from '../../i18n'
import { usePhotoURL } from '../../lib/usePhoto'
import { clamp, prettyDate, stampDate } from '../../lib/util'
import type { JournalEntry, KeepsakeFrame, LayoutId, PageTheme, PlacedSticker } from '../../types'
import { MoodArt } from '../art/Icons'
import { StickerArt } from '../art/Stickers'
import { Momo } from '../momo/Momo'

export const THEMES: Record<PageTheme, { bg: string; ink: string; soft: string }> = {
  // ids kept for older pages; every paper is now black, white or grey
  cream: { bg: '#FFFFFF', ink: '#1F1F1F', soft: '#8A8A86' },
  blush: { bg: '#FAFAF6', ink: '#1F1F1F', soft: '#8A8A86' },
  butter: { bg: '#F4F3EE', ink: '#1F1F1F', soft: '#8A8A86' },
  sage: { bg: '#ECECE7', ink: '#1F1F1F', soft: '#7A7A76' },
  sky: { bg: '#F7F7F5', ink: '#1F1F1F', soft: '#8A8A86' },
  night: { bg: '#1F1F1F', ink: '#F4F4F0', soft: '#A3A39E' },
}

/** Templates offered in the editor. 'letter' still renders for older pages. */
export const LAYOUTS: { id: LayoutId; slots: number; textHint: number }[] = [
  { id: 'polaroid', slots: 1, textHint: 260 },
  { id: 'pair', slots: 2, textHint: 200 },
  { id: 'text', slots: 0, textHint: 900 },
  { id: 'mood', slots: 0, textHint: 300 },
  { id: 'collage', slots: 3, textHint: 160 },
]

export const slotCount = (l: LayoutId) => (l === 'letter' ? 1 : LAYOUTS.find((x) => x.id === l)?.slots ?? 1)
export const textHint = (l: LayoutId) => (l === 'letter' ? 700 : LAYOUTS.find((x) => x.id === l)?.textHint ?? 300)

interface EditProps {
  selected: string | null
  onSelect: (id: string | null) => void
  onStickerChange: (id: string, patch: Partial<PlacedSticker>) => void
  onStickerRemove: (id: string) => void
  onSlotClick: (slot: number) => void
}

interface Props {
  entry: JournalEntry
  edit?: EditProps
  stamp?: 'none' | 'static' | 'animate'
  className?: string
  style?: CSSProperties
}

export const FRAMES: KeepsakeFrame[] = ['stamp', 'ticket', 'postcard']

const INK = '#1F1F1F'
export const SEAL_RED = '#C8372D'
/** Four hard drop-shadows trace an ink line around whatever shape the paper's mask leaves. */
const OUTLINE = `drop-shadow(0.24cqw 0 0 ${INK}) drop-shadow(-0.24cqw 0 0 ${INK}) drop-shadow(0 0.24cqw 0 ${INK}) drop-shadow(0 -0.24cqw 0 ${INK})`
const perforate = (r: number): CSSProperties => {
  const m = `radial-gradient(circle ${r}cqw, #0000 96%, #000) ${-1.5 * r}cqw ${-1.5 * r}cqw / ${3 * r}cqw ${3 * r}cqw round, linear-gradient(#000 0 0) 50% / calc(100% - ${3 * r}cqw) calc(100% - ${3 * r}cqw) no-repeat`
  return { mask: m, WebkitMask: m }
}
const TICKET_TEAR = 81 // % down the card where the stub tears off
const notched = (): CSSProperties => {
  const m = `radial-gradient(circle 3.4cqw at 0 ${TICKET_TEAR}%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 3.4cqw at 100% ${TICKET_TEAR}%, #0000 96%, #000) right / 51% 100% no-repeat`
  return { mask: m, WebkitMask: m }
}
const serial = (e: JournalEntry) => `No.${String(e.createdAt % 10000).padStart(4, '0')}`
const typed = (size: number, extra?: CSSProperties): CSSProperties => ({ fontFamily: 'var(--font-type)', fontSize: `${size}cqw`, letterSpacing: '0.12em', lineHeight: 1.2, ...extra })

/**
 * A keepsake card — a perforated stamp, a torn-off ticket or a postcard — holding one
 * scrapbook page. Sized entirely in container units, so it scales from thumbnail to export.
 */
export const JournalPage = forwardRef<HTMLDivElement, Props>(function JournalPage({ entry, edit, stamp = 'static', className = '', style }, ref) {
  const { t, lang } = useI18n()
  const theme = THEMES[entry.theme] ?? THEMES.cream
  const frame = entry.frame ?? 'stamp'
  const pageRef = useRef<HTMLDivElement | null>(null)
  const setRefs = (el: HTMLDivElement | null) => {
    pageRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  // linked activities follow the interface language; free-typed ones stay as written
  const lib = entry.activityId ? ACTIVITY_BY_ID[entry.activityId] : undefined
  const from = lib ? localizeActivity(lib, lang).title : entry.activityTitle
  const date = prettyDate(entry.date, { weekday: 'short', month: 'long', day: 'numeric' })
  const mood = entry.mood && (
    <span style={{ display: 'block', width: '6.5cqw', height: '6.5cqw' }} aria-label={t('page.mood', { m: t(`mood.${entry.mood}` as Key) })} role="img">
      <MoodArt mood={entry.mood} className="h-full w-full" />
    </span>
  )
  const label = (text: string) => <span style={typed(2.7, { color: theme.soft, textTransform: 'uppercase' })}>{text}</span>

  const pad: Record<KeepsakeFrame, CSSProperties> = {
    stamp: { inset: '4.6cqw', padding: '5.5cqw 6cqw 5.5cqw' },
    ticket: { left: 0, right: 0, top: 0, height: `${TICKET_TEAR}%`, padding: '6.5cqw 8.5cqw 2.5cqw' },
    postcard: { inset: 0, padding: '6.5cqw 8cqw 8cqw' },
  }

  return (
    <div
      ref={setRefs}
      className={`relative w-full select-none ${className}`}
      style={{ aspectRatio: '3 / 4', containerType: 'inline-size', color: theme.ink, ...style }}
      onPointerDown={edit ? (e) => { if (!(e.target as HTMLElement).closest('[data-sticker]')) edit.onSelect(null) } : undefined}
    >
      {/* the paper, cut to shape and inked round its edge */}
      <div className="pointer-events-none absolute" style={{ inset: '0.3cqw', filter: OUTLINE }}>
        <div
          className="absolute inset-0"
          style={{
            background: theme.bg,
            borderRadius: frame === 'ticket' ? '3cqw' : frame === 'postcard' ? '1.6cqw' : 0,
            ...(frame === 'stamp' ? perforate(1.5) : frame === 'ticket' ? notched() : {}),
          }}
        />
      </div>

      {frame === 'stamp' && (
        <div className="pointer-events-none absolute" style={{ inset: '4.6cqw', border: `0.28cqw solid ${theme.ink}`, opacity: 0.85 }} />
      )}
      {frame === 'ticket' && (
        <>
          <div className="pointer-events-none absolute" style={{ left: '5.5cqw', right: '5.5cqw', top: `${TICKET_TEAR}%`, borderTop: `0.4cqw dashed ${theme.soft}` }} />
          <div className="pointer-events-none absolute flex items-center justify-between" style={{ left: '8.5cqw', right: '8.5cqw', top: `${TICKET_TEAR}%`, bottom: 0 }}>
            <span className="flex flex-col" style={{ gap: '1.2cqw' }}>
              {label(t('page.admit'))}
              <span style={typed(4.6, { color: theme.ink, letterSpacing: '0.06em' })}>{entry.date.replaceAll('-', '.')}</span>
            </span>
            <span className="flex flex-col items-end" style={{ gap: '1.2cqw' }}>
              {label(serial(entry))}
              {entry.place && <span style={typed(2.8, { color: theme.ink, maxWidth: '34cqw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{entry.place}</span>}
            </span>
          </div>
        </>
      )}
      {frame === 'postcard' && <PostageCorner entry={entry} theme={theme} />}

      <div className="pointer-events-none absolute flex flex-col" style={pad[frame]}>
        {frame === 'postcard' ? (
          <div className="flex flex-col" style={{ gap: '1.4cqw', minHeight: '11cqw', paddingRight: '24cqw' }}>
            <span style={typed(3.4, { color: theme.ink, letterSpacing: '0.3em' })}>{t('page.postcard')}</span>
            {label(date)}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {label(frame === 'ticket' ? t('page.keepsake') : date)}
            {mood}
          </div>
        )}
        <Body entry={entry} theme={theme} edit={edit} from={from} />
        {frame === 'stamp' && <span style={typed(2.4, { color: theme.soft, marginTop: '2cqw' })}>{serial(entry)}</span>}
      </div>

      {entry.stickers.map((s) => <Sticker key={s.id} s={s} pageRef={pageRef} edit={edit} />)}

      {stamp !== 'none' && entry.sealed !== false && (
        <RedSeal
          date={entry.date}
          seed={entry.createdAt}
          animate={stamp === 'animate'}
          night={entry.theme === 'night'}
          style={frame === 'ticket' ? { right: '9cqw', top: `calc(${TICKET_TEAR}% - 15cqw)` } : { right: '7cqw', bottom: '6.5cqw' }}
        />
      )}
    </div>
  )
})

/** Postcard corner: a tiny perforated stamp (the mood, or Momo) with a wavy postmark over it. */
function PostageCorner({ entry, theme }: { entry: JournalEntry; theme: (typeof THEMES)[PageTheme] }) {
  const d = stampDate(entry.date)
  return (
    <div className="pointer-events-none absolute" style={{ right: '7cqw', top: '6.5cqw', width: '15cqw', height: '18cqw' }}>
      <div className="absolute inset-0" style={{ filter: OUTLINE.replaceAll('0.24cqw', '0.18cqw') }}>
        <div className="absolute inset-0" style={{ background: '#FFFFFF', ...perforate(0.8) }} />
      </div>
      <div className="absolute grid place-items-center" style={{ inset: '2.6cqw', border: `0.22cqw solid ${INK}` }}>
        {entry.mood ? <MoodArt mood={entry.mood} className="h-[70%] w-[70%]" /> : <StickerArt kind="momo" className="h-[78%] w-[78%]" />}
      </div>
      <svg viewBox="0 0 60 40" className="absolute" style={{ left: '-13cqw', top: '4cqw', width: '22cqw', overflow: 'visible' }} aria-hidden="true">
        <circle cx={18} cy={20} r={14} fill="none" stroke={theme.soft} strokeWidth={1.3} />
        <text x={18} y={18} textAnchor="middle" fontFamily="var(--font-type)" fontSize={6.5} fill={theme.soft}>{d.month}</text>
        <text x={18} y={27} textAnchor="middle" fontFamily="var(--font-type)" fontSize={8} fill={theme.soft}>{d.day}</text>
        <path d="M30 12 C 36 9, 40 15, 46 12 C 52 9, 56 15, 62 12 M30 20 C 36 17, 40 23, 46 20 C 52 17, 56 23, 62 20 M30 28 C 36 25, 40 31, 46 28 C 52 25, 56 31, 62 28" fill="none" stroke={theme.soft} strokeWidth={1.3} strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** Thumbnails for the keepsake picker. */
export function FrameThumb({ frame }: { frame: KeepsakeFrame }) {
  const o = { fill: '#fff', stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const }
  const dots = (n: number, f: (i: number) => [number, number]) => Array.from({ length: n }, (_, i) => { const [x, y] = f(i); return <circle key={i} cx={x} cy={y} r={1.6} fill="#FAFAF7" stroke={INK} strokeWidth={0.9} /> })
  return (
    <svg viewBox="0 0 48 64" className="h-16 w-12" aria-hidden="true">
      {frame === 'stamp' && <>
        <rect x={2} y={2} width={44} height={60} {...o} />
        {dots(9, (i) => [2 + i * 5.5, 2])}{dots(9, (i) => [2 + i * 5.5, 62])}{dots(12, (i) => [2, 2 + i * 5.45])}{dots(12, (i) => [46, 2 + i * 5.45])}
        <rect x={7} y={7} width={34} height={50} fill="none" stroke={INK} strokeWidth={0.9} />
        <circle cx={33} cy={48} r={5} fill="none" stroke={SEAL_RED} strokeWidth={1.4} />
      </>}
      {frame === 'ticket' && <>
        <path d="M5 2 H43 Q46 2 46 5 V46 A3.5 3.5 0 0 0 46 53 V59 Q46 62 43 62 H5 Q2 62 2 59 V53 A3.5 3.5 0 0 0 2 46 V5 Q2 2 5 2 Z" {...o} />
        <path d="M6 49.5 H42" stroke="#B8B8B3" strokeWidth={1.1} strokeDasharray="2 2" />
        <path d="M8 56 H22" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <rect x={9} y={10} width={30} height={20} fill="#ECEAE4" />
      </>}
      {frame === 'postcard' && <>
        <rect x={2} y={2} width={44} height={60} rx={2} {...o} />
        <rect x={32} y={6} width={10} height={12} fill="#fff" stroke={INK} strokeWidth={0.9} strokeDasharray="1.2 1" />
        <path d="M24 10 c2 -1.5 4 1.5 6 0 M24 14 c2 -1.5 4 1.5 6 0" stroke="#8A8A86" strokeWidth={0.9} fill="none" />
        <path d="M7 8 H20" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <rect x={7} y={22} width={34} height={18} fill="#ECEAE4" />
      </>}
    </svg>
  )
}

function Body({ entry, theme, edit, from }: { entry: JournalEntry; theme: (typeof THEMES)[PageTheme]; edit?: EditProps; from?: string }) {
  const { t } = useI18n()
  const has = (i: number) => !!entry.photoIds[i]
  const showSlot = (i: number) => !!edit || has(i)

  const title = (style?: CSSProperties) => (
    <h2 style={{ fontFamily: 'var(--font-hand)', fontWeight: 500, fontSize: '6.4cqw', lineHeight: 1.25, letterSpacing: 0, color: theme.ink, wordBreak: 'break-word', ...style }}>
      {entry.title || (edit ? <span style={{ opacity: 0.3 }}>{t('page.titlePh')}</span> : t('page.untitled'))}
    </h2>
  )
  const meta = [from && t('page.from', { t: from }), entry.place && entry.frame !== 'ticket' && t('page.at', { p: entry.place })].filter(Boolean).join(' · ')
  const tag = meta ? <p style={{ fontSize: '2.7cqw', marginTop: '1.4cqw', color: theme.soft }}>{meta}</p> : null
  const text = (opts: { hand?: boolean; style?: CSSProperties } = {}) => (
    <div
      className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap"
      style={{
        fontFamily: opts.hand ? 'var(--font-hand)' : undefined,
        fontSize: opts.hand ? '4.2cqw' : '3.9cqw',
        lineHeight: opts.hand ? 1.6 : 1.8,
        color: opts.hand ? theme.ink : theme.ink === '#1F1F1F' ? '#3F3F3F' : theme.ink,
        maskImage: 'linear-gradient(to bottom, black 82%, transparent)',
        ...opts.style,
      }}
    >
      {entry.text || (edit ? <span style={{ opacity: 0.3 }}>{t('page.textPh')}</span> : '')}
    </div>
  )
  const photo = (i: number, style: CSSProperties, ratio = '4 / 3') => showSlot(i) && (
    <PhotoSlot key={i} id={entry.photoIds[i] ?? null} index={i} ratio={ratio} style={style} edit={edit} />
  )
  const squiggle = (
    <svg viewBox="0 0 60 12" style={{ width: '16cqw', height: '3.2cqw', marginTop: '3cqw' }} aria-hidden="true">
      <path d="M2 7 C 10 3, 16 10, 24 6 C 28 4, 31 1, 30 5 C 29 9, 25 8, 27 5 C 30 1, 44 8, 58 5" fill="none" stroke={theme.ink} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )

  switch (entry.layout) {
    case 'pair':
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex" style={{ marginTop: '6cqw', gap: '4cqw' }}>
            {photo(0, { flex: 1, transform: 'rotate(-1.5deg)' }, '3 / 4')}
            {photo(1, { flex: 1, transform: 'rotate(1.5deg) translateY(4cqw)' }, '3 / 4')}
          </div>
          {title({ marginTop: showSlot(0) || showSlot(1) ? '9cqw' : '6cqw' })}
          {tag}
          {text({ hand: true, style: { marginTop: '3cqw' } })}
        </div>
      )
    case 'collage':
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid" style={{ marginTop: '6cqw', gridTemplateColumns: '1.45fr 1fr', gap: '3cqw' }}>
            <div className="row-span-2">{photo(0, { height: '100%' }, '3 / 4')}</div>
            {photo(1, {}, '1 / 1')}
            {photo(2, {}, '1 / 1')}
          </div>
          {title({ marginTop: '6cqw', fontSize: '5.6cqw' })}
          {tag}
          {text({ style: { marginTop: '2.5cqw' } })}
        </div>
      )
    case 'mood':
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center text-center">
          <div style={{ width: '40cqw', marginTop: '5cqw' }}>
            <Momo state={entry.mood ? MOOD_BY_ID[entry.mood].momo : 'idle'} className="h-auto w-full" decorative ground />
          </div>
          {title({ marginTop: '5cqw' })}
          {tag}
          {text({ hand: true, style: { marginTop: '3cqw', width: '100%' } })}
        </div>
      )
    case 'text':
    case 'letter':
      return (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {entry.layout === 'letter' && photo(0, { position: 'absolute', right: 0, top: '5cqw', width: '24cqw', transform: 'rotate(3deg)' }, '1 / 1')}
          {title({ marginTop: '9cqw', fontSize: '8cqw', paddingRight: entry.layout === 'letter' && showSlot(0) ? '28cqw' : undefined })}
          {tag}
          {squiggle}
          {text({ style: { marginTop: '4cqw' } })}
        </div>
      )
    default: // polaroid: one photo + short reflection
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          {photo(0, { marginTop: '6cqw', transform: 'rotate(-1deg)' }, '4 / 3')}
          {title({ marginTop: showSlot(0) ? '7cqw' : '9cqw' })}
          {tag}
          {text({ style: { marginTop: '3cqw' } })}
        </div>
      )
  }
}

function PhotoSlot({ id, index, style, ratio, edit }: { id: string | null; index: number; style: CSSProperties; ratio: string; edit?: EditProps }) {
  const { t } = useI18n()
  const url = usePhotoURL(id)
  const frame: CSSProperties = {
    padding: '1.2cqw',
    background: '#FFFFFF',
    border: '0.4cqw solid #1F1F1F',
    ...style,
  }
  const inner = (
    <div className="w-full overflow-hidden" style={{ aspectRatio: ratio, height: style.height ? '100%' : undefined, background: '#F0F0EC' }}>
      {url ? (
        <img src={url} alt={t('page.photoAlt', { n: index + 1 })} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center" style={{ fontSize: '3.4cqw', fontFamily: 'var(--font-hand)', color: '#8A8A86', border: '0.3cqw dashed #B8B8B3' }}>
          <span style={{ fontSize: '7cqw', lineHeight: 1, fontWeight: 300 }}>+</span>{t('page.addPhoto')}
        </span>
      )}
    </div>
  )
  if (edit) {
    return (
      <button type="button" className="pointer-events-auto block text-left" style={frame} onClick={() => edit.onSlotClick(index)} aria-label={t(url ? 'page.replacePhotoN' : 'page.addPhotoN', { n: index + 1 })}>
        {inner}
      </button>
    )
  }
  return <div style={frame}>{inner}</div>
}

function Sticker({ s, pageRef, edit }: { s: PlacedSticker; pageRef: RefObject<HTMLDivElement | null>; edit?: EditProps }) {
  const { t } = useI18n()
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const selected = edit?.selected === s.id
  const size = 13 * s.scale

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!edit || !pageRef.current) return
    e.preventDefault()
    e.stopPropagation()
    edit.onSelect(s.id)
    const r = pageRef.current.getBoundingClientRect()
    drag.current = { dx: e.clientX - (r.left + (s.x / 100) * r.width), dy: e.clientY - (r.top + (s.y / 100) * r.height) }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointers */ }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!edit || !drag.current || !pageRef.current) return
    const r = pageRef.current.getBoundingClientRect()
    edit.onStickerChange(s.id, {
      x: clamp(((e.clientX - drag.current.dx - r.left) / r.width) * 100, 3, 97),
      y: clamp(((e.clientY - drag.current.dy - r.top) / r.height) * 100, 3, 97),
    })
  }
  const onPointerUp = () => { drag.current = null }
  const onKey = (e: KeyboardEvent) => {
    if (!edit) return
    const step = e.shiftKey ? 5 : 1.5
    const map: Record<string, Partial<PlacedSticker>> = {
      ArrowLeft: { x: clamp(s.x - step, 3, 97) }, ArrowRight: { x: clamp(s.x + step, 3, 97) },
      ArrowUp: { y: clamp(s.y - step, 3, 97) }, ArrowDown: { y: clamp(s.y + step, 3, 97) },
      '[': { rotate: s.rotate - 10 }, ']': { rotate: s.rotate + 10 },
      '-': { scale: clamp(s.scale - 0.15, 0.5, 2.2) }, '=': { scale: clamp(s.scale + 0.15, 0.5, 2.2) }, '+': { scale: clamp(s.scale + 0.15, 0.5, 2.2) },
    }
    if (map[e.key]) { e.preventDefault(); edit.onStickerChange(s.id, map[e.key]) }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edit.onStickerRemove(s.id) }
    if (e.key === 'Escape') edit.onSelect(null)
  }

  return (
    <div
      className="absolute"
      data-sticker
      style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${size}cqw`, height: `${size}cqw`, transform: `translate(-50%, -50%) rotate(${s.rotate}deg)`, touchAction: edit ? 'none' : undefined, zIndex: selected ? 5 : 2 }}
    >
      <motion.div
        initial={edit ? { scale: 0.6, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        className={`h-full w-full ${edit ? 'cursor-grab active:cursor-grabbing' : ''}`}
        role={edit ? 'button' : undefined}
        tabIndex={edit ? 0 : undefined}
        aria-label={edit ? t('sticker.aria', { name: t(`sticker.${s.kind}` as Key) }) : undefined}
        aria-pressed={edit ? selected : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKey}
        onFocus={() => edit?.onSelect(s.id)}
        style={{ outline: selected ? '0.35cqw dashed #1F1F1F' : 'none', outlineOffset: '1cqw', borderRadius: '2cqw' }}
      >
        <StickerArt kind={s.kind} className="pointer-events-none h-full w-full" />
      </motion.div>
    </div>
  )
}

/** The red seal — a worn, hand-inked round chop with the date in the middle. The only red in the app. */
export function RedSeal({ date, seed, animate, night, style }: { date: string; seed: number; animate?: boolean; night?: boolean; style?: CSSProperties }) {
  const { t } = useI18n()
  const uid = useId().replace(/:/g, '')
  const d = stampDate(date)
  const rot = -16 + (seed % 13)
  const ring = t('seal.ring')
  const body = (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={t('page.sealed')}>
      <defs>
        <filter id={`wear-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed % 97} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.3 0 0 0 1.75" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="worn" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" seed={(seed % 89) + 3} result="w" />
          <feDisplacementMap in="worn" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <path id={`ring-${uid}`} d="M 50 50 m -35 0 a 35 35 0 1 1 70 0 a 35 35 0 1 1 -70 0" />
      </defs>
      <g filter={`url(#wear-${uid})`} fill={SEAL_RED} stroke={SEAL_RED}>
        <circle cx={50} cy={50} r={45} fill="none" strokeWidth={5} />
        <circle cx={50} cy={50} r={30.5} fill="none" strokeWidth={2} />
        <text fontFamily="var(--font-type)" fontSize={8} letterSpacing={1} strokeWidth={0.55}>
          <textPath href={`#ring-${uid}`} textLength={214} lengthAdjust="spacing">{ring}</textPath>
        </text>
        <text x={50} y={40} textAnchor="middle" fontFamily="var(--font-type)" fontSize={8} letterSpacing={1.2} strokeWidth={0.5}>{d.month}</text>
        <text x={50} y={63} textAnchor="middle" fontFamily="var(--font-hand)" fontSize={26} strokeWidth={1.1}>{d.day}</text>
        <text x={50} y={73} textAnchor="middle" fontFamily="var(--font-type)" fontSize={7} letterSpacing={1.2} strokeWidth={0.45}>{d.year}</text>
      </g>
    </svg>
  )
  return (
    <div
      className={`pointer-events-none absolute ${animate ? 'anim-seal' : ''}`}
      style={{
        width: '22cqw', height: '22cqw', opacity: 0.94, mixBlendMode: night ? 'normal' : 'multiply', zIndex: 4,
        transform: `rotate(${rot}deg)`, ['--seal-rot' as string]: `rotate(${rot}deg)`,
        ...style,
      }}
    >
      {body}
    </div>
  )
}
