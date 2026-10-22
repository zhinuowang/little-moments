import type { MomoState } from '../components/momo/Momo'
import type { CategoryId, Energy, MoodId } from '../types'

/** Non-text facts about moods and categories. Words live in src/i18n. */
export interface MoodMeta { id: MoodId; momo: MomoState; energy: Energy }

export const MOODS: MoodMeta[] = [
  { id: 'happy', momo: 'happy', energy: 'medium' },
  { id: 'tired', momo: 'tea', energy: 'low' },
  { id: 'bored', momo: 'thinking', energy: 'medium' },
  { id: 'down', momo: 'quiet', energy: 'low' },
  { id: 'peaceful', momo: 'calm', energy: 'low' },
  { id: 'adventurous', momo: 'walking', energy: 'high' },
]
export const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m])) as Record<MoodId, MoodMeta>

/** Each category gets one quiet accent, used only in small pockets. */
export const CATEGORIES: { id: CategoryId; accent: string }[] = [
  { id: 'slow', accent: 'var(--color-blue)' },
  { id: 'outside', accent: 'var(--color-sage)' },
  { id: 'new', accent: 'var(--color-butter)' },
  { id: 'cozy', accent: 'var(--color-pink)' },
  { id: 'nothing', accent: 'var(--color-mist)' },
]
export const CATEGORY_ACCENT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.accent])) as Record<CategoryId, string>

export type DayPart = 'morning' | 'day' | 'evening' | 'late' | 'weekend'
export function dayPart(d = new Date()): DayPart {
  const h = d.getHours()
  if (h < 5) return 'late'
  if ((d.getDay() === 0 || d.getDay() === 6) && h < 17) return 'weekend'
  if (h < 11) return 'morning'
  if (h < 17) return 'day'
  if (h < 22) return 'evening'
  return 'late'
}
