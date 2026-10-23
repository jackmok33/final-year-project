import type { Dataset, Programme, Rubric } from '../../domain/types'
import { criteriaChanged, validateRubric } from '../../domain/rules'
import { normalizeCourseName } from '../../domain/courseName'
import { normalizeModuleCode } from '../../domain/moduleCode'
import { baseRubric } from '../seed'
import { requireAdmin, requireTutor } from './access'
import { recordAudit } from './runtime'
import type { Command, CommandContext, CommandResult } from './contracts'

function addProgrammeWithCriteria(data: Dataset, programme: Programme) {
  data.programmes.push(programme)
  const rubric: Rubric = {
    ...structuredClone(baseRubric),
    id: crypto.randomUUID(),
    programmeId: programme.id,
    createdAt: new Date().toISOString(),
  }
  data.rubrics.push(rubric)
  data.activeRubricIds[programme.id] = rubric.id
}

type SettingsCommand = Extract<
  Command,
  { op: 'rubric' | 'user' | 'workspace' | 'programme' | 'model' }
>

export function changeSettings(
  command: SettingsCommand,
  { data, user }: Pick<CommandContext, 'data' | 'user'>,
): CommandResult {
  let result: CommandResult = {}
  switch (command.op) {
    case 'rubric': {
      requireTutor(data, user, command.rubric.programmeId)
      const draft = command.rubric
      const active = data.rubrics.find((r) => r.id === data.activeRubricIds[draft.programmeId])
      if (!active || draft.id !== active.id || draft.version !== active.version)
        throw new Error('The active criteria have changed. Reload the page before editing.')
      const invalid = validateRubric(draft)
      if (invalid) throw new Error(invalid)
      if (draft.mandatoryRule !== active.mandatoryRule)
        throw new Error('The mandatory academic rule cannot be changed yet.')
      if (!criteriaChanged(draft, active))
        throw new Error('Change at least one weight, threshold or review margin before saving.')
      const versions = data.rubrics
        .filter((r) => r.programmeId === active.programmeId)
        .map((r) => /^(\d+)\.(\d+)$/.exec(r.version))
        .filter((match) => match !== null)
      const major = Math.max(1, ...versions.map((v) => Number(v[1])))
      const minor =
        Math.max(-1, ...versions.filter((v) => Number(v[1]) === major).map((v) => Number(v[2]))) + 1
      const saved: Rubric = {
        ...active,
        id: crypto.randomUUID(),
        version: `${major}.${minor}`,
        createdAt: new Date().toISOString(),
        weights: { ...draft.weights },
        rejectBelow: draft.rejectBelow,
        offerFrom: draft.offerFrom,
        margin: draft.margin,
      }
      data.rubrics.push(saved)
      data.activeRubricIds[saved.programmeId] = saved.id
      recordAudit(data, user.id, 'Save admission criteria', saved.id)
      result = { id: saved.id }
      break
    }
    case 'user': {
      requireAdmin(user)
      const edited = structuredClone(command.user)
      if (
        !edited.name.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edited.email) ||
        !edited.roles.length ||
        edited.roles.some((r) => !['tutor', 'admin'].includes(r)) ||
        edited.programmeIds.some((id) => !data.programmes.some((p) => p.id === id))
      )
        throw new Error('Enter a name, valid email, role and configured programme access.')
      if (
        data.users.some(
          (u) => u.id !== edited.id && u.email.toLowerCase() === edited.email.toLowerCase(),
        )
      )
        throw new Error('This email is already assigned to an account.')
      const existing = data.users.findIndex((u) => u.id === edited.id)
      const previousAccess = existing < 0 ? [] : data.users[existing].programmeIds
      if (
        new Set(edited.programmeIds).size !== previousAccess.length ||
        previousAccess.some((id) => !edited.programmeIds.includes(id))
      )
        throw new Error(
          'Course access follows ownership and cannot be assigned to another account.',
        )
      const others = data.users.filter(
        (u) => u.id !== edited.id && u.active && u.roles.includes('admin'),
      )
      if (
        !others.length &&
        (!edited.active || !edited.roles.includes('admin')) &&
        data.users.find((u) => u.id === edited.id)?.roles.includes('admin')
      )
        throw new Error('Keep at least one active administrator.')
      edited.programmeIds = edited.roles.includes('tutor')
        ? data.programmes.filter((p) => p.createdBy === edited.id).map((p) => p.id)
        : []
      if (!edited.roles.includes('tutor')) edited.canPublishCriteria = false
      if (existing >= 0) data.users[existing] = edited
      else data.users.push({ ...edited, id: crypto.randomUUID() })
      recordAudit(data, user.id, 'Save account and permissions', edited.id || edited.email)
      break
    }
    case 'workspace': {
      if (!user.roles.includes('tutor')) throw new Error('Tutor access is required.')
      const name = normalizeCourseName(command.name)
      if (!name) throw new Error('Enter a course name of 1 to 100 characters.')
      if (
        data.programmes.some(
          (p) => p.createdBy === user.id && p.name.trim().toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error('You already have access to a course with this name.')
      const id = crypto.randomUUID()
      const year = new Date().getFullYear()
      addProgrammeWithCriteria(data, {
        id,
        name,
        code: `COURSE-${id.toUpperCase()}`,
        year: `${year} / ${String(year + 1).slice(-2)}`,
        department: '',
        description:
          'User-created demo workspace. Initial criteria are examples, not UCL admissions policy.',
        createdBy: user.id,
      })
      user.programmeIds.push(id)
      recordAudit(data, user.id, 'Create programme workspace', id)
      result = { id }
      break
    }
    case 'programme': {
      requireAdmin(user)
      const edited = { ...command.programme }
      if (!edited.id) throw new Error('Tutors add their own courses from the Courses page.')
      // Metadata editing cannot claim or transfer ownership.
      delete edited.createdBy
      if (!edited.name.trim() || !edited.code.trim() || !edited.year.trim())
        throw new Error('Programme name, code and academic year are required.')
      const code = normalizeModuleCode(edited.code)
      if (!code) throw new Error('Enter a valid module code.')
      edited.code = code
      if (data.programmes.some((p) => p.id !== edited.id && p.code.trim().toUpperCase() === code))
        throw new Error('This programme code is already configured.')
      const index = data.programmes.findIndex((p) => p.id === edited.id)
      if (edited.id && index < 0) throw new Error('Programme not found.')
      data.programmes[index] = { ...edited, createdBy: data.programmes[index].createdBy }
      recordAudit(data, user.id, 'Save programme metadata', edited.id)
      result = { id: edited.id }
      break
    }
    case 'model':
      requireAdmin(user)
      data.modelAvailable = command.available
      recordAudit(data, user.id, 'Change simulated service availability', 'demo-model')
      break
  }
  return result
}
