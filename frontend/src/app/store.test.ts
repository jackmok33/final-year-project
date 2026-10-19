// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
beforeEach(() => {
  sessionStorage.clear()
  vi.resetModules()
})
describe('Redux session and interface state', () => {
  it('persists per-account per-module intake choices over refresh and sign-out', async () => {
    let mod = await import('./store')
    mod.store.dispatch(
      mod.selectProgramme({
        userId: 'tutor-a',
        programmeId: 'programme-1',
        intakeYear: '2025 / 26',
      }),
    )
    mod.store.dispatch(
      mod.selectProgramme({
        userId: 'tutor-b',
        programmeId: 'programme-1',
        intakeYear: '2024 / 25',
      }),
    )
    mod.store.dispatch(mod.signOut())
    vi.resetModules()
    mod = await import('./store')
    expect(mod.store.getState().ui.intakeByUser).toEqual({
      'tutor-a': { 'programme-1': '2025 / 26' },
      'tutor-b': { 'programme-1': '2024 / 25' },
    })
  })
  it.each(['[]', 'null', '{"tutor-a":123}', '{"tutor-a":{"programme-1":24}}'])(
    'ignores corrupt intake preferences: %s',
    async (raw) => {
      sessionStorage.setItem('ucl-demo-intakes', raw)
      const { store } = await import('./store')
      expect(store.getState().ui.intakeByUser).toEqual({})
    },
  )
  it('persists sign-in/out without persisting PDFs or API records', async () => {
    const { store, signIn, signOut } = await import('./store')
    expect(store.getState().session.userId).toBeNull()
    store.dispatch(signIn('tutor-a'))
    expect(store.getState().session.userId).toBe('tutor-a')
    expect(sessionStorage.getItem('ucl-demo-user')).toBe('tutor-a')
    expect(Object.keys(sessionStorage)).toEqual(
      expect.arrayContaining(['ucl-demo-user', 'ucl-demo-workspaces']),
    )
    store.dispatch(signOut())
    expect(store.getState().session.userId).toBeNull()
    expect(sessionStorage.getItem('ucl-demo-user')).toBeNull()
  })
  it('stores workspace preferences independently for each user and restores after reload', async () => {
    let mod = await import('./store')
    mod.store.dispatch(mod.selectProgramme({ userId: 'tutor-a', programmeId: 'programme-2' }))
    mod.store.dispatch(mod.selectProgramme({ userId: 'tutor-b', programmeId: 'programme-1' }))
    mod.store.dispatch(mod.setNavigationOpen(true))
    expect(mod.store.getState().ui.navigationOpen).toBe(true)
    vi.resetModules()
    mod = await import('./store')
    expect(mod.store.getState().ui.programmeByUser).toEqual({
      'tutor-a': 'programme-2',
      'tutor-b': 'programme-1',
    })
    expect(mod.store.getState().ui.navigationOpen).toBe(false)
  })
  it.each(['bad JSON', '[]', 'null', '{"tutor-a":123}'])(
    'ignores corrupt workspace preferences: %s',
    async (raw) => {
      sessionStorage.setItem('ucl-demo-workspaces', raw)
      const { store } = await import('./store')
      expect(store.getState().ui.programmeByUser).toEqual({})
    },
  )
  it('continues in memory when browser session storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    const { store, signIn, selectProgramme } = await import('./store')
    store.dispatch(signIn('tutor-a'))
    store.dispatch(selectProgramme({ userId: 'tutor-a', programmeId: 'programme-2' }))
    expect(store.getState().session.userId).toBe('tutor-a')
    expect(store.getState().ui.programmeByUser['tutor-a']).toBe('programme-2')
  })
})
