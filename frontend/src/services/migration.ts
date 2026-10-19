import type { Dataset, Programme } from '../domain/types'
import { firstProgramme, secondProgramme, thirdProgramme, thirdRubric } from './seed'

/** Preserve records while retiring legacy shared assignments in favour of one owner. */
export function assignCourseOwners(data: Dataset) {
  for (const programme of data.programmes) {
    if (programme.createdBy !== undefined) continue
    const creation = data.audit.find(
      (event) => event.action === 'Create programme workspace' && event.target === programme.id,
    )
    const creator = data.users.find((u) => u.id === creation?.actor)
    const assigned = data.users.filter(
      (u) => u.roles.includes('tutor') && u.programmeIds.includes(programme.id),
    )
    const owner = creator ?? assigned.find((u) => u.active) ?? assigned[0]
    if (owner) programme.createdBy = owner.id
  }
  // Keep this field for older backups and consumers, but ownership is authoritative.
  for (const user of data.users)
    user.programmeIds = user.roles.includes('tutor')
      ? data.programmes.filter((p) => p.createdBy === user.id).map((p) => p.id)
      : []
}

/** Rename only untouched shared examples; retain IDs, user edits and linked review data. */
export function renameExampleCourses(data: Dataset) {
  const examples = [
    [firstProgramme, 'Programme · TBC', 'PG-TBC'],
    [secondProgramme, 'Data Science · Example', 'PG-DS-DEMO'],
  ] as const
  let upgraded = false
  for (const [example, oldName, oldCode] of examples) {
    const programme = data.programmes.find((p) => p.id === example.id)
    if (
      programme &&
      !programme.createdBy &&
      ((programme.name === oldName && programme.code === oldCode) ||
        (programme.name === example.code && programme.code === example.code)) &&
      !data.programmes.some(
        (p) => p.id !== example.id && p.code.trim().toUpperCase() === example.code,
      )
    ) {
      programme.name = example.name
      programme.code = example.code
      upgraded = true
    }
  }
  // Add the new empty example only during the label upgrade. Later loads must
  // preserve account edits, removed assignments and intentionally deleted courses.
  if (
    upgraded &&
    [firstProgramme.id, secondProgramme.id].every((id) =>
      data.programmes.some((p) => p.id === id && !p.createdBy),
    ) &&
    !data.programmes.some(
      (p) => p.id === thirdProgramme.id || p.code.trim().toUpperCase() === thirdProgramme.code,
    ) &&
    !data.rubrics.some((r) => r.id === thirdRubric.id)
  ) {
    data.programmes.push({ ...thirdProgramme })
    data.rubrics.push({ ...thirdRubric, weights: { ...thirdRubric.weights } })
    data.activeRubricIds[thirdProgramme.id] = thirdRubric.id
    const tutor = data.users.find(
      (u) =>
        u.id === 'tutor-a' &&
        u.roles.includes('tutor') &&
        [firstProgramme.id, secondProgramme.id].every((id) => u.programmeIds.includes(id)),
    )
    if (tutor && !tutor.programmeIds.includes(thirdProgramme.id))
      tutor.programmeIds.push(thirdProgramme.id)
  }
}

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
