import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { play } from '../../lib/sound'
import { hasFeetYarn, isSitting, Momo, type MomoAct, type MomoFx, type MomoState } from './Momo'

/*
  LiveMomo — Momo that quietly notices you.

  Layers, from most to least frequent:
  · idle        breathing, blinking, tail (inside Momo), plus a rare self-started yarn moment
  · hover       "oh, you're here": a glance that follows the pointer, one ear twitch,
                a hair of head tilt, tail lift, yarn pulled a little closer
  · tap         one small reaction from a shuffled pool (never the same twice in a row)
  · hidden      long hover → rolls onto one side for a moment (rare, cooled down)
                double tap → hugs the yarn ball
                pointer leaves → one last sneaky glance
  · the fish    the cursor is a dried fish. When it drifts near (not onto) Momo, Momo
                notices: looks at it, perks an ear, lifts the paw on that side. Linger ~1.5s
                and Momo may swipe at it (rare, long cooldown). Momo never chases it.
  Hover only runs for mouse/pen; touch gets the tap layer.
*/

type TapReaction = 'pat' | 'stretch' | 'reach' | 'tangle' | 'lie'
export type LiveEvent = TapReaction | 'hug' | 'side' | 'nudge' | 'play' | 'catch'

const TAP_POOL: { r: TapReaction; w: number }[] = [
  { r: 'pat', w: 4 }, { r: 'stretch', w: 3 }, { r: 'reach', w: 3 }, { r: 'tangle', w: 2 }, { r: 'lie', w: 1 },
]
const HOVER_SIDE_AFTER = 4500 // ms of steady hover before the roll-over can happen
const SIDE_COOLDOWN = 90_000
const IDLE_MIN = 32_000
const IDLE_SPREAD = 26_000

const FISH_NEAR = 1.25 // × Momo's width, from its centre
const FISH_FAR = 1.5 // a little hysteresis so it doesn't flicker at the edge
const FISH_NOTICE_COOLDOWN = 8_000
const FISH_CATCH_AFTER = 1_500
const FISH_CATCH_COOLDOWN = 45_000

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

function pickWeighted(exclude?: TapReaction): TapReaction {
  const pool = TAP_POOL.filter((p) => p.r !== exclude)
  let n = Math.random() * pool.reduce((a, p) => a + p.w, 0)
  for (const p of pool) { n -= p.w; if (n <= 0) return p.r }
  return pool[0].r
}

export interface LiveMomoProps {
  state: MomoState
  label: string
  className?: string
  ground?: boolean
  /** told about every reaction, e.g. so the page can show a line of dialogue */
  onReact?: (e: LiveEvent) => void
}

export function LiveMomo({ state, label, className, ground, onReact }: LiveMomoProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [fx, setFx] = useState<MomoFx>({})
  const [override, setOverride] = useState<MomoState | null>(null)
  const [squish, setSquish] = useState(0)

  const t = useRef({
    hoverStart: 0, lastSide: 0, lastTap: 0, lastReaction: undefined as TapReaction | undefined,
    raf: 0, timers: new Set<number>(), sideTimer: 0, busyUntil: 0,
    fishNear: false, fishAt: 0, lastNotice: 0, lastCatch: 0, catchTimer: 0,
  })
  const shown = override ?? state
  const sitting = isSitting(state)
  const yarnAtFeet = hasFeetYarn(state)

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { t.current.timers.delete(id); fn() }, ms)
    t.current.timers.add(id)
    return id
  }
  useEffect(() => () => { t.current.timers.forEach(clearTimeout); cancelAnimationFrame(t.current.raf) }, [])

  const doAct = (act: MomoAct, ms: number) => {
    setFx((f) => ({ ...f, act, actKey: (f.actKey ?? 0) + 1 }))
    later(() => setFx((f) => (f.act === act ? { ...f, act: undefined } : f)), ms)
  }
  const pose = (s: MomoState, ms: number) => {
    setOverride(s)
    t.current.busyUntil = Date.now() + ms
    later(() => setOverride(null), ms)
  }

  // —— idle: every so often Momo nudges the yarn by itself (only when nobody's around) ——
  useEffect(() => {
    if (!yarnAtFeet) return
    let id = 0
    const schedule = () => {
      id = window.setTimeout(() => {
        const quiet = !document.hidden && !t.current.hoverStart && Date.now() > t.current.busyUntil
        if (quiet) {
          if (Math.random() < 0.6) { doAct('pat', 1100); onReact?.('nudge') }
          else {
            doAct('play', 3200)
            setFx((f) => ({ ...f, gaze: [-0.9, 0.7] }))
            later(() => setFx((f) => ({ ...f, gaze: undefined })), 3200)
            onReact?.('play')
          }
        }
        schedule()
      }, IDLE_MIN + Math.random() * IDLE_SPREAD)
    }
    schedule()
    return () => clearTimeout(id)
  }, [yarnAtFeet]) // eslint-disable-line react-hooks/exhaustive-deps

  // —— the dried fish: notice it when it's nearby (mouse / trackpad only) ——
  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    const s = t.current
    const calm = () => {
      if (!s.fishNear) return
      s.fishNear = false
      clearTimeout(s.catchTimer)
      if (!s.hoverStart) setFx((f) => ({ ...f, hover: false, reach: undefined, gaze: undefined }))
    }
    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      // light throttle (~30/s) — enough for a calm glance, cheap on every page
      const now = performance.now()
      if (now - s.fishAt < 33) return
      s.fishAt = now
      const { clientX: x, clientY: y } = e
      ;(() => {
        const r = ref.current?.getBoundingClientRect()
        if (!r || s.hoverStart) return // directly on Momo: the hover layer handles it
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.45
        const d = Math.hypot(x - cx, y - cy) / r.width
        if (d > FISH_FAR) { calm(); return }
        if (d > FISH_NEAR && !s.fishNear) return
        const gaze: [number, number] = [clamp1((x - cx) / (r.width * 0.7)), clamp1((y - cy) / (r.height * 0.7))]
        const side: -1 | 1 = x < cx ? -1 : 1
        const busy = Date.now() < s.busyUntil
        if (!s.fishNear) {
          s.fishNear = true
          const now = Date.now()
          const perk = now - s.lastNotice > FISH_NOTICE_COOLDOWN && !busy
          if (perk) s.lastNotice = now
          setFx((f) => ({ ...f, gaze, hover: true, reach: sitting && !busy ? side : undefined, ear: perk ? (f.ear ?? 0) + 1 : f.ear }))
          // linger a moment and Momo might try to catch it
          clearTimeout(s.catchTimer)
          if (sitting && now - s.lastCatch > FISH_CATCH_COOLDOWN) {
            s.catchTimer = later(() => {
              if (!s.fishNear || s.hoverStart || Date.now() < s.busyUntil) return
              s.lastCatch = Date.now()
              s.busyUntil = Date.now() + 900
              setFx((f) => ({ ...f, act: 'swipe', actKey: (f.actKey ?? 0) + 1 }))
              later(() => setFx((f) => (f.act === 'swipe' ? { ...f, act: undefined } : f)), 800)
              play('tap')
              onReact?.('catch')
            }, FISH_CATCH_AFTER)
          }
        } else {
          setFx((f) => ({ ...f, gaze, reach: sitting && !busy && f.reach !== undefined ? side : f.reach }))
        }
      })()
    }
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) calm() } // pointer left the window
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseout', onOut)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('mouseout', onOut)
      clearTimeout(s.catchTimer)
    }
  }, [sitting]) // eslint-disable-line react-hooks/exhaustive-deps

  // —— hover (mouse / pen only) ——
  const gazeFrom = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return [0, 0] as [number, number]
    return [clamp1((e.clientX - (r.left + r.width / 2)) / (r.width * 0.6)), clamp1((e.clientY - (r.top + r.height * 0.42)) / (r.height * 0.6))] as [number, number]
  }
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    t.current.hoverStart = Date.now()
    t.current.fishNear = false
    clearTimeout(t.current.catchTimer)
    setFx((f) => ({ ...f, hover: true, reach: undefined, ear: (f.ear ?? 0) + 1, gaze: gazeFrom(e) }))
    if (sitting && Date.now() - t.current.lastSide > SIDE_COOLDOWN) {
      t.current.sideTimer = later(() => {
        if (!t.current.hoverStart || Date.now() < t.current.busyUntil || Math.random() > 0.6) return
        t.current.lastSide = Date.now()
        pose('playing', 2600)
        onReact?.('side')
      }, HOVER_SIDE_AFTER)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !t.current.hoverStart) return
    cancelAnimationFrame(t.current.raf)
    const g = gazeFrom(e)
    t.current.raf = requestAnimationFrame(() => setFx((f) => ({ ...f, gaze: g })))
  }
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !t.current.hoverStart) return
    const lingered = Date.now() - t.current.hoverStart > 600
    t.current.hoverStart = 0
    clearTimeout(t.current.sideTimer)
    cancelAnimationFrame(t.current.raf)
    // one last sneaky glance toward where the pointer went, then back to calm
    setFx((f) => ({ ...f, hover: false, gaze: lingered ? gazeFrom(e).map((v) => Math.sign(v) * Math.min(1, Math.abs(v) * 1.4)) as [number, number] : undefined }))
    if (lingered) later(() => setFx((f) => (f.hover ? f : { ...f, gaze: undefined })), 900)
  }

  // —— tap: small reactions; a quick second tap means a hug ——
  const onTap = () => {
    const now = Date.now()
    const double = now - t.current.lastTap < 380
    t.current.lastTap = now
    setSquish((n) => n + 1)
    if (double && sitting) {
      play('pop')
      pose('quiet', 2400) // hugs the yarn ball
      onReact?.('hug')
      return
    }
    play('mew')
    if (now < t.current.busyUntil) return // let the current moment finish
    if (!sitting) {
      // poses without front paws on show: a tiny stretch or an ear twitch, alternating
      if (t.current.lastReaction === 'stretch') { setFx((f) => ({ ...f, ear: (f.ear ?? 0) + 1 })); t.current.lastReaction = undefined }
      else { doAct('stretch', 1100); t.current.lastReaction = 'stretch' }
      onReact?.('stretch')
      return
    }
    let r = pickWeighted(t.current.lastReaction)
    if (!yarnAtFeet && r === 'pat') r = 'stretch'
    t.current.lastReaction = r
    switch (r) {
      case 'pat': doAct('pat', 1100); break
      case 'stretch': doAct('stretch', 1100); break
      case 'reach': pose('greeting', 1400); break
      case 'tangle': pose('poked', 1500); break
      case 'lie': pose('playing', 2200); break
    }
    onReact?.(r)
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onTap}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative block w-full rounded-full ${className ?? ''}`}
      style={{ touchAction: 'manipulation' }}
    >
      <Momo state={shown} fx={fx} pokeKey={squish} className="w-full" ground={ground} />
    </button>
  )
}
