import { finalDecision, type Application } from './types'

export interface ApplicationSummary {
  total: number
  offers: number
  unconditional: number
  conditional: number
  reject: number
  pending: number
}

/** Count current, classified tutor decisions consistently across lists and dashboards. */
export function summarizeApplications(applications: readonly Application[]): ApplicationSummary {
  const counts = { unconditional: 0, conditional: 0, reject: 0 }
  for (const application of applications) {
    switch (finalDecision(application)?.outcome) {
      case 'Unconditional':
        counts.unconditional += 1
        break
      case 'Conditional':
        counts.conditional += 1
        break
      case 'Reject':
        counts.reject += 1
        break
    }
  }
  const offers = counts.unconditional + counts.conditional
  return {
    total: applications.length,
    offers,
    ...counts,
    pending: applications.length - offers - counts.reject,
  }
}
