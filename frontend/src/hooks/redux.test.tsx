// @vitest-environment jsdom
import '../test/domSetup'
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { signIn, signOut, store, type AppDispatch } from '../app/store'
import { useAppDispatch, useAppSelector } from './redux'

afterEach(() => {
  store.dispatch(signOut())
})

describe('typed Redux hooks', () => {
  it('dispatches actions and subscribes to the selected state through the provided store', () => {
    const { result } = renderHook(
      () => ({
        dispatch: useAppDispatch(),
        userId: useAppSelector((state) => state.session.userId),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )
    expectTypeOf(result.current.dispatch).toEqualTypeOf<AppDispatch>()
    expectTypeOf(result.current.userId).toEqualTypeOf<string | null>()

    act(() => {
      result.current.dispatch(signIn('tutor-a'))
    })
    expect(result.current.userId).toBe('tutor-a')
    act(() => {
      result.current.dispatch(signOut())
    })
    expect(result.current.userId).toBeNull()
  })
})
