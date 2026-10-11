import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { setupListeners } from '@reduxjs/toolkit/query'
import { admissionsApi } from './api'
function savedSession() {
  try {
    return sessionStorage.getItem('ucl-demo-user')
  } catch {
    return null
  }
}
const session = createSlice({
  name: 'session',
  initialState: { userId: savedSession() },
  reducers: {
    signIn(state, action: PayloadAction<string>) {
      state.userId = action.payload
    },
    signOut(state) {
      state.userId = null
    },
  },
})
function savedWorkspaces(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem('ucl-demo-workspaces') ?? '{}')
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((id) => typeof id === 'string')
    )
      return value as Record<string, string>
  } catch {
    /* Fall back to the first assigned programme. */
  }
  return {}
}
const ui = createSlice({
  name: 'ui',
  initialState: { navigationOpen: false, programmeByUser: savedWorkspaces() },
  reducers: {
    selectProgramme(state, action: PayloadAction<{ userId: string; programmeId: string }>) {
      state.programmeByUser[action.payload.userId] = action.payload.programmeId
    },
    setNavigationOpen(state, action: PayloadAction<boolean>) {
      state.navigationOpen = action.payload
    },
  },
})
export const { signIn, signOut } = session.actions
export const { setNavigationOpen, selectProgramme } = ui.actions
export const store = configureStore({
  reducer: {
    session: session.reducer,
    ui: ui.reducer,
    [admissionsApi.reducerPath]: admissionsApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(admissionsApi.middleware),
})
store.subscribe(() => {
  try {
    sessionStorage.setItem(
      'ucl-demo-workspaces',
      JSON.stringify(store.getState().ui.programmeByUser),
    )
    const id = store.getState().session.userId
    if (id) sessionStorage.setItem('ucl-demo-user', id)
    else sessionStorage.removeItem('ucl-demo-user')
  } catch {
    /* Session still works in memory if browser session storage is unavailable. */
  }
})
setupListeners(store.dispatch)
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
