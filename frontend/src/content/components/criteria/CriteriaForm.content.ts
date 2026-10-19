import type { ContentValue } from '../../formatText'

export const criteriaFormContent = {
  back: 'Back',
  admissionCriteria: 'Admission criteria',
  subtitle: 'Criteria used to assess this course’s applications.',
  saveCriteria: 'Save criteria',
  saving: 'Saving…',
  discardChanges: 'Discard changes',
  saveNotice:
    'Saving creates a new version for future assessments. Existing results stay unchanged.',
  activeVersion: (version: ContentValue) => `Active: v${String(version)}`,
  loadedVersion: (version: string) => `Loaded v${version} into the form`,
} as const
