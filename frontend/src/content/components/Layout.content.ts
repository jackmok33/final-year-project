import { moduleCardsContent } from './workspace/ModuleCards.content'

export const layoutContent = {
  modules: 'Courses',
  allModules: 'All courses',
  openModule: moduleCardsContent.openModule,
  returnToDemoSignIn: 'Return to sign-in',
  serviceHealth: 'Service health',
  usersAccess: 'Users & access',
  programmeSettings: 'Programme settings',
  dataOperations: 'Data operations',
  administration: 'Administration',
  switchToWorkspace: (role: string) => `Switch to ${role} workspace`,
  websiteAdministrator: 'Website administrator',
  admissionsTutor: 'Admissions tutor',
  signOut: 'Sign out',
  skipToMainContent: 'Skip to main content',
  workspaceNavigation: 'Workspace navigation',
  openNavigation: 'Open navigation',
  headerTitle: (section: string, page: string) => `${section} / ${page}`,
  tutorWorkspace: 'tutor',
  adminWorkspace: 'admin',
} as const
