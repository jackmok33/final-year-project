import { describe, expect, it } from 'vitest'
import { migrateDataset } from './migration'
import { dataset, programme, rubric } from '../test/fixtures'
describe('legacy demo dataset migration', () => {
  it('preserves reviews, files and permissions when promoting the single course', () => {
    const { programmes: _programmes, activeRubricIds: _active, ...records } = dataset
    const legacy = { ...records, version: 1, programme, activeRubricId: rubric.id }
    const migrated = migrateDataset(legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.programmes).toEqual([programme])
    expect(migrated.activeRubricIds).toEqual({ [programme.id]: rubric.id })
    expect(migrated.applications).toEqual(dataset.applications)
    expect(migrated.documents).toEqual(dataset.documents)
    expect(migrated.users).toEqual(dataset.users)
    expect(legacy.version).toBe(1)
    expect(migrated).not.toHaveProperty('programme')
    expect(migrated).not.toHaveProperty('activeRubricId')
    // All unrelated records remain intact; only the version and course fields change.
    expect(_programmes).toHaveLength(2)
    expect(_active[programme.id]).toBe(rubric.id)
  })
  it('keeps a modern dataset unchanged', () => expect(migrateDataset(dataset)).toBe(dataset))
})
