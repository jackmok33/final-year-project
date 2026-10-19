import type { Application, Programme } from './types'

export function normalizeIntakeYear(value: string): string | undefined {
  const match = /^(\d{2}|\d{4})\s*\/\s*(\d{2}|\d{4})$/.exec(value.trim())
  if (!match) return undefined
  const start = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1])
  const end = Number(match[2])
  if (start < 1900 || start > 9998 || end % 100 !== (start + 1) % 100) return undefined
  if (match[2].length === 4 && end !== start + 1) return undefined
  return `${start} / ${String(start + 1).slice(-2)}`
}

export function applicationIntakeYear(application: Application, programme: Programme): string {
  const year = application.intakeYear ?? programme.year
  return normalizeIntakeYear(year) ?? year
}

export function intakeYears(programme: Programme, applications: Application[]): string[] {
  const current = normalizeIntakeYear(programme.year)
  const start = current ? Number(current.slice(0, 4)) : undefined
  const recent = start
    ? [start, start - 1, start - 2].map((year) => `${year} / ${String(year + 1).slice(-2)}`)
    : [programme.year]
  return [
    ...new Set([
      ...recent,
      ...applications
        .filter((a) => a.programmeId === programme.id)
        .map((a) => applicationIntakeYear(a, programme)),
    ]),
  ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
}
