import { textValue, type ContentValue } from '../../formatText'

export const criteriaFormContent = {
  admissionCriteria: 'Admission criteria',
  subtitle: 'Manage a versioned rubric for authorised tutor review.',
  activeVersion: (version: ContentValue) => `Active: v${String(version)}`,
  draftVersion: (length: ContentValue) => `Editing draft: v1.${String(length)}`,
  activateDraft: 'Activate draft',
  policyNotice:
    'Illustrative demo values. The programme’s actual UCL admissions policy is still to be agreed.',
  permissionNotice: 'Your tutor account can inspect criteria but cannot publish them.',
  activateANewCriteriaVersion: 'Activate a new criteria version?',
  activationDescription: (length: ContentValue, version: ContentValue) =>
    `This creates v1.${textValue(length)}. Existing runs keep v${textValue(version)}; new runs use the new weights and rules.`,
} as const
