import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CategoryArt, MoodArt } from '../components/art/Icons'
import { LiveMomo, type LiveEvent } from '../components/momo/LiveMomo'
import { type MomoState } from '../components/momo/Momo'
import { Arrow, MomoLine } from '../components/ui/Bits'
import { YarnSteps } from '../components/ui/Yarn'
import { CATEGORIES, dayPart, MOODS, MOOD_BY_ID } from '../data/meta'
import { useI18n, type Key } from '../i18n'
import { play } from '../lib/sound'
import { daySeed, toISODate } from '../lib/util'
import { useApp } from '../store/AppContext'
import { navigate } from '../store/router'
import type { CategoryId, MoodId } from '../types'

type Phase = 'mood' | 'choose' | 'nothing'

/*
  Mood comes first. Every visit opens on "How are you feeling?";
  within the same visit we remember the answer (or the skip) so coming
  back to Home lands on the next step instead of asking again.
*/
let askedThisVisit = false
let skippedThisVisit = false
let forcedPhase: Phase | null = null

/** Lets other pages jump back to a step of the flow (e.g. the yarn steps on Ideas). */
export function openHomeAt(phase: 'mood' | 'choose') {
  forcedPhase = phase
}

export function Home() {
  const { prefs, setPrefs } = useApp()
  const { t, tl } = useI18n()
  const today = toISODate()
  const todayMood = prefs.todayMood?.date === today ? prefs.todayMood.mood : undefined

  const [firstOpen] = useState(() => !askedThisVisit)
  const [phase, setPhase] = useState<Phase>(() => {
    const forced = forcedPhase
    forcedPhase = null
    if (forced) return forced
    return askedThisVisit && (todayMood || skippedThisVisit) ? 'choose' : 'mood'
  })
  const [mood, setMood] = useState<MoodId | undefined>(todayMood)
  const [waving, setWaving] = useState(firstOpen)
  const [poke, setPoke] = useState<{ n: number; i: number; fish?: boolean } | null>(null)
  const [aside, setAside] = useState<Key | null>(null)
  const [nothingIdx, setNothingIdx] = useState(0)
  const [lampKey, setLampKey] = useState(0)
  const asideTimer = useRef<number | undefined>(undefined)
  const part = useMemo(() => dayPart(), [])
  const seed = daySeed()

  useEffect(() => {
    askedThisVisit = true
    if (!firstOpen) return
    const tm = window.setTimeout(() => setWaving(false), 2400)
    return () => clearTimeout(tm)
  }, [firstOpen])

  useEffect(() => {
    if (phase !== 'nothing') return
    const tm = window.setInterval(() => setNothingIdx((i) => i + 1), 14000)
    return () => clearInterval(tm)
  }, [phase])

  useEffect(() => () => clearTimeout(asideTimer.current), [])

  const hello = t(`home.hello.${part}` as Key)
  const helloLine = prefs.name.trim() ? t('home.helloName', { hello, name: prefs.name.trim() }) : t('home.helloPlain', { hello })
  const lines = tl(`home.line.${part}` as Key)

  // —— what Momo is doing & saying ——
  let momo: MomoState = waving ? 'greeting' : 'idle'
  let say: string | null = null
  if (phase === 'choose') {
    momo = mood ? MOOD_BY_ID[mood].momo : 'idle'
    say = mood ? t(`mood.${mood}.reply` as Key) : t('home.noMood')
  } else if (phase === 'nothing') {
    momo = 'resting'
    const n = tl('home.nothing')
    say = n[nothingIdx % n.length]
  }
  if (poke) { const p = tl(poke.fish ? 'home.fish' : 'home.pokes'); say = p[poke.i % p.length] }
  else if (aside) say = t(aside)

  const sayAside = (k: Key) => {
    setAside(k)
    clearTimeout(asideTimer.current)
    asideTimer.current = window.setTimeout(() => setAside(null), 2400)
  }

  // Momo's own little moments (nudging the yarn, playing with the thread) stay silent;
  // only things the user did get a line of dialogue.
  const onMomo = (e: LiveEvent) => {
    if (e === 'nudge' || e === 'play') return
    const n = (poke?.n ?? 0) + 1
    setPoke({ n, i: Math.floor(Math.random() * 100), fish: e === 'catch' })
    window.setTimeout(() => setPoke((p) => (p && p.n === n ? null : p)), 2000)
  }

  const chooseMood = (m: MoodId) => {
    play('pop')
    skippedThisVisit = false
    setMood(m)
    setWaving(false)
    setPhase('choose')
    setPrefs({ todayMood: { mood: m, date: today } })
  }

  const skipMood = () => {
    play('tap')
    skippedThisVisit = true
    setMood(undefined)
    setWaving(false)
    setPhase('choose')
    setPrefs({ todayMood: undefined })
  }

  const chooseCategory = (c: CategoryId) => {
    play('tap')
    if (c === 'nothing') { setPhase('nothing'); return }
    navigate(`discover?cat=${c}`)
  }

  const toggleLamp = () => {
    play('tap')
    setLampKey((k) => k + 1)
    setPrefs({ lamp: !prefs.lamp })
    sayAside(prefs.lamp ? 'home.lampOffLine' : 'home.lampOnLine')
  }

  const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3 } }

  return (
    <div className="mx-auto max-w-md text-center">
      {phase !== 'nothing' && <YarnSteps step={phase === 'mood' ? 0 : 1} onStep={() => setPhase('mood')} />}

      {phase === 'choose' && (
        <motion.button {...fade} onClick={() => { play('tap'); setPhase('mood') }} className="btn btn-sm mt-6 gap-2">
          {mood ? <MoodArt mood={mood} className="h-5 w-5" /> : null}
          {mood ? t('home.moodPill', { mood: t(`mood.${mood}` as Key) }) : t('home.moodSkipped')}
          <span className="text-muted">· {t('home.change')}</span>
        </motion.button>
      )}

      {phase === 'mood' && <p className="mt-5 text-[15px] text-muted">{helloLine} {lines[seed % lines.length]}</p>}

      {/* Momo, a ground line, and one tiny lamp */}
      <div className={`relative mx-auto ${phase === 'mood' ? 'mt-2 w-36 sm:w-44' : 'mt-5 w-44 sm:w-52'}`}>
        <LiveMomo state={momo} label={t('home.petMomo')} onReact={onMomo} ground />
        <button
          type="button"
          onClick={toggleLamp}
          aria-pressed={prefs.lamp}
          aria-label={prefs.lamp ? t('home.lampOff') : t('home.lampOn')}
          className="absolute -right-10 bottom-[7%] h-16 w-10 rounded-xl text-ink sm:-right-14"
        >
          <svg key={lampKey} viewBox="0 0 40 64" style={{ overflow: 'visible' }} className={`h-full w-full ${lampKey ? 'anim-wiggle' : ''}`} aria-hidden="true">
            <g stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" style={{ opacity: prefs.lamp ? 1 : 0, transition: 'opacity 0.4s' }}>
              <path d="M 4 30 L -2 36 M 20 30 L 20 38 M 36 30 L 42 36" />
            </g>
            <path d="M 9 22 L 13 6 L 27 6 L 31 22 Z" fill={prefs.lamp ? 'currentColor' : '#FFFFFF'} stroke="currentColor" strokeWidth={3} strokeLinejoin="round" style={{ transition: 'fill 0.4s' }} />
            <path d="M 20 22 C 20.5 36, 19.5 48, 20 60 M 11 61 C 16 60, 24 60.5, 29 61" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'mood' && (
          <motion.section key="mood" {...fade} aria-labelledby="feel-h" className="mt-4">
            <h1 id="feel-h" className="text-[24px]">{aside || poke ? say : t('home.feeling')}</h1>
            <p className="mt-1 text-[14px] text-muted">{t('home.feelingSub')}</p>
            <ul className="mt-6 grid grid-cols-3 gap-y-3">
              {MOODS.map((m) => {
                const was = todayMood === m.id
                return (
                  <li key={m.id}>
                    <button onClick={() => chooseMood(m.id)} aria-pressed={was} className="group flex w-full flex-col items-center gap-2">
                      <span className={`grid h-[68px] w-[68px] place-items-center rounded-full bg-surface transition-all duration-200 group-hover:-translate-y-0.5 group-active:scale-95 ${was ? 'border-[2.5px] border-ink' : 'border-[1.5px] border-line group-hover:border-ink'}`}>
                        <MoodArt mood={m.id} className="h-10 w-10" />
                      </span>
                      <span className="text-[14px] text-ink-2">{t(`mood.${m.id}` as Key)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button className="btn mt-6" onClick={skipMood}>{t('home.skipMood')}</button>
          </motion.section>
        )}

        {phase === 'choose' && (
          <motion.section key="choose" {...fade} aria-labelledby="choose-h" className="mt-5">
            <div className="mx-auto min-h-[3.5rem] max-w-xs">
              {say && <MomoLine>{say}</MomoLine>}
              <h1 id="choose-h" className="mt-1 text-[15px] font-normal text-muted">{t('home.whatToDo')}</h1>
            </div>
            <ul className="mt-6 divide-y divide-line text-left">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button onClick={() => chooseCategory(c.id)} className="group flex w-full items-center gap-4 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-surface">
                    <CategoryArt category={c.id} className="h-9 w-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] leading-tight font-medium text-ink">{t(`cat.${c.id}` as Key)}</span>
                      <span className="block text-[13px] text-muted">{t(`cat.${c.id}.blurb` as Key)}</span>
                    </span>
                    <Arrow className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn btn-quiet btn-sm mt-5" onClick={() => navigate('journal/new')}>{t('home.writeToday')}</button>
          </motion.section>
        )}

        {phase === 'nothing' && (
          <motion.section key="nothing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="mt-8">
            {say && <MomoLine>{say}</MomoLine>}
            <p className="mt-2 text-[15px] text-muted">{t('home.nothingHint')}</p>
            <button className="btn btn-sm mt-5" onClick={() => setPhase('choose')}>{t('home.ready')}</button>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
