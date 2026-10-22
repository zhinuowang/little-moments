import { AnimatePresence, motion } from 'motion/react'
import { LiveMomo } from '../components/momo/LiveMomo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityCard, SaveButton, useLocalized } from '../components/ActivityBits'
import { CapsuleIcon, DrawButton, Machine } from '../components/Gashapon'
import { EmptyState, MomoLine, PageTitle } from '../components/ui/Bits'
import { YarnSteps } from '../components/ui/Yarn'
import { useI18n, type Key } from '../i18n'
import { defaultFilters, recommend, type Filters } from '../lib/recommend'
import { play } from '../lib/sound'
import { daySeed, toISODate } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'
import type { Activity, CategoryId } from '../types'
import { openHomeAt } from './Home'

type Cat = Exclude<CategoryId, 'nothing'> | 'all'
type Stage = 'idle' | 'drawing' | 'revealed'
const CATS: Cat[] = ['all', 'slow', 'outside', 'new', 'cozy']
const POOL = 5

const FILTER_GROUPS: { key: keyof Filters; label: Key; options: [string, Key][] }[] = [
  { key: 'time', label: 'filter.time', options: [['any', 'filter.any'], ['15', 'filter.t15'], ['30', 'filter.t30'], ['60', 'filter.t60'], ['long', 'filter.tlong']] },
  { key: 'energy', label: 'filter.energy', options: [['any', 'filter.any'], ['low', 'filter.low'], ['medium', 'filter.medium'], ['high', 'filter.high']] },
  { key: 'place', label: 'filter.place', options: [['any', 'filter.anywhere'], ['indoor', 'filter.indoor'], ['outdoor', 'filter.outdoor']] },
  { key: 'budget', label: 'filter.budget', options: [['any', 'filter.any'], ['free', 'filter.free'], ['paid', 'filter.paid']] },
]

/*
  Layered suggestion model
  · first draw of a visit → the full capsule-machine ritual
  · that draw yields a small pool (5 ideas) to flip through quickly
  · "Draw again" replays the ritual with a fresh handful
  · "Skip" (before or during the ritual) reveals at once
  Pools are remembered for the visit, so coming back never replays the animation.
*/
const visitPools = new Map<string, { start: number; idx: number }>()

const reducedMotion = () =>
  document.documentElement.classList.contains('motion-reduce') ||
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-full'))

export function Discover({ query }: { query: URLSearchParams }) {
  const { prefs, setPrefs } = useApp()
  const { t, tl } = useI18n()
  const loc = useLocalized()
  const qc = query.get('cat')
  const cat: Cat = CATS.includes(qc as Cat) ? (qc as Cat) : 'all'
  const mood = prefs.todayMood?.date === toISODate() ? prefs.todayMood.mood : undefined

  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)

  // snapshot "recently seen" so the ranking doesn't reshuffle mid-visit
  const recentRef = useRef(prefs.recentActivityIds)
  const list = useMemo(() => recommend({ category: cat, mood, filters, recent: recentRef.current }), [cat, mood, filters])
  const poolKey = `${cat}|${mood ?? '-'}|${JSON.stringify(filters)}`

  const saved = visitPools.get(poolKey)
  const [stage, setStage] = useState<Stage>(saved ? 'revealed' : 'idle')
  const [start, setStart] = useState(saved?.start ?? 0)
  const [idx, setIdx] = useState(saved?.idx ?? 0)
  const [drawKey, setDrawKey] = useState(0)
  const [unfold, setUnfold] = useState(false) // note unfolds only right after a full draw
  const [browsed, setBrowsed] = useState(false)

  // a different category / mood / filter set is a different machine
  useEffect(() => {
    const s = visitPools.get(poolKey)
    setStage(s ? 'revealed' : 'idle')
    setStart(s?.start ?? 0)
    setIdx(s?.idx ?? 0)
    setUnfold(false)
    setBrowsed(false)
  }, [poolKey])

  const pool: Activity[] = useMemo(() => {
    if (!list.length) return []
    const n = Math.min(POOL, list.length)
    return Array.from({ length: n }, (_, i) => list[(start + i) % list.length])
  }, [list, start])
  const current = pool[idx % Math.max(1, pool.length)]

  useEffect(() => { if (stage === 'revealed') visitPools.set(poolKey, { start, idx }) }, [stage, start, idx, poolKey])

  // remember what we've shown, so tomorrow feels fresh
  useEffect(() => {
    if (stage !== 'revealed' || !current) return
    const ids = [current.id, ...prefs.recentActivityIds.filter((x) => x !== current.id)].slice(0, 12)
    if (ids.join() !== prefs.recentActivityIds.join()) setPrefs({ recentActivityIds: ids })
  }, [stage, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = (withUnfold: boolean) => {
    setIdx(0)
    setUnfold(withUnfold)
    setBrowsed(false)
    setStage('revealed')
    if (withUnfold) play('chime')
  }
  const draw = (nextStart: number) => {
    setStart(nextStart)
    if (reducedMotion()) { reveal(false); return }
    play('tap')
    setDrawKey((k) => k + 1)
    setStage('drawing')
  }
  const skipNow = (nextStart: number) => { play('flip'); setStart(nextStart); reveal(false) }
  const nextHandful = () => (list.length > POOL ? (start + POOL) % list.length : start)
  const tryAnother = () => { play('flip'); setUnfold(false); setBrowsed(true); setIdx((i) => (i + 1) % pool.length) }
  const pick = (i: number) => { if (i === idx) return; play('flip'); setUnfold(false); setBrowsed(true); setIdx(i) }

  const setCat = (c: Cat) => { play('tap'); navigate(c === 'all' ? 'discover' : `discover?cat=${c}`, { replace: true }) }
  const activeFilters = Object.values(filters).filter((v) => v !== 'any').length
  const idleLines = tl('gacha.idle')

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <YarnSteps step={2} onStep={(s) => { openHomeAt(s === 0 ? 'mood' : 'choose'); navigate('') }} />
      </div>
      <PageTitle
        title={t('discover.title')}
        subtitle={mood ? t('discover.forMood', { mood: t(`mood.${mood}` as Key).toLowerCase() }) : t('discover.subtitle')}
      />

      <div className="no-scrollbar -mx-5 flex items-center gap-5 overflow-x-auto px-5 pb-2" role="tablist" aria-label={t('discover.title')}>
        {CATS.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} className="tab" onClick={() => setCat(c)}>
            {t(c === 'all' ? 'cat.all' : (`cat.${c}` as Key))}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1">
        <button className="btn btn-quiet btn-sm -ml-2" aria-expanded={showFilters} aria-controls="filters" onClick={() => setShowFilters((s) => !s)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="M3 6 H17 M6 10 H14 M8.5 14 H11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          {t('discover.filters')}{activeFilters ? ` · ${activeFilters}` : ''}
        </button>
        {activeFilters > 0 && <button className="btn btn-quiet btn-sm" onClick={() => setFilters(defaultFilters)}>{t('common.clear')}</button>}
      </div>
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div id="filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-4 pt-3 pb-2">
              {FILTER_GROUPS.map((g) => (
                <div key={g.key} role="radiogroup" aria-label={t(g.label)} className="flex flex-wrap items-center gap-1">
                  <span className="w-16 shrink-0 text-[13px] text-muted">{t(g.label)}</span>
                  {g.options.map(([v, label]) => (
                    <button key={v} role="radio" aria-checked={filters[g.key] === v} className="chip" onClick={() => setFilters((f) => ({ ...f, [g.key]: v }))}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!list.length ? (
        <div className="mt-8">
          <EmptyState momo="thinking" title={t('discover.empty.title')}>
            <p>{t('discover.empty.body')}</p>
            <button className="btn btn-primary mt-5" onClick={() => setFilters(defaultFilters)}>{t('discover.empty.reset')}</button>
          </EmptyState>
        </div>
      ) : stage !== 'revealed' ? (
        /* —— the machine —— */
        <section className="mt-8 text-center" aria-label={t('gacha.machine', { n: list.length })}>
          <div className="mx-auto min-h-[2rem] max-w-xs">
            <MomoLine>{stage === 'drawing' ? t('gacha.drawing') : idleLines[daySeed() % idleLines.length]}</MomoLine>
          </div>
          <div className="relative mx-auto mt-4 w-56 sm:w-64">
            <Machine key={drawKey} running={stage === 'drawing'} onDone={() => reveal(true)} label={t('gacha.machine', { n: list.length })} onKnob={() => draw(start)} knobLabel={t('gacha.draw')} />
            <div className="absolute -bottom-1 -left-16 w-24 sm:-left-20 sm:w-28">
              <LiveMomo state={stage === 'drawing' ? 'watching' : 'presenting'} label={t('home.petMomo')} />
            </div>
            {stage === 'drawing' && (
              <button className="btn btn-quiet btn-sm absolute -top-2 -right-4" onClick={() => skipNow(start)}>{t('gacha.skip')} →</button>
            )}
          </div>
          <p className="mt-3 text-[13px] text-muted">{t('gacha.inside', { n: list.length })}</p>
          <div className="mt-6 flex flex-col items-center gap-1">
            <DrawButton primary busy={stage === 'drawing'} onDraw={() => draw(start)} label={t('gacha.draw')} />
            {stage === 'idle' && <button className="btn btn-quiet btn-sm" onClick={() => skipNow(start)}>{t('gacha.skipAnim')}</button>}
          </div>
        </section>
      ) : current ? (
        /* —— the note, and the handful it came from —— */
        <section className="mt-8" aria-label={t('gacha.pool')}>
          <div className="mx-auto mb-5 max-w-xs text-center">
            <MomoLine>{browsed ? t('gacha.browse') : t('gacha.reveal')}</MomoLine>
          </div>
          <div style={{ perspective: 1200 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${start}-${current.id}`}
                initial={unfold ? { scaleY: 0.06, scaleX: 0.3, rotate: -8, opacity: 0 } : { rotateY: -80, opacity: 0 }}
                animate={{ scaleY: 1, scaleX: 1, rotate: 0, rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 80, opacity: 0 }}
                transition={unfold ? { type: 'spring', stiffness: 170, damping: 19 } : { duration: 0.18, ease: 'easeOut' }}
                style={{ transformOrigin: unfold ? 'top center' : 'center' }}
              >
                <ActivityCard
                  activity={current}
                  actions={(
                    <>
                      <button className="btn btn-primary" onClick={() => { play('pop'); navigate(`ritual/${current.id}`) }}>{t('discover.doIt')}</button>
                      {pool.length > 1 && <button className="btn" onClick={tryAnother}>{t('gacha.another')}</button>}
                      <span className="ml-auto"><SaveButton a={current} /></span>
                    </>
                  )}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {pool.length > 1 && (
            <div className="mt-8 text-center">
              <p className="eyebrow">{t('gacha.pool')}</p>
              <ul className="mt-3 flex justify-center gap-3">
                {pool.map((a, i) => (
                  <li key={a.id}>
                    <button
                      onClick={() => pick(i)}
                      aria-pressed={i === idx}
                      aria-label={t('gacha.poolItem', { n: i + 1, t: loc(a).title })}
                      title={loc(a).title}
                      className={`grid h-12 w-12 place-items-center rounded-full transition-all ${i === idx ? 'border-2 border-ink bg-surface' : 'border-[1.5px] border-transparent hover:border-line'}`}
                    >
                      <CapsuleIcon open={i === idx} className="h-7 w-7" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-1 border-t border-line pt-6">
            <DrawButton onDraw={() => draw(nextHandful())} label={t('gacha.again')} />
            <button className="btn btn-quiet btn-sm" onClick={() => skipNow(nextHandful())}>{t('gacha.againQuick')}</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
