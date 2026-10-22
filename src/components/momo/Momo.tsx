import { motion } from 'motion/react'
import { createContext, useContext, useId, type CSSProperties } from 'react'
import { useI18n, type Key } from '../../i18n'

export type MomoState =
  | 'idle' | 'greeting' | 'happy' | 'thinking' | 'calm' | 'tea' | 'quiet' | 'excited'
  | 'reading' | 'journaling' | 'celebrating' | 'resting' | 'playing' | 'walking' | 'poked' | 'peek'
  // page-specific variants: Plans 'curious', Diary 'writing', Suggestions 'presenting' / 'watching'
  | 'curious' | 'writing' | 'presenting' | 'watching'

/*
  Momo — a chubby little tabby doodle.
  Big round head, small round body, hollow ring paws, two inked feet,
  one inked ear, three grey forehead stripes, a few side marks and a banded tail.
  Lines are a confident marker stroke, lighter than before, with a faint hand wobble.
  Its yarn ball is never far away.
*/
export const INK = '#1F1F1F'
const W = '#FFFFFF'
const TABBY = '#8E8E8A' // the grey of the stripes
const SW = 4.6
const ln = { stroke: INK, strokeWidth: SW, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const fill = (f: string, w = SW) => ({ ...ln, strokeWidth: w, fill: f })
const stripe = { stroke: TABBY, strokeLinecap: 'round' as const, fill: 'none' }

type Eyes = 'dot' | 'happy' | 'closed' | 'squeeze' | 'up' | 'down'
type Mouth = 'w' | 'o' | 'flat' | 'smile'
type Body = 'sit' | 'quarter' | 'profile' | 'side' | 'lie' | 'car' | 'peek'
type Hands = 'rest' | 'wave' | 'hold'
type Prop = 'cup' | 'book' | 'laptop' | 'note' | 'stamp'
type Extra = 'sparkles' | 'zzz' | 'heart' | 'sweat' | 'ticks'
/** Where Momo's yarn ball is — its signature companion. */
type Yarn = 'feet' | 'hug' | 'tangle' | 'play' | 'trail'

interface Pose {
  eyes: Eyes; mouth: Mouth; body: Body; hands?: Hands; prop?: Prop; extra?: Extra; yarn?: Yarn
  tilt?: boolean; hop?: boolean; lookUp?: boolean; tailUp?: boolean
  /** page-specific refinements (Plans / Diary only) */
  paws?: 'mitten'; softProfile?: boolean
}

const POSES: Record<MomoState, Pose> = {
  idle: { eyes: 'dot', mouth: 'w', body: 'sit', hands: 'rest', yarn: 'feet' },
  greeting: { eyes: 'dot', mouth: 'smile', body: 'sit', hands: 'wave', yarn: 'feet' },
  happy: { eyes: 'happy', mouth: 'w', body: 'quarter', extra: 'ticks', hop: true },
  thinking: { eyes: 'up', mouth: 'o', body: 'profile', lookUp: true, extra: 'ticks' }, // curious
  calm: { eyes: 'closed', mouth: 'w', body: 'profile', lookUp: true }, // peaceful
  tea: { eyes: 'closed', mouth: 'w', body: 'sit', hands: 'hold', prop: 'cup' },
  quiet: { eyes: 'down', mouth: 'flat', body: 'sit', hands: 'hold', yarn: 'hug' },
  excited: { eyes: 'dot', mouth: 'smile', body: 'sit', hands: 'hold', prop: 'note', extra: 'sparkles' },
  reading: { eyes: 'down', mouth: 'w', body: 'sit', hands: 'hold', prop: 'book' },
  journaling: { eyes: 'down', mouth: 'flat', body: 'sit', hands: 'hold', prop: 'laptop', extra: 'sweat' },
  celebrating: { eyes: 'happy', mouth: 'smile', body: 'sit', hands: 'hold', prop: 'stamp', extra: 'sparkles' },
  resting: { eyes: 'closed', mouth: 'w', body: 'lie', yarn: 'play', extra: 'zzz' },
  playing: { eyes: 'dot', mouth: 'w', body: 'lie', yarn: 'play', tailUp: true, extra: 'ticks' },
  walking: { eyes: 'dot', mouth: 'w', body: 'car', extra: 'sparkles', yarn: 'trail' },
  poked: { eyes: 'squeeze', mouth: 'o', body: 'sit', hands: 'rest', yarn: 'tangle' },
  peek: { eyes: 'dot', mouth: 'w', body: 'peek' },
  curious: { eyes: 'happy', mouth: 'smile', body: 'side' },
  writing: { eyes: 'down', mouth: 'flat', body: 'sit', hands: 'hold', prop: 'laptop', extra: 'sweat', paws: 'mitten' },
  presenting: { eyes: 'dot', mouth: 'smile', body: 'sit', hands: 'hold', prop: 'note', extra: 'sparkles', paws: 'mitten' },
  watching: { eyes: 'up', mouth: 'o', body: 'sit', hands: 'rest', extra: 'ticks' },
}

/*
  Tiny live effects, driven from outside (see LiveMomo): gaze moves the pupils a few
  units, hover tilts the head and lifts the tail a hair, ear restarts a one-off twitch,
  act plays a short yarn moment, reach lifts a paw toward one side.
*/
export type MomoAct = 'pat' | 'stretch' | 'play' | 'swipe'
export interface MomoFx {
  gaze?: [number, number]
  hover?: boolean
  ear?: number
  act?: MomoAct
  actKey?: number
  reach?: -1 | 1
}
const FxCtx = createContext<MomoFx>({})
const ease = 'transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1)'

/** Poses that keep the yarn ball at Momo's feet — the ones yarn moments make sense for. */
export const hasFeetYarn = (s: MomoState) => POSES[s].yarn === 'feet'
export const isSitting = (s: MomoState) => POSES[s].body === 'sit'

const origin = (x: number, y: number): CSSProperties => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` })

/* ————————————————— small parts ————————————————— */

/** The striped tail: an outlined tube with grey bands. */
function TabbyTail({ d, w = 14 }: { d: string; w?: number }) {
  const inner = w - SW * 2
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={w} strokeLinecap="round" />
      <path d={d} stroke={W} strokeWidth={inner} strokeLinecap="round" />
      <path d={d} stroke={TABBY} strokeWidth={inner} strokeDasharray="3.5 6" strokeDashoffset={-4} />
    </g>
  )
}

/** A doodled ball of yarn: a circle wound with a few curved bands. */
export function YarnBall({ x, y, r = 16, spin }: { x: number; y: number; r?: number; spin?: boolean }) {
  const k = r / 16
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <g className={spin ? 'anim-sway' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle r={16} {...fill(W, SW / k)} />
        <g {...ln} strokeWidth={3.2 / k}>
          <path d="M -13 -7 Q 0 -13 13 -7" /><path d="M -15.5 0 Q 0 -6 15.5 0" /><path d="M -14 7 Q 0 1 14 7" /><path d="M -9 12.5 Q 1 8 10 12.5" />
        </g>
      </g>
    </g>
  )
}

function useLook() {
  const fx = useContext(FxCtx)
  const [gx, gy] = fx.gaze ?? [0, 0]
  return { transform: `translate(${gx * 3.5}px, ${gy * 2.5}px)`, transition: ease } as CSSProperties
}

function Eyes({ eyes, L, R, Y }: { eyes: Eyes; L: number; R: number; Y: number }) {
  const look = useLook()
  const arc = (d: string) => <path d={d} {...ln} strokeWidth={4} />
  const dots = (dx: number, dy: number, r = 5.6) => (
    <g style={look}><g className="anim-blink"><circle cx={L + dx} cy={Y + dy} r={r} fill={INK} /><circle cx={R + dx} cy={Y + dy} r={r} fill={INK} /></g></g>
  )
  switch (eyes) {
    case 'happy': return <>{arc(`M ${L - 6} ${Y + 2} Q ${L} ${Y - 5} ${L + 6} ${Y + 2}`)}{arc(`M ${R - 6} ${Y + 2} Q ${R} ${Y - 5} ${R + 6} ${Y + 2}`)}</>
    case 'closed': return <>{arc(`M ${L - 6} ${Y} Q ${L} ${Y + 5} ${L + 6} ${Y}`)}{arc(`M ${R - 6} ${Y} Q ${R} ${Y + 5} ${R + 6} ${Y}`)}</>
    case 'squeeze': return <>{arc(`M ${L - 6} ${Y - 5} L ${L + 4} ${Y} L ${L - 6} ${Y + 5}`)}{arc(`M ${R + 6} ${Y - 5} L ${R - 4} ${Y} L ${R + 6} ${Y + 5}`)}</>
    case 'up': return dots(3, -4)
    case 'down': return dots(-1, 4, 5.2)
    default: return dots(0, 0)
  }
}

function Mouth({ mouth, x, y }: { mouth: Mouth; x: number; y: number }) {
  switch (mouth) {
    case 'o': return <ellipse cx={x} cy={y + 2} rx={3.4} ry={3.8} fill={INK} />
    case 'flat': return <path d={`M ${x - 5} ${y + 1} L ${x + 5} ${y + 1}`} {...ln} strokeWidth={3.6} />
    case 'smile': return <path d={`M ${x - 7} ${y - 2} Q ${x} ${y + 6} ${x + 7} ${y - 2}`} {...ln} strokeWidth={3.6} />
    default: return <path d={`M ${x - 9} ${y - 1} Q ${x - 4.5} ${y + 5} ${x} ${y - 0.5} Q ${x + 4.5} ${y + 5} ${x + 9} ${y - 1}`} {...ln} strokeWidth={3.6} />
  }
}

const Nose = ({ x, y }: { x: number; y: number }) => (
  <path d={`M ${x - 4.5} ${y} Q ${x} ${y - 1.6} ${x + 4.5} ${y} Q ${x + 1.6} ${y + 4.6} ${x} ${y + 4.6} Q ${x - 1.6} ${y + 4.6} ${x - 4.5} ${y} Z`} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
)

/** The front-facing head (also used, slightly turned, for the three-quarter pose). */
function Head({ pose, turn = 0 }: { pose: Pose; turn?: number }) {
  const fx = useContext(FxCtx)
  const f = turn // face offset for a three-quarter view
  return (
    <g>
      <path d="M 52 78 C 50 60, 54 46, 63 35 C 71 39, 81 47, 88 56 Z" {...fill(INK)} />
      <g key={fx.ear ?? 0} className={fx.ear ? 'anim-ear' : undefined} style={origin(130, 66)}>
        <path d="M 148 78 C 150 60, 146 46, 137 35 C 129 39, 119 47, 112 56 Z" {...fill(W)} />
      </g>
      <path d="M 44 100 C 42 68, 66 50, 100 50 C 134 50, 158 68, 156 100 C 154 126, 132 138, 100 138 C 68 138, 46 126, 44 100 Z" {...fill(W)} />
      <g {...stripe} strokeWidth={6}>
        <path d={`M ${89 + f * 0.3} 56 L ${90 + f * 0.3} 70`} /><path d={`M ${100 + f * 0.3} 54 L ${100 + f * 0.3} 72`} /><path d={`M ${111 + f * 0.3} 56 L ${110 + f * 0.3} 70`} />
      </g>
      <Eyes eyes={pose.eyes} L={80 + f} R={120 + f} Y={98} />
      <Nose x={100 + f} y={106} />
      <Mouth mouth={pose.mouth} x={100 + f} y={114} />
    </g>
  )
}

/** Profile head, facing left, for the curious / calm poses. */
function ProfileHead({ pose }: { pose: Pose }) {
  const look = useLook()
  const eye = pose.eyes === 'closed'
    ? <path d="M 74 92 Q 80 98 86 92" {...ln} strokeWidth={4} />
    : <g style={look}><circle className="anim-blink" cx={81} cy={pose.eyes === 'up' ? 88 : 92} r={5.6} fill={INK} /></g>
  return (
    <g>
      <path d="M 126 70 C 128 54, 124 42, 116 33 C 108 38, 100 46, 96 54 Z" {...fill(INK)} />
      <path d="M 100 66 C 98 50, 92 40, 82 34 C 76 42, 72 52, 72 62 Z" {...fill(W)} />
      <path d="M 58 98 C 54 76, 70 56, 100 56 C 128 56, 146 74, 144 100 C 142 122, 124 134, 100 134 C 86 134, 74 128, 66 120 C 59 114, 55 106, 58 98 Z" {...fill(W)} />
      <g {...stripe} strokeWidth={5.5}>
        <path d="M 118 64 L 114 76" /><path d="M 129 70 L 123 80" /><path d="M 138 79 L 131 86" />
      </g>
      {eye}
      <path d="M 57 101 Q 59 99.5 61 101 Q 60 104 58.5 104 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M 60 110 Q 64 115 69 110" {...ln} strokeWidth={3.4} />
    </g>
  )
}

function PropArt({ prop }: { prop?: Prop }) {
  const w = 4
  switch (prop) {
    case 'cup':
      return (
        <g>
          <g className="anim-steam" {...ln} strokeWidth={3}><path d="M 94 138 c -4 -5 4 -8 0 -13" /><path d="M 106 139 c -4 -5 4 -8 0 -13" style={{ animationDelay: '1.2s' }} /></g>
          <path d="M 113 152 C 122 152, 122 164, 112 164" {...ln} strokeWidth={w} />
          <path d="M 86 147 L 114 147 L 112 170 C 111 174, 89 174, 88 170 Z" {...fill(W, w)} />
        </g>
      )
    case 'book':
      return (
        <g>
          <path d="M 70 152 L 100 158 L 130 152 L 130 178 L 100 184 L 70 178 Z" {...fill(INK, w)} />
          <path d="M 76 150 L 100 155 L 100 178 L 76 173 Z M 124 150 L 100 155 L 100 178 L 124 173 Z" {...fill(W, 3.4)} />
        </g>
      )
    case 'laptop':
      return (
        <g>
          <rect x={64} y={140} width={72} height={44} rx={5} {...fill(W, w)} />
          <path d="M 50 186 L 150 186" {...ln} strokeWidth={5} />
          <path d="M 94 160 c 0 -5 4 -7 6 -3 c 2 -4 6 -2 6 3 c 0 5 -12 5 -12 0 Z" {...fill(W, 2.6)} />
        </g>
      )
    case 'note':
      return (
        <g transform="rotate(-6 100 158)">
          <rect x={76} y={140} width={48} height={36} rx={4} {...fill(W, w)} />
          <path d="M 100 152 c 0 -5 7 -5 7 0 c 0 -5 7 -5 7 0 c 0 6 -7 10 -7 10 c 0 0 -7 -4 -7 -10 Z" transform="translate(-10 2)" fill={INK} />
        </g>
      )
    case 'stamp':
      return (
        <g className="anim-stamp" style={origin(100, 162)}>
          <rect x={84} y={162} width={32} height={11} rx={3} {...fill(INK, w)} />
          <path d="M 93 162 L 93 150 L 107 150 L 107 162" {...fill(W, w)} />
          <circle cx={100} cy={144} r={8} {...fill(W, w)} />
        </g>
      )
    default:
      return null
  }
}

function ExtraArt({ extra }: { extra?: Extra }) {
  const sparkle = (x: number, y: number, s: number, delay: string) => (
    <path className="anim-twinkle" style={{ animationDelay: delay }} transform={`translate(${x} ${y}) scale(${s})`}
      d="M 0 -12 Q 2 -2 12 0 Q 2 2 0 12 Q -2 2 -12 0 Q -2 -2 0 -12 Z" {...fill(W, 3.4)} />
  )
  switch (extra) {
    case 'sparkles': return <g>{sparkle(28, 58, 1, '0s')}{sparkle(176, 46, 0.8, '0.9s')}{sparkle(182, 120, 0.6, '1.6s')}</g>
    // the little "noticed!" ticks from the reference sketch
    case 'ticks': return <g className="anim-twinkle" {...ln} strokeWidth={3.4}><path d="M 158 40 L 164 30" /><path d="M 166 48 L 176 42" /><path d="M 168 58 L 178 58" /></g>
    case 'heart': return <path className="anim-twinkle" d="M 162 48 c 0 -7 11 -7 11 0 c 0 -7 11 -7 11 0 c 0 9 -11 14 -11 14 c 0 0 -11 -5 -11 -14 Z" fill={INK} />
    case 'sweat': return <path d="M 160 76 C 154 86, 156 94, 162 94 C 168 94, 170 86, 160 76 Z" {...fill(W, 3)} />
    case 'zzz':
      return (
        <g fontFamily="'LM Hand', sans-serif" fontWeight={400} fill={INK}>
          <text className="anim-zzz" x={118} y={100} fontSize={20}>z</text>
          <text className="anim-zzz" style={{ animationDelay: '1.4s' }} x={132} y={86} fontSize={15}>z</text>
        </g>
      )
    default:
      return null
  }
}

/** A paw lifted a little toward one side — curious, not grabby. */
const reachStyle = (on: boolean, side: -1 | 1): CSSProperties => ({
  transformBox: 'fill-box',
  transformOrigin: side < 0 ? '100% 100%' : '0% 100%',
  transform: on ? `translate(${side * 3}px, -9px) rotate(${side * 18}deg)` : 'none',
  transition: 'transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)',
})

/** A little paw: a soft dome. Never a ring, never linked to the other one. */
function Paw({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M -8.5 4.5 C -9.5 -7, 9.5 -7, 8.5 4.5 Z" {...fill(W, SW / s)} />
    </g>
  )
}

/** Where the two paws sit when holding something — always at the prop's outer edges, well apart. */
const HOLD: Record<string, [number, number, number][]> = {
  cup: [[80, 158, -78], [120, 158, 78]],
  book: [[68, 160, -62], [132, 160, 62]],
  laptop: [[78, 135.5, 0], [122, 135.5, 0]],
  note: [[78, 140, -8], [122, 136, 8]],
  stamp: [[86, 158, -72], [114, 158, 72]],
  hug: [[78, 156, -52], [122, 156, 52]],
  none: [[78, 152, 0], [122, 152, 0]],
}

/** The approved front paws: two hollow rings resting on the body (Home and most poses). */
const Ring = ({ x, y, r = 8.5 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} {...fill(W)} />

function Hands({ hands, mitten, hold = 'none' }: { hands?: Hands; mitten?: boolean; hold?: string }) {
  const fx = useContext(FxCtx)
  // page-specific variant (Diary): soft separate paws at the prop's outer edges
  if (mitten && hands === 'hold') return <g>{(HOLD[hold] ?? HOLD.none).map(([x, y, r], i) => <Paw key={i} x={x} y={y} rot={r} />)}</g>
  switch (hands) {
    case 'wave':
      return (
        <g>
          <Ring x={82} y={158} />
          <g className="anim-wave" style={origin(128, 150)}>
            <path d="M 128 148 C 136 140, 142 132, 146 126" {...ln} />
            <Ring x={148} y={122} />
          </g>
        </g>
      )
    case 'hold':
      return <g><Ring x={88} y={152} r={7.5} /><Ring x={112} y={152} r={7.5} /></g>
    default: {
      const swipeL = fx.act === 'swipe' && fx.reach === -1
      const swipeR = fx.act === 'swipe' && fx.reach === 1
      return (
        <g>
          <g style={reachStyle(fx.reach === -1, -1)}>
            <g key={fx.act === 'pat' || swipeL ? fx.actKey : 0} className={fx.act === 'pat' ? 'anim-pat' : swipeL ? 'anim-swipe-l' : undefined}>
              <Ring x={82} y={158} />
            </g>
          </g>
          <g style={reachStyle(fx.reach === 1, 1)}>
            <g key={swipeR ? fx.actKey : 0} className={swipeR ? 'anim-swipe-r' : undefined}>
              <Ring x={118} y={158} />
            </g>
          </g>
        </g>
      )
    }
  }
}

/** Momo's yarn: always nearby, sometimes hugged, sometimes a little tangled. */
function YarnArt({ yarn }: { yarn?: Yarn }) {
  const fx = useContext(FxCtx)
  const thread = (d: string) => <path d={d} {...ln} strokeWidth={3} />
  switch (yarn) {
    case 'feet':
      return (
        <g style={{ transform: fx.hover ? 'translateX(5px)' : 'none', transition: 'transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1)' }}>
          {fx.act === 'play'
            ? <g key={fx.actKey} className="anim-sway" style={{ ...origin(54, 150), animationDuration: '1.6s' }}>{thread('M 50 158 C 34 146, 42 124, 58 132 C 70 138, 60 150, 68 146')}</g>
            : thread('M 52 160 C 60 152, 62 146, 72 152')}
          <g key={fx.act === 'pat' ? fx.actKey : 0} className={fx.act === 'pat' ? 'anim-roll' : undefined}>
            <YarnBall x={36} y={170} r={18} />
          </g>
        </g>
      )
    case 'tangle':
      return (
        <g>
          <YarnBall x={34} y={170} r={18} />
          {thread('M 48 162 C 70 184, 98 140, 132 160 C 146 168, 150 152, 140 142')}
          {thread('M 68 140 C 90 156, 112 128, 134 144')}
        </g>
      )
    case 'trail':
      return <g>{thread('M 180 150 C 192 154, 186 170, 196 176')}<YarnBall x={194} y={184} r={9} spin /></g>
    default:
      return null
  }
}

/* ————————————————— bodies ————————————————— */

function Sitting({ pose }: { pose: Pose }) {
  const { hover } = useContext(FxCtx)
  const holdFront = pose.hands === 'hold'
  return (
    <g>
      <g style={{ ...origin(136, 178), transform: hover ? 'rotate(-9deg)' : 'none', transition: ease }}>
        <g className="anim-sway" style={origin(136, 178)}>
          <TabbyTail d="M 134 180 C 156 184, 168 170, 166 152 C 165 142, 158 138, 154 143" />
        </g>
      </g>
      <g className="anim-breathe">
        <path d="M 66 128 C 58 146, 58 172, 66 182 C 72 190, 128 190, 134 182 C 142 172, 142 146, 134 128 Z" {...fill(W)} />
        {/* front of the body stays clean: just the two round paws, no side marks near them */}
        <path d="M 82 189 C 82 181, 98 181, 98 189 Z M 102 189 C 102 181, 118 181, 118 189 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </g>
      {!holdFront && <Hands hands={pose.hands} />}
      {pose.yarn && pose.yarn !== 'hug' && <YarnArt yarn={pose.yarn} />}
      <g style={{ ...origin(100, 132), transform: hover ? 'rotate(-4deg)' : 'none', transition: ease }}>
        <g className={pose.tilt ? 'anim-tilt' : undefined} style={origin(100, 132)}>
          <Head pose={pose} />
        </g>
      </g>
      <PropArt prop={pose.prop} />
      {pose.yarn === 'hug' && <g>{<path d="M 118 174 C 132 190, 150 180, 164 188" {...ln} strokeWidth={3} />}<YarnBall x={100} y={162} r={21} /></g>}
      {holdFront && <Hands hands="hold" mitten={pose.paws === 'mitten'} hold={pose.yarn === 'hug' ? 'hug' : pose.prop ?? 'none'} />}
    </g>
  )
}

/** Three-quarter sitting pose, turned a little to the left (the happy one). */
function Quarter({ pose }: { pose: Pose }) {
  return (
    <g>
      <g className="anim-sway" style={origin(76, 180)}>
        <TabbyTail d="M 78 182 C 56 186, 44 172, 48 156 C 50 148, 56 146, 60 150" />
      </g>
      <g className="anim-breathe">
        <path d="M 74 128 C 64 148, 66 174, 78 186 L 132 186 C 144 172, 144 146, 132 128 Z" {...fill(W)} />
        <g {...stripe} strokeWidth={5}><path d="M 136 148 L 126 151" /><path d="M 138 160 L 128 162" /></g>
        <path d="M 94 160 C 93 170, 93 178, 94 186 M 110 160 C 111 170, 111 178, 110 186" {...ln} strokeWidth={3.8} />
        <path d="M 88 187 L 100 187 M 104 187 L 116 187" {...ln} strokeWidth={3.8} />
      </g>
      <g style={origin(100, 132)} transform="rotate(-3 100 132)"><Head pose={pose} turn={-6} /></g>
    </g>
  )
}

/** Side profile, sitting upright and looking up (the approved version — Home, moods). */
function Profile({ pose }: { pose: Pose }) {
  const { hover } = useContext(FxCtx)
  return (
    <g>
      <g style={{ ...origin(140, 182), transform: hover ? 'rotate(-8deg)' : 'none', transition: ease }}>
        <g className="anim-sway" style={origin(140, 182)}>
          <TabbyTail d="M 138 184 C 160 186, 172 172, 166 156 C 164 150, 158 148, 156 152" />
        </g>
      </g>
      <g className="anim-breathe">
        <path d="M 84 124 C 76 146, 78 172, 88 186 L 140 186 C 150 170, 148 142, 132 124 Z" {...fill(W)} />
        <g {...stripe} strokeWidth={5}><path d="M 144 146 L 134 150" /><path d="M 146 158 L 136 161" /></g>
        <path d="M 100 156 C 99 168, 99 178, 100 186 M 94 187 L 106 187" {...ln} strokeWidth={3.8} />
      </g>
      <g style={origin(104, 128)} transform={pose.lookUp ? 'rotate(-10 104 128)' : undefined}>
        <ProfileHead pose={pose} />
      </g>
    </g>
  )
}

/** Side profile, redrawn for Plans: head resting on a soft rounded body, smooth back, no hunch. */
function ProfileSoft({ pose }: { pose: Pose }) {
  const { hover } = useContext(FxCtx)
  return (
    <g>
      <g style={{ ...origin(146, 184), transform: hover ? 'rotate(-8deg)' : 'none', transition: ease }}>
        <g className="anim-sway" style={origin(146, 184)}>
          <TabbyTail d="M 144 184 C 166 187, 177 172, 170 157 C 167 151, 160 151, 160 157" />
        </g>
      </g>
      <g className="anim-breathe">
        {/* the top edge tucks inside the head, so the back is one smooth curve */}
        <path d="M 90 118 C 80 140, 78 168, 86 186 L 148 186 C 162 176, 162 142, 132 116 Z" {...fill(W)} />
        <path d="M 126 186 C 122 170, 130 156, 146 154" {...ln} strokeWidth={3.6} />
        <g {...stripe} strokeWidth={5}><path d="M 159 152 L 150 155" /><path d="M 160 164 L 151 166" /></g>
        <path d="M 102 162 C 101 172, 101 180, 102 186 M 96 187 L 108 187" {...ln} strokeWidth={3.6} />
      </g>
      <g transform={pose.lookUp ? 'rotate(-6 102 100)' : undefined}>
        <ProfileHead pose={pose} />
      </g>
    </g>
  )
}

/**
  Plans-page cat — hand-traced from the user's drawing, point by point.
  Profile facing left, chin up, eye happily closed. The head is a big round shape;
  the chin line ends in a little tick and the chest starts just below it, so the
  cat sits upright with no hunch. White ear lies at the back with its inner line,
  inked ear on top, grey stripes following the curve of the head, banded tail.
*/
function SideSit({ pose }: { pose: Pose }) {
  const fx = useContext(FxCtx)
  const o = { ...ln, strokeWidth: 4.3 }
  return (
    <g>
      {/* tail, curled up tight behind */}
      <g style={{ ...origin(142, 184), transform: fx.hover ? 'rotate(-8deg)' : 'none', transition: ease }}>
        <g className="anim-sway" style={origin(142, 184)}>
          <TabbyTail d="M 139 185 C 151 186.5, 162 182, 166 172 C 170.5 160, 169.5 146, 163.5 138.5 C 159 133, 152.5 133, 150.5 139" w={13} />
        </g>
      </g>

      <g className="anim-breathe">
        {/* white fills: body, head, back ear (outlines drawn separately) */}
        <path d="M 57.3 111.4 C 55 124, 55 131, 55.5 137.7 C 56 150, 55.5 158, 56.5 164.9 C 57 174, 57.5 181, 58.9 188 L 140.5 188 C 141.6 185.5, 142.4 182, 142.2 178.5 C 141 170, 137 160, 132 151.3 C 126 139, 116 128, 103.1 120.7 L 100.4 117.7 L 64.7 111.4 Z" fill={W} />
        <path d="M 89.9 27.4 C 82 26.5, 77 27, 72 28.5 C 64 31, 59 34, 55.2 37.9 C 50 43, 47 47, 45.8 51.5 C 43.5 58, 42 63, 42 67 C 38 70, 35.5 74, 36.3 77.8 C 36.5 86, 38 92, 40.5 96.7 C 44 102, 48 105.5, 53.1 107.2 C 57 109.5, 61 110.8, 64.7 111.4 L 100.4 117.7 C 104 117.6, 109 117.2, 114 116.7 C 121 116, 128 114, 135 109.3 C 141 105, 144 99, 144.5 90.4 C 145 85, 142.5 80, 139.2 75.7 C 138.5 69, 137 62, 134 57.9 C 131 54, 126 50, 119.3 47.4 L 122.4 36.9 Z" fill={W} />
        <g key={fx.ear ?? 0} className={fx.ear ? 'anim-ear' : undefined} style={origin(136, 56)}>
          <path d="M 122.4 36.9 C 131 37, 140 36.8, 147.6 37.9 C 150 38.5, 151.5 40.5, 150.8 43.2 C 149 53, 147 63, 144.5 71.5 C 143 75, 141 76, 139.2 75.7 C 138.5 69, 137 62, 134 57.9 C 131 54, 126 50, 119.3 47.4 Z" fill={W} />
          <path d="M 122.4 36.9 C 131 37, 140 36.8, 147.6 37.9 C 150 38.5, 151.5 40.5, 150.8 43.2 C 149 53, 147 63, 144.5 71.5 C 143 75, 141 76, 139.2 75.7" {...o} />
          <path d="M 119.3 47.4 C 126 50, 131 54, 134 57.9 C 137 62, 138.5 69, 138.2 75.7" {...o} />
        </g>
        {/* inked ear on top */}
        <path d="M 89.5 28 C 97 20.5, 105 15.5, 113 14.8 C 118 22, 121 30, 122.4 37.5 Z" {...fill(INK, 4.3)} />

        {/* front edge: forehead → nose → mouth → cheek → chin, ending in a little tick */}
        <path d="M 89.9 27.4 C 82 26.5, 77 27, 72 28.5 C 64 31, 59 34, 55.2 37.9 C 50 43, 47 47, 45.8 51.5 C 43.5 58, 42 63, 42 67 C 38 70, 35.5 74, 36.3 77.8 C 36.5 86, 38 92, 40.5 96.7 C 44 102, 48 105.5, 53.1 107.2 C 57 109.5, 61 110.8, 64.7 111.4" {...o} />
        {/* back of the head, curving in underneath and ending */}
        <path d="M 139.2 75.7 C 142.5 80, 145 85, 144.5 90.4 C 144 99, 141 105, 135 109.3 C 128 114, 121 116, 114 116.7 C 109 117.2, 104 117.6, 100.4 117.7" {...o} />
        {/* chest, starting just under the chin tick */}
        <path d="M 57.3 111.4 C 55 124, 55 131, 55.5 137.7 C 56 150, 55.5 158, 56.5 164.9 C 57 174, 57.5 181, 58.9 188" {...o} />
        {/* the rounded back */}
        <path d="M 103.1 120.7 C 116 128, 126 139, 132 151.3 C 137 160, 141 170, 142.2 178.5 C 142.4 182, 141.6 185.5, 140.5 188" {...o} />
        {/* front leg, toes and the inked back foot */}
        <path d="M 70.8 154.7 C 70 165, 69.5 176, 69.1 185.3" {...o} strokeWidth={3.8} />
        <path d="M 61 188 C 61.5 184, 64.5 184, 65 188 M 65 188 C 65.5 184.5, 68.5 184.5, 69 188" {...ln} strokeWidth={2.6} />
        <path d="M 88.5 188.5 C 88.5 182.5, 100 182.5, 100 188.5 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />

        {/* tabby stripes: along the curve of the head, and three on the side */}
        <g {...stripe} strokeWidth={5}><path d="M 78.3 34.8 L 90.9 31.2" /><path d="M 82.5 40 L 99.3 33.3" /><path d="M 92 42.1 L 108.1 35.8" /></g>
        <g {...stripe} strokeWidth={6}><path d="M 108.9 139.4 L 128.6 133.6" /><path d="M 111.6 154.7 L 133.7 148.6" /><path d="M 120.1 168.3 L 135.4 163.2" /></g>

        {/* face: nose curl, mouth curl, the happy closed eye */}
        <path d="M 46.5 54 C 50.5 54, 50.5 59.5, 46 59.6" {...ln} strokeWidth={3.4} />
        <path d="M 44.5 63 C 48.5 63.4, 49 67.6, 44.8 68.2" {...ln} strokeWidth={3.2} />
        {pose.eyes === 'happy'
          ? <path d="M 61 67 C 63 62.5, 70 61, 73 66 C 74 69, 73.5 72, 73 75.5" {...ln} strokeWidth={4} />
          : <circle className="anim-blink" cx={67} cy={68} r={4.8} fill={INK} />}
      </g>

      {/* the two "noticed" ticks */}
      <g className="anim-twinkle" {...ln} strokeWidth={3.8}><path d="M 34.2 24.3 L 44.7 30.6" /><path d="M 45.8 12.7 L 52 24.3" /></g>
    </g>
  )
}

/** Lying down, chin by the yarn ball, playing (or dozing). */
function Lying({ pose }: { pose: Pose }) {
  const fx = useContext(FxCtx)
  return (
    <g>
      {pose.tailUp ? (
        <g className="anim-sway" style={origin(160, 154)}>
          <TabbyTail d="M 158 156 C 172 142, 178 122, 170 104 C 168 98, 162 98, 162 104" />
        </g>
      ) : (
        <TabbyTail d="M 166 180 C 182 176, 188 160, 180 150" />
      )}
      <g className="anim-breathe">
        <path d="M 44 186 C 38 166, 56 150, 86 148 L 146 146 C 168 146, 180 164, 174 186 Z" {...fill(W)} />
        <g {...stripe} strokeWidth={5}><path d="M 120 150 L 117 160" /><path d="M 134 150 L 131 160" /><path d="M 147 152 L 143 161" /></g>
        <path d="M 150 188 C 150 180, 164 180, 164 188 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </g>
      <g transform="translate(86 132) scale(0.8) translate(-100 -98)"><Head pose={pose} /></g>
      {pose.yarn === 'play' && (
        <g>
          <g key={fx.act === 'pat' ? fx.actKey : 0} className={fx.act === 'pat' ? 'anim-roll' : undefined}><YarnBall x={42} y={174} r={15} /></g>
          <Ring x={62} y={178} r={8} />
        </g>
      )}
    </g>
  )
}

/** Momo in a tiny car — the "let's go somewhere" pose. */
function Car({ pose }: { pose: Pose }) {
  return (
    <g>
      <g className="anim-hop" style={{ animationDuration: '1.4s' }}>
        <g transform="translate(112 88) scale(0.84) translate(-100 -98)"><Head pose={pose} /></g>
        <path d="M 62 134 C 62 112, 92 110, 96 132" {...ln} strokeWidth={8} />
        <Ring x={98} y={128} r={7} />
        <path d="M 26 160 C 26 140, 42 134, 60 134 L 150 132 C 170 132, 180 144, 180 160 L 180 168 C 180 174, 176 176, 170 176 L 32 176 C 28 176, 26 172, 26 166 Z" {...fill(W)} />
        <path d="M 112 136 L 112 174" {...ln} strokeWidth={3.6} />
        <ellipse cx={40} cy={154} rx={6} ry={8} {...fill(W, 3.6)} />
        <path d="M 58 152 L 74 152" {...ln} strokeWidth={6} />
      </g>
      <g>
        <circle cx={64} cy={178} r={14} fill={INK} /><circle cx={64} cy={178} r={4} fill={W} />
        <circle cx={150} cy={178} r={14} fill={INK} /><circle cx={150} cy={178} r={4} fill={W} />
      </g>
      <path d="M 40 196 L 58 196 M 120 196 L 140 196 M 170 196 L 182 196" {...ln} strokeWidth={4} />
    </g>
  )
}

function Peek({ pose }: { pose: Pose }) {
  return (
    <g>
      <Head pose={pose} />
      <Ring x={76} y={138} r={9} /><Ring x={124} y={138} r={9} />
      <path d="M 24 146 C 80 145, 130 147, 176 146" {...ln} strokeWidth={4.4} />
    </g>
  )
}

/* ————————————————— the component ————————————————— */

export interface MomoProps {
  state?: MomoState
  className?: string
  style?: CSSProperties
  /** change to make Momo do a tiny squish */
  pokeKey?: number
  decorative?: boolean
  /** a short hand-drawn ground line under Momo */
  ground?: boolean
  /** small live effects (glance, ear twitch, yarn moments) */
  fx?: MomoFx
}

export function Momo({ state = 'idle', className, style, pokeKey = 0, decorative, ground, fx = {} }: MomoProps) {
  const { t } = useI18n()
  const fid = useId().replace(/:/g, '')
  const pose = POSES[state]
  const viewBox = pose.body === 'peek' ? '20 28 160 128' : '0 10 200 196'
  const body = (() => {
    switch (pose.body) {
      case 'peek': return <Peek pose={pose} />
      case 'lie': return <Lying pose={pose} />
      case 'car': return <Car pose={pose} />
      case 'quarter': return <Quarter pose={pose} />
      case 'profile': return pose.softProfile ? <ProfileSoft pose={pose} /> : <Profile pose={pose} />
      case 'side': return <SideSit pose={pose} />
      default: return <Sitting pose={pose} />
    }
  })()
  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={{ overflow: 'visible', ...style }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : t('momo.label', { desc: t(`momo.${state}` as Key) })}
    >
      {/* a faint wobble so the lines feel hand-drawn, not vector-perfect */}
      <filter id={`wob${fid}`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={7} />
        <feDisplacementMap in="SourceGraphic" scale={2.2} />
      </filter>
      <g filter={`url(#wob${fid})`}>
        {ground && pose.body !== 'car' && pose.body !== 'peek' && <path d="M 16 190 C 70 188.5, 130 191, 184 189" {...ln} strokeWidth={4} />}
        <motion.g key={state} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>
          <motion.g
            key={pokeKey}
            initial={pokeKey ? { scaleY: 0.93, scaleX: 1.05 } : false}
            animate={{ scaleY: 1, scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            style={{ originX: 0.5, originY: 1 }}
          >
            <FxCtx.Provider value={fx}>
              <g key={fx.act === 'stretch' ? fx.actKey : 0} className={fx.act === 'stretch' ? 'anim-stretch' : undefined} style={{ transformBox: 'view-box', transformOrigin: '100px 188px' }}>
                <g className={pose.hop ? 'anim-hop' : undefined}>{body}</g>
              </g>
              {pose.body === 'car' && <YarnArt yarn={pose.yarn} />}
              <ExtraArt extra={pose.extra} />
            </FxCtx.Provider>
          </motion.g>
        </motion.g>
      </g>
    </svg>
  )
}
