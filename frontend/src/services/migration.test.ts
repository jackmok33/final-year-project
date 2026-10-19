import { describe, expect, it } from 'vitest'
import { migrateDataset, renameExampleCourses } from './migration'
import { dataset, programme, rubric } from '../test/fixtures'
import { firstProgramme, secondProgramme, thirdProgramme, thirdRubric } from './seed'
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

describe('example course labels', () => {
  const legacy = { ...programme, createdBy: undefined, name: 'Programme · TBC', code: 'PG-TBC' }
  function codeOnlyExamples() {
    const data = structuredClone(dataset)
    data.programmes.forEach((p) => {
      p.name = p.code
      delete p.createdBy
    })
    return data
  }
  it('upgrades code-only examples and adds the empty third course once, preserving reviews', () => {
    const data = codeOnlyExamples()
    const original = structuredClone(data)
    renameExampleCourses(data)
    expect(data.programmes.map((p) => p.name)).toEqual([
      firstProgramme.name,
      secondProgramme.name,
      thirdProgramme.name,
    ])
    expect(data.users[0].programmeIds).toEqual(['programme-1', 'programme-2', 'programme-3'])
    expect(data.users[1].programmeIds).toEqual([])
    expect(data.activeRubricIds['programme-3']).toBe(thirdRubric.id)
    expect(data.applications).toEqual(original.applications)
    expect(data.documents).toEqual(original.documents)
    expect(data.audit).toEqual(original.audit)
    const upgraded = structuredClone(data)
    renameExampleCourses(data)
    expect(data).toEqual(upgraded)
    data.users[0].programmeIds = ['programme-1']
    data.programmes = data.programmes.filter((p) => p.id !== 'programme-3')
    renameExampleCourses(data)
    expect(data.programmes).toHaveLength(2)
    expect(data.users[0].programmeIds).toEqual(['programme-1'])
  })
  it.each(['removed assignment', 'admin-only'])(
    'does not grant the third example after %s',
    (kind) => {
      const data = codeOnlyExamples()
      if (kind === 'removed assignment') data.users[0].programmeIds = ['programme-1']
      else data.users[0].roles = ['admin']
      renameExampleCourses(data)
      expect(data.users[0].programmeIds).not.toContain('programme-3')
    },
  )
  it.each(['id', 'code', 'rubric'])(
    'preserves a conflicting %s when adding the third example',
    (kind) => {
      const data = codeOnlyExamples()
      if (kind === 'rubric') data.rubrics.push({ ...thirdRubric, programmeId: programme.id })
      else
        data.programmes.push({
          ...thirdProgramme,
          id: kind === 'id' ? thirdProgramme.id : 'custom-course',
          name: 'My own course',
          code: kind === 'code' ? thirdProgramme.code.toLowerCase() : 'CUSTOM',
        })
      renameExampleCourses(data)
      expect(data.programmes.some((p) => p.name === thirdProgramme.name)).toBe(false)
      expect(data.users[0].programmeIds).not.toContain('programme-3')
    },
  )
  it.each([
    { ...legacy, name: 'My edited course' },
    { ...legacy, code: 'CUSTOM' },
    { ...legacy, createdBy: 'tutor-a' },
  ])('preserves customised or owned workspaces: %j', (record) => {
    const data = { ...structuredClone(dataset), programmes: [record] }
    const before = structuredClone(data)
    renameExampleCourses(data)
    expect(data).toEqual(before)
  })
  it('does not introduce duplicate codes or recreate removed workspaces', () => {
    const data = {
      ...structuredClone(dataset),
      programmes: [legacy, { ...programme, id: 'custom', code: 'comp0001' }],
    }
    const before = structuredClone(data)
    renameExampleCourses(data)
    expect(data).toEqual(before)
    data.programmes = []
    renameExampleCourses(data)
    expect(data.programmes).toEqual([])
  })
})
