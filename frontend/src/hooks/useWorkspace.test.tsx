// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { otherProgramme, programme, tutor } from '../test/fixtures'
import { apiMocks, queryResult, resetPageMocks, state } from '../test/pageMocks'
import { useWorkspace } from './useWorkspace'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('./redux', async () => (await import('../test/pageMocks')).reduxMocks)
beforeEach(resetPageMocks)
describe('assigned programme selection', () => {
  it('keeps intake preferences independent per tutor and module', () => {
    state.ui.intakeByUser[tutor.id] = { [programme.id]: '25/26', [otherProgramme.id]: '2024 / 25' }
    const { result, rerender } = renderHook(useWorkspace)
    expect(result.current.intakeYear).toBe('2025 / 26')
    state.ui.programmeByUser[tutor.id] = otherProgramme.id
    rerender()
    expect(result.current.intakeYear).toBe('2024 / 25')
    state.ui.intakeByUser[tutor.id][otherProgramme.id] = ''
    rerender()
    expect(result.current.intakeYear).toBe(otherProgramme.year)
  })
  it('uses the selected course only if the user still owns it', () => {
    state.ui.programmeByUser[tutor.id] = otherProgramme.id
    const { result, rerender } = renderHook(useWorkspace)
    expect(result.current.programme).toEqual(otherProgramme)
    apiMocks.useProgrammesQuery.mockReturnValue(
      queryResult([programme, { ...otherProgramme, createdBy: 'other-tutor' }]),
    )
    rerender()
    expect(result.current.programme).toEqual(programme)
    expect(result.current.programmes).toEqual([programme])
  })
  it('does not reuse another user’s workspace preference', () => {
    state.ui.programmeByUser['other-user'] = otherProgramme.id
    expect(renderHook(useWorkspace).result.current.programme).toEqual(programme)
  })
  it('returns no workspace for users without course permissions', () => {
    apiMocks.useMeQuery.mockReturnValue(
      queryResult({ ...tutor, id: 'other-tutor', programmeIds: [programme.id] }),
    )
    const { result } = renderHook(useWorkspace)
    expect(result.current.programme).toBeUndefined()
    expect(result.current.programmes).toEqual([])
  })
  it('surfaces loading and failure of assigned-course queries', () => {
    apiMocks.useProgrammesQuery.mockReturnValue({
      isLoading: true,
      error: { data: 'Course lookup failed' },
    })
    const { result } = renderHook(useWorkspace)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toEqual({ data: 'Course lookup failed' })
  })
})
