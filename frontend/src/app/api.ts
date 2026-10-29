import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type { Command, CommandResult, Query, QueryResults } from '../services/contracts'
import { admissionsService } from '../services/admissions'
import { errorMessage } from '../services/errors'

export interface ApiError {
  status: string
  data: string
}
type ServiceRequest = { kind: 'query'; query: Query } | { kind: 'command'; command: Command }

const serviceBaseQuery: BaseQueryFn<ServiceRequest, unknown, ApiError> = async (request, api) => {
  const userId = (api.getState() as { session: { userId: string | null } }).session.userId
  try {
    return {
      data:
        request.kind === 'command'
          ? await admissionsService.command(request.command, userId)
          : await admissionsService.query(request.query, userId),
    }
  } catch (error) {
    return {
      error: {
        status: 'DEMO_ERROR',
        data: errorMessage(error, 'The demo operation failed.'),
      },
    }
  }
}
export const admissionsApi = createApi({
  reducerPath: 'admissionsApi',
  baseQuery: serviceBaseQuery,
  tagTypes: ['Dataset'],
  endpoints: (builder) => ({
    accounts: builder.query<QueryResults['accounts'], void>({
      query: () => ({ kind: 'query', query: { op: 'accounts' } }),
      providesTags: ['Dataset'],
    }),
    me: builder.query<QueryResults['me'], void>({
      query: () => ({ kind: 'query', query: { op: 'me' } }),
      providesTags: ['Dataset'],
    }),
    applications: builder.query<QueryResults['applications'], string>({
      query: (programmeId) => ({ kind: 'query', query: { op: 'applications', programmeId } }),
      providesTags: ['Dataset'],
    }),
    batches: builder.query<QueryResults['batches'], { programmeId: string; intakeYear: string }>({
      query: (scope) => ({ kind: 'query', query: { op: 'batches', ...scope } }),
      providesTags: ['Dataset'],
    }),
    batch: builder.query<QueryResults['batch'], string>({
      query: (id) => ({ kind: 'query', query: { op: 'batch', id } }),
      providesTags: ['Dataset'],
    }),
    application: builder.query<QueryResults['application'], string>({
      query: (id) => ({ kind: 'query', query: { op: 'application', id } }),
      providesTags: ['Dataset'],
    }),
    programmeIntakes: builder.query<QueryResults['programmeIntakes'], void>({
      query: () => ({ kind: 'query', query: { op: 'programmeIntakes' } }),
      providesTags: ['Dataset'],
    }),
    programmes: builder.query<QueryResults['programmes'], void>({
      query: () => ({ kind: 'query', query: { op: 'programmes' } }),
      providesTags: ['Dataset'],
    }),
    rubrics: builder.query<QueryResults['rubrics'], string>({
      query: (programmeId) => ({ kind: 'query', query: { op: 'rubrics', programmeId } }),
      providesTags: ['Dataset'],
    }),
    users: builder.query<QueryResults['users'], void>({
      query: () => ({ kind: 'query', query: { op: 'users' } }),
      providesTags: ['Dataset'],
    }),
    health: builder.query<QueryResults['health'], void>({
      query: () => ({ kind: 'query', query: { op: 'health' } }),
      providesTags: ['Dataset'],
    }),
    audit: builder.query<QueryResults['audit'], void>({
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
