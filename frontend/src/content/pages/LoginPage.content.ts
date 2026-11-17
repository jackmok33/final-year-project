import { brandingContent } from '../branding.content'

export const loginPageContent = {
  accountsTitle: 'Account access',
  passwordTitle: 'Access your account',
  accountsDescription: 'Ask your administrator for an account and its access token.',
  passwordDescription:
    'Use the access token issued for your account. Contact your administrator if it is unavailable.',
  invalidAccount: 'No active account matches this email.',
  close: 'Close',
  closeHelp: 'Close help',
  copyright: 'Copyright 2026 · UCL Computer Science project',
  terms: 'Terms and Conditions',
  about: 'About Us',
  aboutDescription: `${brandingContent.workspaceName} is a final-year project for admissions decision support.`,
  termsDescription:
    'This is a project prototype. University deployment terms have not been configured.',
} as const
