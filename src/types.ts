export type MoodId = 'happy' | 'tired' | 'bored' | 'down' | 'peaceful' | 'adventurous'

export type CategoryId = 'slow' | 'outside' | 'new' | 'cozy' | 'nothing'

export type Energy = 'low' | 'medium' | 'high'

export type Ritual = 'reading' | 'tea' | 'walk' | 'creative'

export type ActivityIcon =
  | 'book' | 'tea' | 'music' | 'pen' | 'pillow' | 'lamp' | 'shoe' | 'bookshop' | 'cafe'
  | 'sunset' | 'tree' | 'flower' | 'cup' | 'pot' | 'brush' | 'scissors' | 'camera'
  | 'yarn' | 'film' | 'cake' | 'shelf' | 'bath' | 'scrapbook' | 'star' | 'letter'
  | 'leaf' | 'moon' | 'cloud' | 'bread' | 'map'

export interface Activity {
  id: string
  title: string
  description: string
  category: Exclude<CategoryId, 'nothing'>
  moods: MoodId[]
  energy: Energy
  minutes: number
  place: 'indoor' | 'outdoor'
  cost: 'free' | 'paid'
  materials?: string[]
  steps: string[]
  icon: ActivityIcon
  invite: string
  ritual?: Ritual
}

export type StickerKind =
  | 'momo' | 'heart' | 'star' | 'flower' | 'cloud' | 'teacup' | 'leaf' | 'sun'
  | 'moon' | 'book' | 'cake' | 'letter' | 'sparkle' | 'paw' | 'pup' | 'rainbow'

export interface PlacedSticker {
  id: string
  kind: StickerKind
  x: number // percent of page width (centre)
  y: number // percent of page height (centre)
  rotate: number
  scale: number
}

/** 'letter' is kept so pages made before the redesign still open. */
export type LayoutId = 'polaroid' | 'pair' | 'text' | 'mood' | 'collage' | 'letter'
export type KeepsakeFrame = 'stamp' | 'ticket' | 'postcard'
export type PageTheme = 'cream' | 'blush' | 'butter' | 'sage' | 'sky' | 'night'

export interface JournalEntry {
  id: string
  date: string // YYYY-MM-DD local
  createdAt: number
  updatedAt: number
  mood?: MoodId
  activityId?: string
  activityTitle?: string
  title: string
  text: string
  photoIds: (string | null)[]
  stickers: PlacedSticker[]
  layout: LayoutId
  theme: PageTheme
  /** Added with the keepsake redesign; older pages show as stamps. */
  frame?: KeepsakeFrame
  place?: string
  /** Red seal. Older pages always had a date stamp, so only an explicit false hides it. */
  sealed?: boolean
}

export interface PhotoRecord {
  id: string
  blob: Blob
  createdAt: number
}

export interface Plan {
  id: string
  activityId?: string // when saved from the library
  custom?: { title: string; note: string; category: Exclude<CategoryId, 'nothing'> }
  date?: string
  createdAt: number
}

export type MotionPref = 'system' | 'reduced' | 'full'

export interface Prefs {
  name: string
  sound: boolean
  motion: MotionPref
  lamp: boolean
  cushion: number
  rug: number
  todayMood?: { mood: MoodId; date: string }
  recentActivityIds: string[]
  backupHintDismissed?: boolean
}

export const defaultPrefs: Prefs = {
  name: '',
  sound: true,
  motion: 'system',
  lamp: false,
  cushion: 0,
  rug: 0,
  recentActivityIds: [],
}
