import type { ReactNode } from 'react'
import type { ActivityIcon, CategoryId, MoodId } from '../../types'

/** Little marker doodles — black ink on white, the odd patch filled solid black. */
const K = '#1F1F1F'
const C = {
  // base fills are white so each icon reads as a line drawing…
  blush: '#FFFFFF', butter: '#FFFFFF', sage: '#FFFFFF', sky: '#FFFFFF', paper: '#FFFFFF', cream: '#FFFFFF',
  // …and what used to be colour is now either solid ink or a pale grey
  blushD: '#1F1F1F', butterD: '#E4E4DF', sageD: '#1F1F1F', skyD: '#B8B8B3', cocoa: '#1F1F1F',
}
const o = { stroke: K, strokeWidth: 3.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const line = { ...o, fill: 'none' }

const face = (x: number, y: number, kind: 'smile' | 'flat' | 'sleep' | 'w' = 'smile', gap = 9) => (
  <g>
    {kind === 'sleep' ? (
      <g {...line} strokeWidth={2.4}>
        <path d={`M ${x - gap / 2 - 3} ${y} q 3 2.5 6 0`} />
        <path d={`M ${x + gap / 2 - 3} ${y} q 3 2.5 6 0`} />
      </g>
    ) : (
      <g fill={K}><circle cx={x - gap / 2} cy={y} r={2} /><circle cx={x + gap / 2} cy={y} r={2} /></g>
    )}
    {kind === 'smile' && <path d={`M ${x - 3} ${y + 4} q 3 3 6 0`} {...line} strokeWidth={2.2} />}
    {kind === 'w' && <path d={`M ${x - 4} ${y + 4} q 2 2.5 4 0 q 2 2.5 4 0`} {...line} strokeWidth={2.2} />}
    {kind === 'flat' && <path d={`M ${x - 2.5} ${y + 5} h 5`} {...line} strokeWidth={2.2} />}
  </g>
)

export const ACTIVITY_ART: Record<ActivityIcon, ReactNode> = {
  book: (<g><path d="M8 18 L32 22 L56 18 L56 48 L32 52 L8 48 Z" fill={C.sageD} {...o} /><path d="M11 15 L32 20 L32 48 L11 44 Z" fill={C.paper} {...o} /><path d="M53 15 L32 20 L32 48 L53 44 Z" fill={C.paper} {...o} /><path d="M16 26 l10 2 M16 32 l10 2 M38 28 l10 -2 M38 34 l8 -1.5" {...line} strokeWidth={2} stroke={C.cocoa} /></g>),
  tea: (<g><path d="M27 16 c-3 -4 3 -6 0 -10 M35 16 c-3 -4 3 -6 0 -10" {...line} strokeWidth={2.4} opacity={0.6} /><path d="M44 28 c9 0 9 12 -1 12" {...line} /><path d="M12 22 h34 l-3 22 c-1 6 -27 6 -28 0 Z" fill={C.blush} {...o} />{face(29, 32, 'w')}<path d="M8 52 h44" {...line} /></g>),
  music: (<g><path d="M24 44 V14 L48 9 V39" {...line} strokeWidth={3.6} /><path d="M24 14 L48 9 V17 L24 22 Z" fill={C.butterD} {...o} /><ellipse cx={18} cy={45} rx={8} ry={6.5} fill={C.sky} {...o} /><ellipse cx={42} cy={40} rx={8} ry={6.5} fill={C.blush} {...o} /></g>),
  pen: (<g><rect x={12} y={10} width={32} height={42} rx={4} fill={C.paper} {...o} /><path d="M18 20 h20 M18 27 h20 M18 34 h12" {...line} strokeWidth={2} stroke={C.skyD} /><path d="M50 14 L36 44 L33 52 L40 46 L54 16 Z" fill={C.butterD} {...o} /></g>),
  pillow: (<g><path d="M10 20 C 8 14, 14 12, 18 14 C 26 10, 38 10, 46 14 C 50 12, 56 14, 54 20 C 57 28, 57 38, 54 44 C 56 50, 50 52, 46 50 C 38 54, 26 54, 18 50 C 14 52, 8 50, 10 44 C 7 38, 7 28, 10 20 Z" fill={C.sky} {...o} />{face(32, 30, 'sleep', 10)}</g>),
  lamp: (<g><path d="M20 10 h24 l7 20 h-38 Z" fill={C.butter} {...o} /><path d="M32 30 V48" {...line} /><path d="M20 52 h24" {...line} strokeWidth={4} /><circle cx={32} cy={34} r={14} fill={C.butter} opacity={0.35} /></g>),
  shoe: (<g><path d="M8 40 C 8 28, 14 18, 22 18 L 26 30 C 34 34, 48 34, 54 40 C 58 44, 56 50, 50 50 L 12 50 C 9 50, 8 46, 8 40 Z" fill={C.blush} {...o} /><path d="M10 44 H56" {...line} /><path d="M24 28 l4 -2 M28 33 l4 -2" {...line} strokeWidth={2.2} /></g>),
  bookshop: (<g><path d="M8 24 L32 10 L56 24" fill={C.blushD} {...o} /><rect x={12} y={24} width={40} height={30} fill={C.paper} {...o} /><rect x={18} y={30} width={6} height={18} fill={C.sageD} {...o} strokeWidth={2.4} /><rect x={24} y={32} width={6} height={16} fill={C.butterD} {...o} strokeWidth={2.4} /><rect x={36} y={34} width={10} height={20} fill={C.sky} {...o} strokeWidth={2.4} /></g>),
  cafe: (<g><path d="M24 16 c-3 -4 3 -6 0 -10 M34 16 c-3 -4 3 -6 0 -10" {...line} strokeWidth={2.4} opacity={0.6} /><path d="M14 22 h32 v14 c0 10 -32 10 -32 0 Z" fill={C.paper} {...o} /><path d="M46 26 c8 0 8 10 0 10" {...line} /><path d="M10 52 c8 -4 36 -4 44 0" {...line} /><path d="M22 30 c4 -4 12 -4 16 0" {...line} strokeWidth={2.2} stroke={C.cocoa} /></g>),
  sunset: (<g><path d="M14 40 a18 18 0 0 1 36 0 Z" fill={C.butterD} {...o} />{face(32, 32, 'sleep', 10)}<path d="M6 40 H58 M12 48 H52 M20 55 H44" {...line} /><path d="M32 8 v6 M12 18 l4 4 M52 18 l-4 4" {...line} /></g>),
  tree: (<g><path d="M32 40 V56" {...line} strokeWidth={5} /><path d="M32 8 C 20 8, 12 18, 14 28 C 8 34, 14 44, 22 42 C 26 46, 38 46, 42 42 C 50 44, 56 34, 50 28 C 52 18, 44 8, 32 8 Z" fill={C.sage} {...o} />{face(32, 28, 'smile')}</g>),
  flower: (<g><path d="M32 40 V56 M32 50 c-6 -6 -12 -4 -12 -4 M32 48 c6 -6 12 -4 12 -4" {...line} stroke={C.sageD} strokeWidth={3.4} /><g fill={C.blush} {...o}><circle cx={32} cy={13} r={8} /><circle cx={45} cy={23} r={8} /><circle cx={40} cy={38} r={8} /><circle cx={24} cy={38} r={8} /><circle cx={19} cy={23} r={8} /></g><circle cx={32} cy={27} r={8} fill={C.butter} {...o} />{face(32, 26, 'smile', 6)}</g>),
  cup: (<g><path d="M40 6 L34 22" {...line} strokeWidth={3.6} stroke={C.blushD} /><path d="M16 18 h32 l-4 34 c-1 4 -23 4 -24 0 Z" fill={C.sky} {...o} /><path d="M18 28 h28" {...line} strokeWidth={2.2} /><circle cx={26} cy={38} r={3} fill={C.paper} {...o} strokeWidth={2} /><circle cx={36} cy={44} r={2.5} fill={C.paper} {...o} strokeWidth={2} /></g>),
  pot: (<g><path d="M22 16 c-3 -4 3 -6 0 -9 M32 16 c-3 -4 3 -6 0 -9 M42 16 c-3 -4 3 -6 0 -9" {...line} strokeWidth={2.4} opacity={0.6} /><path d="M10 22 h44" {...line} strokeWidth={4} /><path d="M14 22 h36 v18 c0 10 -36 10 -36 0 Z" fill={C.sageD} {...o} /><path d="M8 28 h6 M50 28 h6" {...line} strokeWidth={4} />{face(32, 34, 'w')}</g>),
  brush: (<g><path d="M44 8 L52 16 L30 38 L24 34 Z" fill={C.butterD} {...o} /><path d="M24 34 C 16 34, 12 40, 12 48 C 12 52, 8 54, 8 54 C 18 56, 30 52, 30 42 Z" fill={C.blushD} {...o} /><circle cx={48} cy={46} r={7} fill={C.sky} {...o} /></g>),
  scissors: (<g><circle cx={18} cy={44} r={8} fill={C.blush} {...o} /><circle cx={42} cy={46} r={8} fill={C.blush} {...o} /><path d="M23 38 L46 10 M37 40 L22 12" {...line} strokeWidth={4} /><circle cx={31} cy={28} r={2} fill={K} /></g>),
  camera: (<g><path d="M22 16 l3 -6 h14 l3 6" fill={C.butter} {...o} /><rect x={8} y={16} width={48} height={34} rx={8} fill={C.sky} {...o} /><circle cx={32} cy={33} r={10} fill={C.paper} {...o} /><circle cx={32} cy={33} r={4} fill={K} /><circle cx={47} cy={23} r={2.5} fill={C.blushD} /></g>),
  yarn: (<g><circle cx={30} cy={32} r={20} fill={C.blush} {...o} /><path d="M14 26 C 24 22, 36 30, 48 26 M12 36 C 24 30, 38 40, 50 36 M22 48 C 28 36, 36 22, 42 14" {...line} strokeWidth={2.4} /><path d="M48 44 C 54 50, 58 54, 54 58" {...line} /></g>),
  film: (<g><rect x={8} y={24} width={48} height={28} rx={4} fill={C.paper} {...o} /><path d="M8 24 L52 12 L54 20 L10 32 Z" fill={C.cocoa} {...o} /><path d="M18 21 L24 27 M30 18 L36 24 M42 15 L48 21" {...line} strokeWidth={2.4} stroke={C.paper} />{face(32, 38, 'smile')}</g>),
  cake: (<g><path d="M12 30 L52 30 L52 52 L12 52 Z" fill={C.butter} {...o} /><path d="M12 30 C 12 20, 52 20, 52 30 C 48 36, 44 30, 40 34 C 36 38, 32 30, 28 34 C 24 38, 20 30, 16 34 Z" fill={C.paper} {...o} /><circle cx={32} cy={16} r={5} fill={C.blushD} {...o} />{face(32, 42, 'w')}</g>),
  shelf: (<g><path d="M8 30 H56 M8 54 H56" {...line} strokeWidth={4} /><rect x={12} y={10} width={7} height={20} fill={C.blushD} {...o} strokeWidth={2.6} /><rect x={19} y={13} width={7} height={17} fill={C.butterD} {...o} strokeWidth={2.6} /><path d="M28 30 L34 12 L40 14 L34 30" fill={C.sageD} {...o} strokeWidth={2.6} /><rect x={14} y={36} width={8} height={18} fill={C.sky} {...o} strokeWidth={2.6} /><rect x={22} y={38} width={7} height={16} fill={C.blush} {...o} strokeWidth={2.6} /><path d="M42 54 c0 -10 12 -10 12 0" fill={C.sage} {...o} strokeWidth={2.6} /></g>),
  bath: (<g><circle cx={20} cy={14} r={4} fill={C.paper} {...o} strokeWidth={2.2} /><circle cx={30} cy={10} r={3} fill={C.paper} {...o} strokeWidth={2.2} /><circle cx={40} cy={16} r={5} fill={C.paper} {...o} strokeWidth={2.2} /><path d="M6 30 h52" {...line} strokeWidth={4} /><path d="M10 30 h44 v8 c0 10 -8 14 -16 14 h-12 c-8 0 -16 -4 -16 -14 Z" fill={C.sky} {...o} /><path d="M18 52 l-3 5 M46 52 l3 5" {...line} /></g>),
  scrapbook: (<g><rect x={10} y={10} width={44} height={44} rx={5} fill={C.blush} {...o} /><rect x={18} y={16} width={22} height={20} fill={C.paper} {...o} transform="rotate(-6 29 26)" /><path d="M22 14 h12" stroke={C.butter} strokeWidth={6} opacity={0.9} /><path d="M18 44 h28" {...line} strokeWidth={2.2} /><path d="M44 30 c0 -3 4 -3 4 0 c0 -3 4 -3 4 0 c0 3 -4 6 -4 6 c0 0 -4 -3 -4 -6 Z" fill={C.blushD} {...o} strokeWidth={2} /></g>),
  star: (<g><path d="M32 6 L39 22 L56 24 L43 36 L47 53 L32 44 L17 53 L21 36 L8 24 L25 22 Z" fill={C.butter} {...o} />{face(32, 31, 'smile', 8)}</g>),
  letter: (<g><rect x={8} y={16} width={48} height={34} rx={4} fill={C.paper} {...o} /><path d="M8 18 L32 36 L56 18" {...line} /><path d="M27 42 c0 -4 5 -4 5 0 c0 -4 5 -4 5 0 c0 4 -5 7 -5 7 c0 0 -5 -3 -5 -7 Z" fill={C.blushD} {...o} strokeWidth={2} /></g>),
  leaf: (<g><path d="M12 52 C 8 30, 22 10, 52 10 C 54 36, 38 54, 12 52 Z" fill={C.sage} {...o} /><path d="M14 50 C 24 38, 34 28, 46 18" {...line} strokeWidth={2.4} />{face(32, 34, 'sleep', 8)}</g>),
  moon: (<g><path d="M40 8 C 22 8, 10 22, 12 38 C 14 52, 30 58, 44 52 C 30 50, 22 40, 24 28 C 26 18, 32 10, 40 8 Z" fill={C.butter} {...o} />{face(22, 36, 'sleep', 6)}<path d="M48 18 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill={C.butterD} {...o} strokeWidth={2} /></g>),
  cloud: (<g><path d="M16 46 C 6 46, 6 32, 16 32 C 16 20, 32 16, 36 26 C 44 18, 58 26, 52 36 C 60 38, 58 48, 50 48 Z" fill={C.paper} {...o} />{face(33, 38, 'w')}</g>),
  bread: (<g><path d="M8 40 C 10 26, 22 18, 32 18 C 42 18, 54 26, 56 40 C 50 48, 14 48, 8 40 Z" fill={C.butterD} {...o} /><path d="M22 22 c2 8 2 14 0 20 M32 18 v24 M42 22 c-2 8 -2 14 0 20" {...line} strokeWidth={2.4} />{face(32, 32, 'smile', 14)}</g>),
  map: (<g><path d="M8 14 L22 10 L42 16 L56 12 L56 50 L42 54 L22 48 L8 52 Z" fill={C.butter} {...o} /><path d="M22 10 V48 M42 16 V54" {...line} strokeWidth={2.4} /><path d="M14 40 C 20 30, 30 40, 34 30 S 46 24, 50 22" {...line} strokeWidth={2.4} strokeDasharray="3 4" stroke={C.blushD} /><path d="M47 18 l6 6 M53 18 l-6 6" {...line} stroke={C.blushD} strokeWidth={2.6} /></g>),
}

export function ActivityArt({ icon, className, title }: { icon: ActivityIcon; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {ACTIVITY_ART[icon]}
    </svg>
  )
}

const MOOD_ART: Record<MoodId, ReactNode> = {
  happy: (<g><g {...line} strokeWidth={3}><path d="M32 3 v6 M32 55 v6 M3 32 h6 M55 32 h6 M11 11 l4 4 M49 49 l4 4 M53 11 l-4 4 M11 53 l4 -4" /></g><circle cx={32} cy={32} r={17} fill={C.butter} {...o} />{face(32, 30, 'smile', 10)}</g>),
  tired: (<g><path d="M42 8 C 22 6, 8 22, 10 38 C 12 52, 28 60, 46 54 C 30 50, 22 38, 26 26 C 28 18, 34 12, 42 8 Z" fill={C.sky} {...o} />{face(21, 36, 'sleep', 7)}<text x={42} y={26} fontFamily="'LM Hand', sans-serif" fontWeight={400} fontSize={14} fill={K}>z</text><text x={50} y={16} fontFamily="'LM Hand', sans-serif" fontWeight={400} fontSize={10} fill={K}>z</text></g>),
  bored: (<g><path d="M14 46 C 4 46, 4 30, 15 30 C 15 18, 31 13, 36 23 C 44 15, 59 23, 52 34 C 61 36, 59 48, 50 48 Z" fill={C.sage} {...o} />{face(33, 36, 'flat', 10)}<path d="M28 31 h6 M38 31 h6" {...line} strokeWidth={2} /></g>),
  down: (<g><path d="M14 36 C 4 36, 4 22, 15 22 C 15 10, 31 6, 36 15 C 44 8, 59 15, 52 25 C 61 27, 59 38, 50 38 Z" fill={C.blush} {...o} />{face(33, 27, 'w', 10)}<path d="M22 46 c-3 4 -3 7 0 8 c3 -1 3 -4 0 -8 Z M40 48 c-3 4 -3 7 0 8 c3 -1 3 -4 0 -8 Z" fill={C.sky} {...o} strokeWidth={2.2} /></g>),
  peaceful: (<g><path d="M32 58 V36" {...line} stroke={C.sageD} strokeWidth={3.6} /><path d="M32 40 C 20 42, 10 34, 10 22 C 22 20, 32 28, 32 40 Z" fill={C.sage} {...o} /><path d="M32 36 C 34 22, 44 14, 56 16 C 56 30, 46 38, 32 36 Z" fill={C.sage} {...o} />{face(44, 25, 'sleep', 6)}</g>),
  adventurous: (<g><path d="M24 44 L28 52 H36 L40 44" {...line} /><rect x={26} y={51} width={12} height={8} rx={2} fill={C.cocoa} {...o} /><path d="M32 4 C 18 4, 10 14, 10 24 C 10 34, 22 42, 32 46 C 42 42, 54 34, 54 24 C 54 14, 46 4, 32 4 Z" fill={C.blush} {...o} /><path d="M32 4 C 26 14, 26 34, 32 46 C 38 34, 38 14, 32 4" fill={C.butter} {...o} strokeWidth={2.6} />{face(32, 22, 'smile', 14)}</g>),
}

export function MoodArt({ mood, className }: { mood: MoodId; className?: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true">{MOOD_ART[mood]}</svg>
}

const CATEGORY_ICON: Record<CategoryId, ActivityIcon> = {
  slow: 'tea', outside: 'tree', new: 'brush', cozy: 'pillow', nothing: 'cloud',
}

export function CategoryArt({ category, className }: { category: CategoryId; className?: string }) {
  return <ActivityArt icon={CATEGORY_ICON[category]} className={className} />
}

/** A small hand-drawn heart, used for saves and decorations. */
export function Heart({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 7 C 12 2, 21 2, 21 8.5 C 21 14, 12 20, 12 20 C 12 20, 3 14, 3 8.5 C 3 2, 12 2, 12 7 Z" fill={filled ? K : 'none'} stroke={K} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}
