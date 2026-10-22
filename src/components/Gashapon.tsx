import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { play } from '../lib/sound'

/*
  A doodled capsule machine. When `running`, it plays the full ritual once:
  the claw glides over, dips, grabs a capsule, carries it to the chute,
  drops it, the capsule rolls out and pops open — then `onDone` fires and
  the parent unfolds the note. Everything is ink on white.
*/
const INK = '#1F1F1F'
const W = '#FFFFFF'
const RAIL_Y = 46
const IDLE_LEN = 14
const CHUTE_X = 83
const GRAB_OFFSET = 24 // hub → capsule centre

// heap of capsules resting at the bottom of the glass
const HEAP: [number, number, number][] = [
  [62, 150, 0], [90, 152, 160], [120, 150, 30], [150, 152, 200], [178, 150, 80],
  [76, 127, 120], [105, 128, 300], [135, 127, 20], [163, 128, 250],
  [92, 104, 60], [122, 105, 180], [150, 104, 330],
]

// phase timings in seconds: idle, move, descend, grab, lift, carry, drop, out, open
const DUR = [0, 0.8, 0.7, 0.3, 0.7, 0.8, 0.5, 0.45, 0.6]

function Capsule({ x, y, rot = 0, r = 13 }: { x: number; y: number; rot?: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <circle r={r} fill={W} stroke={INK} strokeWidth={4} />
      <path d={`M ${-r} 0 A ${r} ${r} 0 0 0 ${r} 0 Z`} fill={INK} />
      <path d={`M ${-r + 1} 0 L ${r - 1} 0`} stroke={INK} strokeWidth={3} />
    </g>
  )
}

export function CapsuleIcon({ open, className = 'h-7 w-7' }: { open?: boolean; className?: string }) {
  return (
    <svg viewBox="-16 -16 32 32" className={className} aria-hidden="true">
      {open ? (
        <g>
          <path d="M -12 -2 A 12 12 0 0 1 12 -2 Z" transform="translate(-2 -4) rotate(-18)" fill={W} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M -12 2 A 12 12 0 0 0 12 2 Z" transform="translate(1 3)" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      ) : (
        <g><circle r={12} fill={W} stroke={INK} strokeWidth={3} /><path d="M -12 0 A 12 12 0 0 0 12 0 Z" fill={INK} /></g>
      )}
    </svg>
  )
}

export function Machine({ running, onDone, label, onKnob, knobLabel }: { running: boolean; onDone?: () => void; label: string; onKnob?: () => void; knobLabel?: string }) {
  const [phase, setPhase] = useState(0)
  const target = useMemo(() => HEAP[Math.floor(Math.random() * HEAP.length)], [])
  const targetIdx = HEAP.indexOf(target)

  useEffect(() => {
    if (!running) return
    const timers: number[] = []
    let at = 0
    for (let p = 1; p < DUR.length; p++) {
      at += DUR[p - 1] * 1000
      timers.push(window.setTimeout(() => {
        setPhase(p)
        if (p === 3 || p === 6) play('tap')
        if (p === 8) play('pop')
      }, at))
    }
    at += DUR[DUR.length - 1] * 1000
    timers.push(window.setTimeout(() => onDone?.(), at))
    return () => timers.forEach(clearTimeout)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const [tx, ty] = target
  const clawX = phase === 0 ? 120 : phase <= 4 ? tx : CHUTE_X
  const len = phase === 2 || phase === 3 ? ty - GRAB_OFFSET - RAIL_Y : IDLE_LEN
  const closed = phase >= 3 && phase <= 5
  const carrying = phase >= 3 && phase <= 5
  const ease = [0.45, 0, 0.3, 1] as const
  const tr = (p: number) => ({ duration: DUR[p] || 0.4, ease })

  return (
    <svg viewBox="20 0 200 292" className="h-auto w-full" role="group" aria-label={label}>
      {/* the falling capsule goes behind the base, into the chute */}
      {phase === 6 && (
        <motion.g initial={{ x: CHUTE_X, y: RAIL_Y + IDLE_LEN + GRAB_OFFSET }} animate={{ x: CHUTE_X, y: 210 }} transition={{ duration: DUR[6], ease: [0.5, 0, 1, 1] }}>
          <Capsule x={0} y={0} rot={target[2]} />
        </motion.g>
      )}

      {/* glass */}
      <rect x={36} y={20} width={168} height={152} rx={20} fill={W} stroke={INK} strokeWidth={6} />
      <path d="M 52 34 C 52 30, 56 28, 60 28" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
      <path d="M 50 40 L 190 40" stroke={INK} strokeWidth={4} strokeLinecap="round" />

      {/* heap */}
      {HEAP.map(([x, y, r], i) => (i === targetIdx && phase >= 3 ? null : <Capsule key={i} x={x} y={y} rot={r} />))}

      {/* claw */}
      <motion.g initial={false} animate={{ x: clawX }} transition={tr(phase === 5 ? 5 : 1)}>
        <rect x={-12} y={RAIL_Y - 10} width={24} height={10} rx={3} fill={INK} />
        <motion.line x1={0} x2={0} y1={RAIL_Y} initial={false} animate={{ y2: RAIL_Y + len }} transition={tr(phase === 4 ? 4 : 2)} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
        <motion.g initial={false} animate={{ y: RAIL_Y + len }} transition={tr(phase === 4 ? 4 : 2)}>
          {carrying && <Capsule x={0} y={GRAB_OFFSET} rot={target[2]} />}
          <rect x={-9} y={-2} width={18} height={9} rx={3} fill={W} stroke={INK} strokeWidth={4} />
          <motion.path d="M -6 6 C -16 12, -16 22, -6 28" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round"
            initial={false} animate={{ rotate: closed ? -2 : 24 }} transition={{ duration: 0.25 }} style={{ originX: 1, originY: 0 }} />
          <motion.path d="M 6 6 C 16 12, 16 22, 6 28" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round"
            initial={false} animate={{ rotate: closed ? 2 : -24 }} transition={{ duration: 0.25 }} style={{ originX: 0, originY: 0 }} />
        </motion.g>
      </motion.g>

      {/* base */}
      <rect x={44} y={172} width={152} height={100} rx={12} fill={W} stroke={INK} strokeWidth={6} />
      <rect x={60} y={214} width={46} height={40} rx={8} fill={INK} />
      {/* the knob is a real button: same as "Draw" below */}
      <g
        role={onKnob ? 'button' : undefined}
        tabIndex={onKnob && !running ? 0 : undefined}
        aria-label={onKnob ? knobLabel : undefined}
        aria-disabled={onKnob ? running : undefined}
        className={onKnob ? `machine-knob ${running ? 'is-busy' : ''}` : undefined}
        onClick={onKnob && !running ? onKnob : undefined}
        onKeyDown={onKnob && !running ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKnob() } } : undefined}
      >
        <circle cx={160} cy={214} r={27} fill="transparent" />
        <circle cx={160} cy={214} r={24} className="knob-ring" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 5" />
        <motion.g initial={false} animate={{ rotate: phase >= 6 ? 180 : 0 }} transition={{ duration: 0.6 }} style={{ originX: 0.5, originY: 0.5 }}>
          <circle cx={160} cy={214} r={19} fill={W} stroke={INK} strokeWidth={5} />
          <path d="M 148 214 L 172 214" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        </motion.g>
      </g>
      <path d="M 128 192 c 0 -4 6 -4 6 0 c 0 -4 6 -4 6 0 c 0 4 -6 7 -6 7 c 0 0 -6 -3 -6 -7 Z" fill={INK} />
      <path d="M 62 272 L 62 284 M 178 272 L 178 284" stroke={INK} strokeWidth={6} strokeLinecap="round" />

      {/* the capsule rolls out into the chute window, then pops open */}
      {phase === 7 && (
        <motion.g initial={{ y: -10, scale: 0.7, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 12 }} style={{ originX: 0.5, originY: 0.5 }}>
          <circle cx={CHUTE_X} cy={236} r={15} fill={W} stroke={W} strokeWidth={2} />
          <Capsule x={CHUTE_X} y={236} r={14} />
        </motion.g>
      )}
      {phase === 8 && (
        <g>
          <motion.path d="M -14 0 A 14 14 0 0 1 14 0 Z" fill={W} stroke={INK} strokeWidth={4} strokeLinejoin="round"
            initial={{ x: CHUTE_X, y: 236, rotate: 0 }} animate={{ x: CHUTE_X - 18, y: 214, rotate: -40, opacity: 0 }} transition={{ duration: 0.55 }} />
          <motion.path d="M -14 0 A 14 14 0 0 0 14 0 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round"
            initial={{ x: CHUTE_X, y: 236, rotate: 0 }} animate={{ x: CHUTE_X + 16, y: 244, rotate: 30, opacity: 0 }} transition={{ duration: 0.55 }} />
          <motion.g initial={{ x: CHUTE_X, y: 236, scale: 0.3 }} animate={{ x: CHUTE_X, y: 200, scale: 1 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}>
            <rect x={-11} y={-9} width={22} height={18} rx={2} fill={W} stroke={INK} strokeWidth={3.5} />
            <path d="M -11 -9 L 0 0 L 11 -9" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          </motion.g>
          <g stroke={INK} strokeWidth={3} strokeLinecap="round">
            <path className="anim-twinkle" d="M 60 196 L 54 190 M 106 196 L 112 190 M 83 186 L 83 178" />
          </g>
        </g>
      )}
    </svg>
  )
}

/*
  The "draw" button: lifts a hair on hover, the capsule wiggles, a tiny ink
  sparkle appears. Pressing squeezes it briefly, then starts the draw.
  While a draw runs it stays put (same size, same label) and ignores clicks.
*/
export function DrawButton({ onDraw, busy, label, primary }: { onDraw: () => void; busy?: boolean; label: string; primary?: boolean }) {
  const [pressed, setPressed] = useState(false)
  const fire = () => {
    if (busy || pressed) return
    setPressed(true)
    window.setTimeout(() => { setPressed(false); onDraw() }, 140)
  }
  return (
    <button
      type="button"
      className={`btn draw-btn ${primary ? 'btn-primary' : ''} ${pressed ? 'is-pressed' : ''}`}
      onClick={fire}
      disabled={busy}
      aria-busy={busy || undefined}
    >
      <span className="draw-btn-icon inline-grid"><CapsuleIcon className={`h-5 w-5 ${primary ? 'invert' : ''}`} /></span>
      {label}
      <svg className="draw-btn-spark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M 12 2 Q 13.2 10.8 22 12 Q 13.2 13.2 12 22 Q 10.8 13.2 2 12 Q 10.8 10.8 12 2 Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <svg className="draw-btn-spark draw-btn-spark--small" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M 12 3 L 12 21 M 3 12 L 21 12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      </svg>
    </button>
  )
}
