import { ACTIVITIES } from '../data/activities'
import { MOOD_BY_ID } from '../data/meta'
import type { Activity, CategoryId, Energy, MoodId } from '../types'
import { daySeed, seeded } from './util'

export type TimeFilter = 'any' | '15' | '30' | '60' | 'long'
export type EnergyFilter = 'any' | Energy
export type PlaceFilter = 'any' | 'indoor' | 'outdoor'
export type BudgetFilter = 'any' | 'free' | 'paid'

export interface Filters {
  time: TimeFilter
  energy: EnergyFilter
  place: PlaceFilter
  budget: BudgetFilter
}

export const defaultFilters: Filters = { time: 'any', energy: 'any', place: 'any', budget: 'any' }

const ENERGY_RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 }

function passes(a: Activity, f: Filters) {
  if (f.time === '15' && a.minutes > 15) return false
  if (f.time === '30' && a.minutes > 30) return false
  if (f.time === '60' && a.minutes > 60) return false
  if (f.time === 'long' && a.minutes < 45) return false
  if (f.energy !== 'any' && a.energy !== f.energy) return false
  if (f.place !== 'any' && a.place !== f.place) return false
  if (f.budget === 'free' && a.cost !== 'free') return false
  if (f.budget === 'paid' && a.cost !== 'paid') return false
  return true
}

/**
 * Deterministic, tag-based ranking — no AI.
 * Hard filters remove activities; soft signals (mood, energy, recency) rank them.
 * Ties are broken with a per-day seed so suggestions vary day to day but
 * stay stable while you browse.
 */
export function recommend(opts: {
  category: Exclude<CategoryId, 'nothing'> | 'all'
  mood?: MoodId
  filters: Filters
  recent: string[]
}): Activity[] {
  const { category, mood, filters, recent } = opts
  const rand = seeded(daySeed() + (mood ? mood.length * 97 : 0) + category.length * 13)
  const jitter = new Map(ACTIVITIES.map((a) => [a.id, rand()]))
  const moodEnergy = mood ? MOOD_BY_ID[mood].energy : undefined

  return ACTIVITIES
    .filter((a) => (category === 'all' || a.category === category) && passes(a, filters))
    .map((a) => {
      let score = 0
      if (mood && a.moods.includes(mood)) score += 3
      if (mood && a.moods[0] === mood) score += 1
      if (moodEnergy && filters.energy === 'any') {
        score -= Math.abs(ENERGY_RANK[a.energy] - ENERGY_RANK[moodEnergy]) * 0.8
      }
      // tired or low folks get gentler, shorter ideas first
      if ((mood === 'tired' || mood === 'down') && a.minutes > 60) score -= 1
      const r = recent.indexOf(a.id)
      if (r !== -1) score -= 2.5 - r * 0.15 // recently seen → nudged down, not banned
      score += jitter.get(a.id)! * 0.9
      return { a, score }
    })
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a)
}
