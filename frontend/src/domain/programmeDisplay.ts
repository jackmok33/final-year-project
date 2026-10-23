import type { Programme } from './types'
import { normalizeIntakeYear } from './intakes'

const abbreviations: Record<string, string> = {
  'Computational Statistics and Machine Learning MSc': 'CSML',
  'Computer Science MSc': 'CS',
  'Machine Learning MSc': 'ML',
}

export function programmeName(programme: Programme): string {
  return abbreviations[programme.name] ?? programme.name
}

export function programmeIntakeLabel(programme: Programme, year: string): string {
  const normalized = normalizeIntakeYear(year)
  const compactYear = normalized ? `${normalized.slice(2, 4)}/${normalized.slice(-2)}` : year
  return `${programmeName(programme)} ${compactYear}`
}
