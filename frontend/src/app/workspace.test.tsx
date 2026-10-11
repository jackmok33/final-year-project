// @vitest-environment jsdom
import '../test/domSetup'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiMocks, queryResult, resetPageMocks, state } from '../test/pageMocks'
import { programme, otherProgramme, tutor } from '../test/fixtures'
import { useWorkspace } from './workspace'
vi.mock('./api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('./store', async () => (await import('../test/pageMocks')).storeMocks)
beforeEach(resetPageMocks)
describe('assigned programme selection', () => {
  it('uses the selected course only if the user is still assigned to it', () => {
    state.ui.programmeByUser[tutor.id] = otherProgramme.id
    const { result, rerender } = renderHook(useWorkspace)
    expect(result.current.programme).toEqual(otherProgramme)
    apiMocks.useMeQuery.mockReturnValue(queryResult({ ...tutor, programmeIds: [programme.id] }))
    rerender()
    expect(result.current.programme).toEqual(programme)
    expect(result.current.programmes).toEqual([programme])
  })
  it('does not reuse another user’s workspace preference', () => {
    state.ui.programmeByUser['other-user'] = otherProgramme.id
    expect(renderHook(useWorkspace).result.current.programme).toEqual(programme)
  })
  it('returns no workspace for users without course permissions', () => {
    apiMocks.useMeQuery.mockReturnValue(queryResult({ ...tutor, programmeIds: [] }))
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
