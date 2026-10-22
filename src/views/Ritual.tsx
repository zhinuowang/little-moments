import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MetaLine, SaveButton, useLocalized } from '../components/ActivityBits'
import { LiveMomo } from '../components/momo/LiveMomo'
import { type MomoState } from '../components/momo/Momo'
import { MomoLine } from '../components/ui/Bits'
import { ACTIVITY_BY_ID } from '../data/activities'
import { useDuration, useI18n } from '../i18n'
import { play } from '../lib/sound'
import { navigate } from '../store/router'
import type { Activity } from '../types'

type Journal = (extra?: string) => void

export function RitualView({ id }: { id?: string }) {
  const { t } = useI18n()
  const loc = useLocalized()
  const base = id ? ACTIVITY_BY_ID[id] : undefined
  if (!base) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="w-32"><LiveMomo state="thinking" label={t('home.petMomo')} ground /></div>
        <p className="mt-6 text-lg">{t('ritual.notFound')}</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate('discover')}>{t('ritual.seeOthers')}</button>
      </div>
    )
  }
  const a = loc(base)
  const journal: Journal = (extra = '') => navigate(`journal/new?activity=${a.id}${extra}`)

  return (
    <div className="mx-auto max-w-md">
      <button className="btn btn-quiet btn-sm -ml-3" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('discover'))}>← {t('common.back')}</button>
      <header className="mt-4 text-center">
        <h1 className="text-[25px] leading-snug">{a.title}</h1>
        <MetaLine a={a} className="mt-1" />
      </header>
      <div className="mt-10">
        {a.ritual === 'reading' ? <ReadingRitual a={a} onJournal={journal} />
          : a.ritual === 'tea' ? <TeaRitual a={a} onJournal={journal} />
          : a.ritual === 'walk' ? <WalkRitual a={a} onJournal={journal} />
          : a.ritual === 'creative' ? <CreativeRitual a={a} onJournal={journal} />
          : <GenericRitual a={a} onJournal={journal} />}
      </div>
      <div className="mt-14 flex items-center justify-center gap-1 border-t border-line pt-5">
        <SaveButton a={a} withLabel />
        <button className="btn btn-quiet" onClick={() => navigate('discover')}>{t('ritual.chooseElse')}</button>
      </div>
      <p className="mt-2 text-center text-[13px] text-faint">{t('ritual.footer')}</p>
    </div>
  )
}

/* ——————————————————— shared bits ——————————————————— */

function Scene({ state, children, side }: { state: MomoState; children: ReactNode; side?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-end justify-center gap-2">
        <div className="w-44"><LiveMomo state={state} label={t('home.petMomo')} ground /></div>
        {side}
      </div>
      <div className="mt-6 max-w-xs"><MomoLine>{children}</MomoLine></div>
    </div>
  )
}

function useTimer(onDone: () => void) {
  const [total, setTotal] = useState(0)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState<number | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (!endsAt) return
    const tick = () => {
      const ms = endsAt - Date.now()
      if (ms <= 0) {
        setLeft(0); setEndsAt(null); setTotal(0)
        play('chime')
        done.current()
      } else setLeft(ms)
    }
    tick()
    const tm = window.setInterval(tick, 500)
    return () => clearInterval(tm)
  }, [endsAt])

  return {
    running: !!endsAt,
    paused: paused !== null,
    left: paused ?? left,
    total,
    start: (min: number) => { const ms = min * 60_000; setTotal(ms); setLeft(ms); setPaused(null); setEndsAt(Date.now() + ms) },
    pause: () => { if (endsAt) { setPaused(endsAt - Date.now()); setEndsAt(null) } },
    resume: () => { if (paused !== null) { setEndsAt(Date.now() + paused); setPaused(null) } },
    stop: () => { setEndsAt(null); setPaused(null); setTotal(0); setLeft(0) },
  }
}

function Timer({ presets, onDone, label, onRunning }: { presets: number[]; onDone: () => void; label: string; onRunning?: (running: boolean) => void }) {
  const { t } = useI18n()
  const dur = useDuration()
  const tm = useTimer(onDone)
  const active = tm.running || tm.paused
  useEffect(() => { onRunning?.(tm.running) }, [tm.running, onRunning])
  const mm = Math.floor(tm.left / 60000)
  const ss = Math.floor((tm.left % 60000) / 1000)
  const pct = tm.total ? 1 - tm.left / tm.total : 0
  return (
    <div className="mt-10 text-center">
      <p className="eyebrow">{label}</p>
      {active ? (
        <>
          <div className="relative mx-auto mt-4 grid h-32 w-32 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx={50} cy={50} r={46} fill="none" stroke="var(--color-line)" strokeWidth={2} />
              <circle cx={50} cy={50} r={46} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${pct * 289} 289`} />
            </svg>
            <span className="text-[30px] tabular-nums text-ink" role="timer" aria-live="off">{mm}:{String(ss).padStart(2, '0')}</span>
          </div>
          <div className="mt-4 flex justify-center gap-1">
            {tm.paused ? <button className="btn btn-sm" onClick={tm.resume}>{t('timer.resume')}</button> : <button className="btn btn-sm" onClick={tm.pause}>{t('timer.pause')}</button>}
            <button className="btn btn-quiet btn-sm" onClick={tm.stop}>{t('timer.stop')}</button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {presets.map((m) => <button key={m} className="chip" onClick={() => { play('tap'); tm.start(m) }}>{dur(m)}</button>)}
        </div>
      )}
      <p className="mt-3 text-[12px] text-faint">{t('timer.note')}</p>
    </div>
  )
}

function JournalPrompt({ onJournal, text }: { onJournal: () => void; text?: string }) {
  const { t } = useI18n()
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted">{text ?? t('ritual.wantSave')}</p>
      <button className="btn btn-primary" onClick={() => onJournal()}>{t('ritual.saveMemory')}</button>
    </motion.div>
  )
}

/* ——————————————————— rituals ——————————————————— */

function ReadingRitual({ a, onJournal }: { a: Activity; onJournal: Journal }) {
  const { t } = useI18n()
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  return (
    <div>
      <Scene state={finished ? 'happy' : 'reading'}>
        {finished ? t('reading.done') : running ? t('reading.running') : a.invite}
      </Scene>
      {!finished && <Timer presets={[10, 20, 30]} label={t('timer.reading')} onDone={() => setFinished(true)} onRunning={setRunning} />}
      {finished ? <JournalPrompt onJournal={onJournal} text={t('reading.keep')} /> : (
        <div className="mt-6 text-center"><button className="btn btn-quiet btn-sm" onClick={() => setFinished(true)}>{t('reading.finished')}</button></div>
      )}
    </div>
  )
}

function TeaRitual({ a, onJournal }: { a: Activity; onJournal: Journal }) {
  const { t } = useI18n()
  const [poured, setPoured] = useState(0) // 0 empty, 1 pouring, 2 full
  const [quietDone, setQuietDone] = useState(false)
  const pour = () => {
    if (poured === 1) return
    play('pour')
    setPoured(1)
    window.setTimeout(() => setPoured(2), 1800)
  }
  return (
    <div>
      <Scene
        state={poured === 2 ? 'tea' : 'idle'}
        side={(
          <button onClick={pour} className="mb-1 h-24 w-28 rounded-2xl" aria-label={t('tea.pour')}>
            <TeaSet phase={poured} />
          </button>
        )}
      >
        {poured === 2 ? t('tea.ready') : poured === 1 ? t('tea.pouring') : `${a.invite} ${t('tea.tap')}`}
      </Scene>
      {poured === 2 && !quietDone && <Timer presets={[5, 10, 15]} label={t('timer.quiet')} onDone={() => setQuietDone(true)} />}
      {poured === 2 && <JournalPrompt onJournal={onJournal} text={quietDone ? t('tea.after') : t('tea.whenever')} />}
    </div>
  )
}

function TeaSet({ phase }: { phase: number }) {
  const K = '#1F1F1F'
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" aria-hidden="true">
      <clipPath id="cupClip"><path d="M 74 66 h 26 l -3 22 c -1 4 -19 4 -20 0 Z" /></clipPath>
      <rect x={70} y={phase === 0 ? 92 : 70} width={34} height={30} fill="#1F1F1F" clipPath="url(#cupClip)" style={{ transition: 'y 1.6s ease-in' }} />
      <path d="M 74 66 h 26 l -3 22 c -1 4 -19 4 -20 0 Z" fill="none" stroke={K} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M 99 72 c 8 0 8 10 -1 10" fill="none" stroke={K} strokeWidth={2.2} />
      {phase === 2 && (
        <g className="anim-steam" stroke={K} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.5}>
          <path d="M 84 60 c -2 -4 2 -6 0 -10" /><path d="M 91 61 c -2 -4 2 -6 0 -10" style={{ animationDelay: '1s' }} />
        </g>
      )}
      <motion.g animate={phase === 1 ? { rotate: -26, x: 6 } : { rotate: 0, x: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} style={{ originX: 0.8, originY: 0.8 }}>
        <path d="M 14 50 C 14 34, 52 34, 52 50 L 50 70 C 49 76, 17 76, 16 70 Z" fill="#fff" stroke={K} strokeWidth={2.4} strokeLinejoin="round" />
        <path d="M 52 54 C 60 52, 64 46, 68 40" fill="none" stroke={K} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M 14 52 C 4 52, 4 66, 16 64" fill="none" stroke={K} strokeWidth={2.2} />
        <path d="M 25 39 C 26 33, 40 33, 41 39" fill="#1F1F1F" stroke={K} strokeWidth={2.2} />
        <circle cx={28} cy={55} r={1.6} fill={K} /><circle cx={38} cy={55} r={1.6} fill={K} />
      </motion.g>
      <AnimatePresence>
        {phase === 1 && (
          <motion.path d="M 70 44 C 73 52, 76 58, 82 68" fill="none" stroke="#1F1F1F" strokeWidth={3} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.35, duration: 0.4 }} />
        )}
      </AnimatePresence>
    </svg>
  )
}

function WalkRitual({ a, onJournal }: { a: Activity; onJournal: Journal }) {
  const { t, tl } = useI18n()
  const challenges = tl('walk.challenges')
  const [i, setI] = useState(() => Math.floor(Math.random() * challenges.length))
  const [back, setBack] = useState(false)
  const challenge = challenges[i % challenges.length]
  return (
    <div>
      <Scene state={back ? 'happy' : 'walking'}>{back ? t('walk.welcome') : `${a.invite} ${t('walk.packed')}`}</Scene>
      {!back && (
        <div className="mt-10 text-center">
          <p className="eyebrow">{t('walk.challenge')}</p>
          <p className="mt-2 font-hand text-[20px] text-ink">“{challenge}”</p>
          <button className="btn btn-quiet btn-sm mt-1" onClick={() => { play('flip'); setI((x) => x + 1) }}>{t('walk.another')}</button>
        </div>
      )}
      {back ? (
        <JournalPrompt onJournal={() => onJournal(`&prompt=${encodeURIComponent(t('walk.prompt', { c: challenge }))}`)} text={t('walk.addPhotos')} />
      ) : (
        <div className="mt-8 text-center"><button className="btn btn-primary" onClick={() => { play('pop'); setBack(true) }}>{t('walk.back')}</button></div>
      )}
      <p className="mt-4 text-center text-[12px] text-faint">{t('walk.safety')}</p>
    </div>
  )
}

function Steps({ a }: { a: Activity }) {
  return (
    <ol className="mx-auto mt-10 max-w-sm space-y-3">
      {a.steps.map((s, n) => (
        <li key={n} className="flex gap-3 text-[15px] text-ink-2"><span className="w-4 shrink-0 text-right text-muted">{n + 1}</span><span>{s}</span></li>
      ))}
    </ol>
  )
}

function CreativeRitual({ a, onJournal }: { a: Activity; onJournal: Journal }) {
  const { t, tl } = useI18n()
  const surprises = tl('creative.surprises')
  const [revealed, setRevealed] = useState(false)
  const [i, setI] = useState(() => Math.floor(Math.random() * surprises.length))
  return (
    <div>
      <Scene state={revealed ? 'happy' : 'excited'}>{revealed ? t('creative.good') : a.invite}</Scene>
      <Steps a={a} />
      <div className="mt-10 text-center">
        {!revealed ? (
          <button className="btn btn-quiet" onClick={() => { play('pop'); setRevealed(true) }}>{t('creative.peek')}</button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto max-w-xs -rotate-1 px-6 py-5">
            <p className="eyebrow">{t('creative.bonus')}</p>
            <p className="mt-2 font-hand text-[18px] leading-snug text-ink">{surprises[i % surprises.length]}</p>
            <button className="btn btn-quiet btn-sm mt-2" onClick={() => { play('flip'); setI((x) => x + 1) }}>{t('creative.another')}</button>
          </motion.div>
        )}
      </div>
      <JournalPrompt onJournal={onJournal} text={t('creative.made')} />
    </div>
  )
}

function GenericRitual({ a, onJournal }: { a: Activity; onJournal: Journal }) {
  const { t } = useI18n()
  const [ticks, setTicks] = useState<boolean[]>(() => a.steps.map(() => false))
  const presets = useMemo(() => {
    const m = Math.min(a.minutes, 60)
    return [...new Set([Math.max(5, Math.round(m / 2 / 5) * 5), m])].filter(Boolean)
  }, [a.minutes])
  const all = ticks.every(Boolean)
  return (
    <div>
      <Scene state={all ? 'happy' : 'excited'}>{all ? t('generic.done') : a.invite}</Scene>
      <p className="mt-10 text-center text-[13px] text-muted">{t('generic.tick')}</p>
      <ul className="mx-auto mt-3 max-w-sm divide-y divide-line">
        {a.steps.map((s, n) => (
          <li key={n}>
            <label className="flex cursor-pointer items-start gap-3 py-3 text-[15px] text-ink-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#242424]" checked={ticks[n]} onChange={() => { play('tap'); setTicks((tk) => tk.map((v, j) => (j === n ? !v : v))) }} />
              <span className={ticks[n] ? 'text-faint line-through' : ''}>{s}</span>
            </label>
          </li>
        ))}
      </ul>
      <Timer presets={presets} label={t('timer.optional')} onDone={() => {}} />
      <JournalPrompt onJournal={onJournal} />
    </div>
  )
}
