import { userFormContent } from '../components/admin/UserForm.content'
import { workspaceLabels } from '../domain/workspace.content'

export const usersAccessPageContent = {
  usersAccess: 'Users',
  administration: workspaceLabels.administration,
  subtitle: 'Manage account details, roles and status.',
  newAccount: 'New account',
  createAccount: userFormContent.createAccount,
  editAccount: 'Edit account',
  closeAccount: 'Close account form',
  accountSaved: 'Account saved.',
} as const
