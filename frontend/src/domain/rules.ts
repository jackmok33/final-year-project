import {
  legacySectionKeys,
  sectionKeys,
  type Outcome,
  type Rubric,
  type SectionScore,
} from './types'

export function validateRubric(rubric: Rubric): string | null {
  const keys =
    rubric.weights && Object.hasOwn(rubric.weights, 'references') ? sectionKeys : legacySectionKeys
  if (
    !rubric.weights ||
    Object.keys(rubric.weights).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(rubric.weights, key))
  )
    return 'Provide weights for academic performance, CV, personal statement and, when used, references.'
  const weights = keys.map((key) => rubric.weights[key])
  if (
    weights.some((w) => typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 100) ||
    Math.abs(weights.reduce<number>((a, b) => a + (b ?? 0), 0) - 100) > 0.001
  )
    return 'Section weights must be between 0 and 100 and total 100%.'
  if (
    ![rubric.rejectBelow, rubric.offerFrom, rubric.margin].every(Number.isFinite) ||
    rubric.rejectBelow < 0 ||
    rubric.offerFrom > 100 ||
    rubric.rejectBelow >= rubric.offerFrom ||
    rubric.margin < 0 ||
    rubric.margin > 100
  )
    return 'Use thresholds between 0 and 100, reject below offer, and a non-negative review margin.'
  if (typeof rubric.mandatoryRule !== 'string' || !rubric.mandatoryRule.trim())
    return 'A mandatory academic rule is required.'
  return null
}

export function criteriaChanged(draft: Rubric, active: Rubric): boolean {
  return (
    sectionKeys.some((key) => (draft.weights[key] ?? 0) !== (active.weights[key] ?? 0)) ||
    (['rejectBelow', 'offerFrom', 'margin'] as const).some((key) => draft[key] !== active[key])
  )
}
export function aggregate(
  sections: SectionScore[],
  rubric: Rubric,
  critical: boolean,
  mandatoryFailed = false,
): { overall: number | null; recommendation: Outcome; rules: string[] } {
  const keys = (rubric.weights.references ?? 0) > 0 ? sectionKeys : legacySectionKeys
  const complete = keys.every((key) => {
    const matches = sections.filter((s) => s.key === key)
    const s = matches[0]
    return (
      matches.length === 1 &&
      s?.score != null &&
      Number.isFinite(s.score) &&
      s.score >= 0 &&
      s.score <= 100
    )
  })
  const overall = complete
    ? Math.round(
        keys.reduce(
          (n, key) =>
            n + (sections.find((s) => s.key === key)!.score! * (rubric.weights[key] ?? 0)) / 100,
          0,
        ) * 100,
      ) / 100
    : null
  if (critical || !complete)
    return {
      overall,
      recommendation: 'Further review',
      rules: ['Unresolved critical or missing evidence takes precedence.'],
    }
  if (mandatoryFailed)
    return {
      overall,
      recommendation: 'Reject',
      rules: [`Verified failure: ${rubric.mandatoryRule}.`],
    }
  if (
    Math.abs(overall! - rubric.offerFrom) <= rubric.margin ||
    Math.abs(overall! - rubric.rejectBelow) <= rubric.margin
  )
    return {
      overall,
      recommendation: 'Further review',
      rules: [`Within the inclusive ±${rubric.margin}-point review margin of a threshold.`],
    }
  if (overall! >= rubric.offerFrom)
    return {
      overall,
      recommendation: 'Offer',
      rules: [`Score meets the offer threshold of ${rubric.offerFrom}.`],
    }
  if (overall! < rubric.rejectBelow)
    return {
      overall,
      recommendation: 'Reject',
      rules: [`Score is below the rejection threshold of ${rubric.rejectBelow}.`],
    }
  return {
    overall,
    recommendation: 'Further review',
    rules: ['Score lies between the offer and rejection thresholds.'],
  }
}
export function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
