import type { ContentValue } from '../../formatText'

export const criteriaFormContent = {
  admissionCriteria: 'Admission criteria',
  subtitle: 'View the criteria used to assess this programme’s applications.',
  activeVersion: (version: ContentValue) => `Active: v${String(version)}`,
  policyNotice:
    'Weights and rules are fixed for the MVP. These are illustrative values, not UCL admissions policy.',
} as const
