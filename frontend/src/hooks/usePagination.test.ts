// @vitest-environment jsdom
import '../test/domSetup'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePagination } from './usePagination'

describe('usePagination', () => {
  it('starts on the first page with the default page size', () => {
    const { result } = renderHook(() => usePagination(23))
    expect(result.current).toMatchObject({ page: 0, pageSize: 10, startIndex: 0, endIndex: 10 })
  })

  it('uses a page-specific size and returns the matching row range', () => {
    const { result } = renderHook(() => usePagination(23, 5))
    act(() => result.current.setPage(2))
    expect(result.current).toMatchObject({ page: 2, pageSize: 5, startIndex: 10, endIndex: 15 })
  })

  it('bounds the visible page when the result set shrinks, including zero rows', () => {
    const { result, rerender } = renderHook(({ total }) => usePagination(total, 5), {
      initialProps: { total: 23 },
    })
    act(() => result.current.setPage(4))
    rerender({ total: 7 })
    expect(result.current).toMatchObject({ page: 1, startIndex: 5, endIndex: 10 })
    rerender({ total: 0 })
    expect(result.current).toMatchObject({ page: 0, startIndex: 0, endIndex: 5 })
  })

  it('returns to the first page after a page-size change', () => {
    const { result } = renderHook(() => usePagination(100, 5))
    act(() => result.current.setPage(4))
    act(() => result.current.setPageSize(25))
    expect(result.current).toMatchObject({ page: 0, pageSize: 25, startIndex: 0, endIndex: 25 })
  })

  it('lets the owning page reset navigation after a filter or sort change', () => {
    const { result } = renderHook(() => usePagination(100, 5))
    act(() => result.current.setPage(4))
    act(() => result.current.resetPage())
    expect(result.current.page).toBe(0)
    expect(result.current.pageSize).toBe(5)
  })
})
