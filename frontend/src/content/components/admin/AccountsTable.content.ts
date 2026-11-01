import type { ContentValue } from '../../formatText'
import type { User } from '../../../domain/types'
import { userFormContent } from './UserForm.content'

export const accountsTableContent = {
  accounts: 'Accounts',
  tableLabel: 'User accounts',
  user: 'User',
  role: 'Role',
  state: 'Status',
  actions: 'Actions',
  empty: 'No accounts found.',
  roleLabel: (roles: User['roles']) =>
    roles.includes('tutor') && roles.includes('admin')
      ? userFormContent.tutorAdministrator
      : roles.includes('admin')
        ? userFormContent.administrator
        : userFormContent.admissionsTutor,
  active: 'Active',
  inactive: 'Inactive',
  edit: 'Edit',
  editLabel: (name: ContentValue) => `Edit ${String(name)}`,
} as const
