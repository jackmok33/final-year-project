export const englishTestCheckCardContent = {
  heading: 'English test',
  demoRule: 'The demo rule requires at least 7.0 overall and 6.5 in each component.',
  run: 'Run English check',
  retry: 'Retry English check',
  queued: 'English check queued.',
  running: 'Reading the English test report.',
  errors: {
    interrupted: 'The check was interrupted.',
    unavailable: 'The Qwen service is unavailable.',
    timeout: 'The English check timed out.',
    source_unavailable: 'The source report is no longer available for this check.',
    processing_error: 'The English check failed.',
  },
  viewPage: (page: number) => `View original report, page ${page}`,
} as const
