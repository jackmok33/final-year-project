import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type {
  Application,
  AuditEvent,
  DemoHealth,
  DocumentRecord,
  Programme,
  Rubric,
  User,
  BatchSummary,
} from '../domain/types'
import {
  commandDemo,
  queryDemo,
  type Command,
  type CommandResult,
  type Query,
} from '../services/demo'

export interface ApiError {
  status: string
  data: string
}
type DemoRequest = { kind: 'query'; query: Query } | { kind: 'command'; command: Command }

const demoBaseQuery: BaseQueryFn<DemoRequest, unknown, ApiError> = async (request, api) => {
  const userId = (api.getState() as { session: { userId: string | null } }).session.userId
  try {
    return {
      data:
        request.kind === 'command'
          ? await commandDemo(request.command, userId)
          : await queryDemo(request.query, userId),
    }
  } catch (error) {
    return {
      error: {
        status: 'DEMO_ERROR',
        data: error instanceof Error ? error.message : 'The demo operation failed.',
      },
    }
  }
}
export const admissionsApi = createApi({
  reducerPath: 'admissionsApi',
  baseQuery: demoBaseQuery,
  tagTypes: ['Dataset'],
  endpoints: (builder) => ({
    accounts: builder.query<Pick<User, 'id' | 'name' | 'email' | 'active' | 'roles'>[], void>({
      query: () => ({ kind: 'query', query: { op: 'accounts' } }),
      providesTags: ['Dataset'],
    }),
    me: builder.query<User, void>({
      query: () => ({ kind: 'query', query: { op: 'me' } }),
      providesTags: ['Dataset'],
    }),
    applications: builder.query<Application[], string>({
      query: (programmeId) => ({ kind: 'query', query: { op: 'applications', programmeId } }),
      providesTags: ['Dataset'],
    }),
    batches: builder.query<BatchSummary[], { programmeId: string; intakeYear: string }>({
      query: (scope) => ({ kind: 'query', query: { op: 'batches', ...scope } }),
      providesTags: ['Dataset'],
    }),
    batch: builder.query<BatchSummary, string>({
      query: (id) => ({ kind: 'query', query: { op: 'batch', id } }),
      providesTags: ['Dataset'],
    }),
    application: builder.query<
      { application: Application; documents: DocumentRecord[]; rubrics: Rubric[] },
      string
    >({
      query: (id) => ({ kind: 'query', query: { op: 'application', id } }),
      providesTags: ['Dataset'],
    }),
    programmeIntakes: builder.query<{ programmeId: string; years: string[] }[], void>({
      query: () => ({ kind: 'query', query: { op: 'programmeIntakes' } }),
      providesTags: ['Dataset'],
    }),
    programmes: builder.query<Programme[], void>({
      query: () => ({ kind: 'query', query: { op: 'programmes' } }),
      providesTags: ['Dataset'],
    }),
    rubrics: builder.query<{ rubrics: Rubric[]; activeId: string }, string>({
      query: (programmeId) => ({ kind: 'query', query: { op: 'rubrics', programmeId } }),
      providesTags: ['Dataset'],
    }),
    users: builder.query<User[], void>({
      query: () => ({ kind: 'query', query: { op: 'users' } }),
      providesTags: ['Dataset'],
    }),
    health: builder.query<DemoHealth, void>({
      query: () => ({ kind: 'query', query: { op: 'health' } }),
      providesTags: ['Dataset'],
    }),
    audit: builder.query<AuditEvent[], void>({
      query: () => ({ kind: 'query', query: { op: 'audit' } }),
      providesTags: ['Dataset'],
    }),
    command: builder.mutation<CommandResult, Command>({
      query: (args) => ({ kind: 'command', command: args }),
      invalidatesTags: ['Dataset'],
    }),
  }),
})
export const {
  useAccountsQuery,
  useMeQuery,
  useApplicationsQuery,
  useBatchesQuery,
  useBatchQuery,
  useApplicationQuery,
  useProgrammesQuery,
  useProgrammeIntakesQuery,
  useRubricsQuery,
  useUsersQuery,
  useHealthQuery,
  useAuditQuery,
  useCommandMutation,
} = admissionsApi
export function errorMessage(error: unknown) {
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error === 'object' && error && 'data' in error && typeof error.data === 'string')
    return error.data
  return error instanceof Error ? error.message : 'The operation could not be completed.'
}
