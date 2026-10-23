import { Button, Stack } from '@mui/material'
import { Navigate, Outlet } from 'react-router-dom'
import { admissionsApi, useMeQuery } from '../../app/api'
import { signOut } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { useContent } from '../../hooks/useContent'
import { ErrorNotice, Loading } from '../common'

export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const id = useAppSelector((s) => s.session.userId)
  const {
    data: user,
    error,
    isLoading,
  } = useMeQuery(undefined, { skip: !id, pollingInterval: 4000 })
  if (!id) return <Navigate to="/login" replace />
  if (isLoading) return <Loading />
  if (error || !user) return <SessionError error={error} />
  if (!(admin ? user.roles.includes('admin') : user.roles.includes('tutor')))
    return <Navigate to={user.roles.includes('admin') ? '/admin/health' : '/modules'} replace />
  return <Outlet />
}

function SessionError({ error }: { error: unknown }) {
  const content = useContent('protectedRoute')
  const dispatch = useAppDispatch()
  return (
    <Stack spacing={2} sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
      <ErrorNotice error={error} />
      <Button
        onClick={() => {
          dispatch(signOut())
          dispatch(admissionsApi.util.resetApiState())
        }}
      >
        {content.returnToDemoSignIn}
      </Button>
    </Stack>
  )
}
