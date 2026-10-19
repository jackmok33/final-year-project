export const intakeContent = {
  yearLabel: (year: string) => year.replace(/^(?:19|20)(\d{2})\s*\/\s*(\d{2})$/, '$1/$2'),
} as const
