// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import '../test/domSetup'
import { useIsMounted } from './useIsMounted'

describe('useIsMounted', () => {
  it('tracks mount and unmount for an async callback captured by a handler', () => {
    const { result, unmount } = renderHook(() => useIsMounted())
    const isMounted = result.current
    expect(isMounted()).toBe(true)
    unmount()
    expect(isMounted()).toBe(false)
  })

  it('keeps the callback identity across renders', () => {
    const { result, rerender } = renderHook(() => useIsMounted())
    const isMounted = result.current
    rerender()
    expect(result.current).toBe(isMounted)
    expect(isMounted()).toBe(true)
  })

  it('survives StrictMode effect replay', () => {
    const { result, unmount } = renderHook(() => useIsMounted(), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    })
    expect(result.current()).toBe(true)
    unmount()
    expect(result.current()).toBe(false)
  })

  it('does not share lifecycle state between screens', () => {
    const first = renderHook(() => useIsMounted())
    const second = renderHook(() => useIsMounted())
    first.unmount()
    expect(first.result.current()).toBe(false)
    expect(second.result.current()).toBe(true)
  })
})
