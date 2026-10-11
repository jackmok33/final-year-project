import type { Dataset, Programme } from '../domain/types'

type LegacyDataset = Omit<Dataset, 'version' | 'programmes' | 'activeRubricIds'> & {
  version: 1
  programme: Programme
  activeRubricId: string
}
/** Preserve the original single-programme dataset, including all review history. */
export function migrateDataset(value: unknown): Dataset {
  if ((value as { version?: number })?.version === 1) {
    const { programme, activeRubricId, ...records } = value as LegacyDataset
    return {
      ...records,
      version: 2,
      programmes: [programme],
      activeRubricIds: { [programme.id]: activeRubricId },
    }
  }
  return value as Dataset
}
