import { Box } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { admissionsApi, useAccountsQuery } from '../app/api'
import { signIn, useAppDispatch } from '../app/store'
import { DemoSignIn } from '../components/auth/DemoSignIn'
import { SignInIntro } from '../components/auth/SignInIntro'
export function LoginPage() {
  const { data: accounts, error, isLoading } = useAccountsQuery()
  const [selected, setSelected] = useState('tutor-a')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const account =
    accounts?.find((a) => a.id === selected && a.active) ?? accounts?.find((a) => a.active)
  function login() {
    if (!account?.active) return
    dispatch(admissionsApi.util.resetApiState())
    dispatch(signIn(account.id))
    navigate(account.roles.includes('tutor') ? '/applications' : '/admin/health')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      }}
    >
      <SignInIntro />
      <DemoSignIn
        accounts={accounts}
        account={account}
        error={error}
        isLoading={isLoading}
        setSelected={setSelected}
        login={login}
      />
    </Box>
  )
}
