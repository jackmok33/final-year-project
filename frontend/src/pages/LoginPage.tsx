import { Box, Button, Link, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { admissionsApi } from '../app/api'
import { signIn } from '../app/store'
import { useAppDispatch } from '../hooks/redux'
import { DemoSignIn } from '../components/auth/DemoSignIn'
import { SignInIntro } from '../components/auth/SignInIntro'
import AuthCard from '../mantis/components/AuthCard'
import CustomizedDialog from '../mantis/components/CustomizedDialog'
import { PROGRAMMES_PATH } from '../app/paths'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import { authenticateBackend } from '../services/httpAdmissions'
import { errorMessage } from '../services/errors'
import { saveBackendSession } from '../services/backendSession'

export function LoginPage() {
  const content = useContent('loginPage')
  const [isLoading, setIsLoading] = useState(false)
  const isMounted = useIsMounted()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [help, setHelp] = useState<'accounts' | 'password' | 'about' | 'terms'>()
  const [loginError, setLoginError] = useState('')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  async function login() {
    if (isLoading) return
    setIsLoading(true)
    setLoginError('')
    try {
      const account = await authenticateBackend(email, password)
      if (!isMounted()) return
      saveBackendSession(account.id, password)
      setPassword('')
      dispatch(admissionsApi.util.resetApiState())
      dispatch(signIn(account.id))
      navigate(account.roles.includes('tutor') ? PROGRAMMES_PATH : '/admin/users')
    } catch (error) {
      if (isMounted()) setLoginError(errorMessage(error, content.invalidAccount))
    } finally {
      if (isMounted()) setIsLoading(false)
    }
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
            disabled={isLoading}
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
            error={loginError}
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
        <Button onClick={() => setHelp(undefined)} sx={{ mt: 2 }}>
          {content.close}
        </Button>
      </CustomizedDialog>
    </Box>
  )
}
