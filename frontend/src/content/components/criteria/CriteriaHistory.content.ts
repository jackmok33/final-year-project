import type { Rubric } from '../../../domain/types'

export const criteriaHistoryContent = {
  versionHistory: 'Version history',
  loadVersion: (version: string) => `Load criteria v${version}`,
  versionStatus: (version: string, active: boolean) =>
    `v${version} · ${active ? 'Active' : 'Preserved'}`,
  versionDetails: (createdAt: string, rubric: Rubric) =>
    `${createdAt} · Weights ${Object.values(rubric.weights).join(' / ')} · Reject ${rubric.rejectBelow} · Offer ${rubric.offerFrom} · Margin ±${rubric.margin}`,
} as const
