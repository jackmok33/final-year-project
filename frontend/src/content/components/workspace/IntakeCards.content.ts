import { intakeContent } from '../../domain/intakes.content'

export const intakeCardsContent = {
  yearLabel: intakeContent.yearLabel,
  openIntake: (year: string) => `Open ${intakeContent.yearLabel(year)} intake`,
  applications: (count: number | undefined) =>
    count === undefined
      ? 'Application count unavailable'
      : `${count} application${count === 1 ? '' : 's'}`,
  viewApplications: 'View applications',
} as const
