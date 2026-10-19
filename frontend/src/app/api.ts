import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type {
  Application,
  AuditEvent,
  DemoHealth,
  DocumentRecord,
  Programme,
  Rubric,
  User,
  WorkspaceDeletionImpact,
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
const demoBaseQuery: BaseQueryFn<Query | Command, unknown, ApiError> = async (args, api) => {
  const userId = (api.getState() as { session: { userId: string | null } }).session.userId
  try {
    const mutationOps = [
      'importBatch',
      'create',
      'evaluate',
      'correct',
      'decide',
      'rubric',
      'user',
      'workspace',
      'deleteWorkspace',
      'model',
      'delete',
      'backup',
      'restore',
      'reset',
    ]
    const isMutation =
      mutationOps.includes(args.op) || (args.op === 'programme' && 'programme' in args)
    return {
      data: isMutation
        ? await commandDemo(args as Command, userId)
        : await queryDemo(args as Query, userId),
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
      query: () => ({ op: 'accounts' }),
      providesTags: ['Dataset'],
    }),
    me: builder.query<User, void>({ query: () => ({ op: 'me' }), providesTags: ['Dataset'] }),
    applications: builder.query<Application[], string>({
      query: (programmeId) => ({ op: 'applications', programmeId }),
      providesTags: ['Dataset'],
    }),
    batches: builder.query<BatchSummary[], { programmeId: string; intakeYear: string }>({
      query: (scope) => ({ op: 'batches', ...scope }),
      providesTags: ['Dataset'],
    }),
    batch: builder.query<BatchSummary, string>({
      query: (id) => ({ op: 'batch', id }),
      providesTags: ['Dataset'],
    }),
    application: builder.query<
      { application: Application; documents: DocumentRecord[]; rubrics: Rubric[] },
      string
    >({ query: (id) => ({ op: 'application', id }), providesTags: ['Dataset'] }),
    programmes: builder.query<Programme[], void>({
      query: () => ({ op: 'programmes' }),
      providesTags: ['Dataset'],
    }),
    workspaceDeletion: builder.query<WorkspaceDeletionImpact, string>({
      query: (id) => ({ op: 'workspaceDeletion', id }),
      providesTags: ['Dataset'],
    }),
    rubrics: builder.query<{ rubrics: Rubric[]; activeId: string }, string>({
      query: (programmeId) => ({ op: 'rubrics', programmeId }),
      providesTags: ['Dataset'],
    }),
    users: builder.query<User[], void>({
      query: () => ({ op: 'users' }),
      providesTags: ['Dataset'],
    }),
    health: builder.query<DemoHealth, void>({
      query: () => ({ op: 'health' }),
      providesTags: ['Dataset'],
    }),
    audit: builder.query<AuditEvent[], void>({
      query: () => ({ op: 'audit' }),
      providesTags: ['Dataset'],
    }),
    command: builder.mutation<CommandResult, Command>({
      query: (args) => args,
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
  useWorkspaceDeletionQuery,
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
