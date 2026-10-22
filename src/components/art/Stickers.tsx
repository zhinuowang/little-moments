import type { ReactNode } from 'react'
import type { StickerKind } from '../../types'
import { ACTIVITY_ART } from './Icons'

const K = '#1F1F1F'
const o = { stroke: K, strokeWidth: 3.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const ART: Record<StickerKind, ReactNode> = {
  momo: (
    <g>
      <path d="M 14 40 C 11 30, 12 20, 15 13 C 16 10, 17 7, 18 5 C 19 3, 21 3, 22 5 C 25 8, 28 11, 30 14 C 31 13, 33 13, 34 14 C 36 11, 39 8, 42 5 C 43 3, 45 3, 46 5 C 47 8, 48 11, 49 14 C 52 21, 53 30, 50 40 C 47 50, 40 54, 32 54 C 24 54, 17 50, 14 40 Z" fill="#FFFFFF" {...o} />
      <path d="M 28.5 16 L 29 21 M 32 15.5 L 32 21.5 M 35.5 16 L 35 21" fill="none" stroke="#8E8E8A" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={25} cy={33} r={2.2} fill={K} /><circle cx={39} cy={33} r={2.2} fill={K} />
      <path d="M 28.5 39 q 1.75 2.5 3.5 0 q 1.75 2.5 3.5 0" fill="none" {...o} strokeWidth={1.8} />
      <path d="M 15 13 C 16 10, 17 7, 18 5 C 19 3, 21 3, 22 5 C 25 8, 28 11, 30 14 Z" fill={K} />
    </g>
  ),
  heart: (<path d="M32 18 C 32 6, 56 6, 56 22 C 56 38, 32 54, 32 54 C 32 54, 8 38, 8 22 C 8 6, 32 6, 32 18 Z" fill="#1F1F1F" {...o} />),
  star: ACTIVITY_ART.star,
  flower: ACTIVITY_ART.flower,
  cloud: ACTIVITY_ART.cloud,
  teacup: ACTIVITY_ART.tea,
  leaf: ACTIVITY_ART.leaf,
  sun: (
    <g>
      <g fill="none" {...o}><path d="M32 3 v7 M32 54 v7 M3 32 h7 M54 32 h7 M11 11 l5 5 M48 48 l5 5 M53 11 l-5 5 M11 53 l5 -5" /></g>
      <circle cx={32} cy={32} r={16} fill="#FFFFFF" {...o} />
      <circle cx={27} cy={30} r={2} fill={K} /><circle cx={37} cy={30} r={2} fill={K} />
      <path d="M29 35 q3 3 6 0" fill="none" {...o} strokeWidth={2.2} />
    </g>
  ),
  moon: ACTIVITY_ART.moon,
  book: ACTIVITY_ART.book,
  cake: ACTIVITY_ART.cake,
  letter: ACTIVITY_ART.letter,
  sparkle: (
    <g>
      <path d="M28 6 Q 31 25 50 28 Q 31 31 28 52 Q 25 31 6 28 Q 25 25 28 6 Z" fill="#FFFFFF" {...o} />
      <path d="M50 44 Q 51 50 56 51 Q 51 52 50 58 Q 49 52 44 51 Q 49 50 50 44 Z" fill="#1F1F1F" {...o} strokeWidth={2.4} />
    </g>
  ),
  paw: (
    <g fill="#1F1F1F" {...o}>
      <path d="M20 42 C 20 32, 44 32, 44 42 C 44 52, 38 54, 32 52 C 26 54, 20 52, 20 42 Z" />
      <ellipse cx={14} cy={30} rx={5} ry={6} /><ellipse cx={24} cy={21} rx={5} ry={6.5} /><ellipse cx={40} cy={21} rx={5} ry={6.5} /><ellipse cx={50} cy={30} rx={5} ry={6} />
    </g>
  ),
  pup: (
    <g>
      <path d="M8 26 C 4 16, 10 10, 16 12 C 20 8, 26 10, 26 16 Z M56 26 C 60 16, 54 10, 48 12 C 44 8, 38 10, 38 16 Z" fill="#FFFFFF" {...o} />
      <path d="M10 26 C 10 18, 20 14, 32 14 C 44 14, 54 18, 54 26 L 54 46 C 54 52, 50 54, 46 54 L 18 54 C 14 54, 10 52, 10 46 Z" fill="#FFFFFF" {...o} />
      <circle cx={24} cy={32} r={2.2} fill={K} /><circle cx={40} cy={32} r={2.2} fill={K} />
      <ellipse cx={32} cy={40} rx={5.5} ry={4.2} fill={K} />
    </g>
  ),
  rainbow: (
    <g fill="none" stroke={K} strokeWidth={3.4} strokeLinecap="round">
      <path d="M8 48 a24 24 0 0 1 48 0" /><path d="M15 48 a17 17 0 0 1 34 0" /><path d="M22 48 a10 10 0 0 1 20 0" />
      <path d="M4 50 C 4 44, 14 44, 14 50 Z M50 50 C 50 44, 60 44, 60 50 Z" fill="#FFFFFF" strokeLinejoin="round" />
    </g>
  ),
}

export const STICKER_KINDS = Object.keys(ART) as StickerKind[]

export function StickerArt({ kind, className }: { kind: StickerKind; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      {ART[kind]}
    </svg>
  )
}
