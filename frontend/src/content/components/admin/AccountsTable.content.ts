import type { ContentValue } from '../../formatText'

export const accountsTableContent = {
  accounts: 'Accounts',
  demoAccounts: 'Demo accounts',
  user: 'User',
  role: 'Role',
  programmeAccess: 'Programme access',
  state: 'State',
  criteria: ' + criteria',
  noTutorAccess: 'No tutor access',
  active: 'Active',
  inactive: 'Inactive',
  edit: 'Edit',
  editLabel: (name: ContentValue) => `Edit ${String(name)}`,
  permissionNotice:
    'Administrator permission alone does not grant applicant-document access, rubric publication or admissions decisions.',
} as const
