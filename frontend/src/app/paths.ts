import { normalizeIntakeYear } from '../domain/intakes'

export const PROGRAMMES_PATH = '/programmes'
const LEGACY_INTAKE_PREFIX = '~'

export interface IntakeScope {
  programmeId: string
  intakeYear: string
}

export interface ApplicationScope extends IntakeScope {
  batchId?: string
}

export function programmePath(programmeId: string): string {
  return `${PROGRAMMES_PATH}/${encodeURIComponent(programmeId)}`
}

// Keep legacy labels outside Router's percent/slash decoding and URL dot-segment rules.
function legacyIntakeSegment(value: string): string {
  const binary = Array.from(new TextEncoder().encode(value), (byte) =>
    String.fromCharCode(byte),
  ).join('')
  return (
    LEGACY_INTAKE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  )
}

/** Router parameters have already been decoded. Invalid reserved encodings are unavailable. */
export function intakeYearFromSegment(value?: string): string | undefined {
  if (value === undefined) return undefined
  if (value.startsWith(LEGACY_INTAKE_PREFIX)) {
    const encoded = value.slice(LEGACY_INTAKE_PREFIX.length)
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return undefined
    try {
      const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      const label = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      return label && legacyIntakeSegment(label) === value ? label : undefined
    } catch {
      return undefined
    }
  }
  const numeric = /^(\d{4})-(\d{2})$/.exec(value)
  return normalizeIntakeYear(numeric ? `${numeric[1]} / ${numeric[2]}` : value) ?? value
}

export function intakePath({ programmeId, intakeYear }: IntakeScope): string {
  const normalized = normalizeIntakeYear(intakeYear)
  const segment = normalized ? normalized.replace(' / ', '-') : legacyIntakeSegment(intakeYear)
  return `${programmePath(programmeId)}/intakes/${encodeURIComponent(segment)}`
}

export function batchPath(scope: IntakeScope & { batchId: string }): string {
  return `${intakePath(scope)}/batches/${encodeURIComponent(scope.batchId)}`
}

export function applicationsPath(scope: ApplicationScope): string {
  return scope.batchId
    ? batchPath({ ...scope, batchId: scope.batchId })
    : `${intakePath(scope)}/applications`
}

export function newApplicationPath(scope: ApplicationScope): string {
  const parent = scope.batchId ? `${applicationsPath(scope)}/applications` : applicationsPath(scope)
  return `${parent}/new`
}

export function applicationPath(scope: ApplicationScope & { applicationId: string }): string {
  const parent = scope.batchId ? `${applicationsPath(scope)}/applications` : applicationsPath(scope)
  return `${parent}/${encodeURIComponent(scope.applicationId)}`
}

/** A canonical child cannot be opened under another programme, intake or batch. */
export function matchesRouteScope(
  params: Record<string, string | undefined>,
  actual: ApplicationScope,
): boolean {
  if (!params.programmeId) return true
  return (
    params.programmeId === actual.programmeId &&
    intakeYearFromSegment(params.intake) ===
      (normalizeIntakeYear(actual.intakeYear) ?? actual.intakeYear) &&
    params.batchId === actual.batchId
  )
}
