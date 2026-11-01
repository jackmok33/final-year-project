import { workspaceNavigationContent } from './layout/WorkspaceNavigation.content'

export const layoutContent = {
  usersAccess: 'Users',
  serviceHealth: 'Service health',
  skipToMainContent: 'Skip to main content',
  workspaceNavigation: workspaceNavigationContent.workspaceNavigation,
  changePassword: 'Change password',
  closePassword: 'Close change password',
  passwordMismatch: 'New passwords must match.',
  passwordUnchanged: 'Choose a different new password.',
  passwordUnavailable:
    'Password changes will be available when account authentication is connected.',
} as const
