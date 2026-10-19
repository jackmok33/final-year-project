import { Box, Paper } from '@mui/material'
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
    navigate(account.roles.includes('tutor') ? '/modules' : '/admin/health')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: 5,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 2,
          boxShadow: '0 2px 8px rgb(0 0 0 / 3%)',
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
      </Paper>
    </Box>
  )
}
