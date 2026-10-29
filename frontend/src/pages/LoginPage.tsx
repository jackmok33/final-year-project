import {
  Box,
  Button,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { admissionsApi, useAccountsQuery } from '../app/api'
import { signIn } from '../app/store'
import { useAppDispatch } from '../hooks/redux'
import { DemoSignIn } from '../components/auth/DemoSignIn'
import { SignInIntro } from '../components/auth/SignInIntro'
import AuthCard from '../mantis/components/AuthCard'
import CustomizedDialog from '../mantis/components/CustomizedDialog'
import { useContent } from '../hooks/useContent'

export function LoginPage() {
  const content = useContent('loginPage')
  const { data: accounts, error, isLoading } = useAccountsQuery()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [help, setHelp] = useState<'accounts' | 'password' | 'about' | 'terms'>()
  const [loginError, setLoginError] = useState('')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  function login() {
    const account = accounts?.find(
      (account) => account.active && account.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!account) {
      setLoginError(content.invalidAccount)
      return
    }
    dispatch(admissionsApi.util.resetApiState())
    dispatch(signIn(account.id))
    navigate(account.roles.includes('tutor') ? '/modules' : '/admin/health')
  }
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <SignInIntro />
      </Box>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, py: 5 }}>
        <AuthCard sx={{ width: '100%', maxWidth: 475 }}>
          <DemoSignIn
            disabled={!accounts?.some((account) => account.active)}
            email={email}
            password={password}
            showPassword={showPassword}
            onEmailChange={(value) => {
              setEmail(value)
              setLoginError('')
            }}
            onPasswordChange={setPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onHelp={setHelp}
            error={error ?? loginError}
            isLoading={isLoading}
            login={login}
          />
        </AuthCard>
      </Box>
      <Stack
        component="footer"
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', gap: 2, px: { xs: 3, md: 10 }, py: 2.5 }}
      >
        <Typography variant="body2" color="text.secondary">
          {content.copyright}
        </Typography>
        <Stack direction="row" spacing={3}>
          <Link component="button" color="text.secondary" onClick={() => setHelp('terms')}>
            {content.terms}
          </Link>
          <Link component="button" color="text.secondary" onClick={() => setHelp('about')}>
            {content.about}
          </Link>
        </Stack>
      </Stack>
      <CustomizedDialog
        open={!!help}
        onClose={() => setHelp(undefined)}
        closeLabel={content.closeHelp}
        title={
          help === 'password'
            ? content.passwordTitle
            : help === 'about'
              ? content.about
              : help === 'terms'
                ? content.terms
                : content.accountsTitle
        }
      >
        <Typography>
          {help === 'password'
            ? content.passwordDescription
            : help === 'about'
              ? content.aboutDescription
              : help === 'terms'
                ? content.termsDescription
                : content.accountsDescription}
        </Typography>
        {(help === 'accounts' || help === 'password') && (
          <List>
            {accounts
              ?.filter((account) => account.active)
              .map((account) => (
                <ListItem key={account.id} disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setEmail(account.email)
                      setPassword('demo')
                      setHelp(undefined)
                      setLoginError('')
                    }}
                  >
                    <ListItemText primary={account.name} secondary={account.email} />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        )}
        <Button onClick={() => setHelp(undefined)} sx={{ mt: 2 }}>
          {content.close}
        </Button>
      </CustomizedDialog>
    </Box>
  )
}
