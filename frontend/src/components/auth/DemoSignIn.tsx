// Controlled adaptation of the supplied Mantis AuthLogin form.
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import EyeInvisibleOutlined from '@ant-design/icons/EyeInvisibleOutlined'
import { Box, Button, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material'
import IconButton from '../../mantis/components/IconButton'
import { ErrorNotice, Loading } from '../common'
import { useContent } from '../../hooks/useContent'

export function DemoSignIn({
  email,
  password,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onHelp,
  error,
  isLoading,
  login,
  disabled,
}: {
  email: string
  password: string
  showPassword: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onHelp: (kind: 'accounts' | 'password') => void
  error: unknown
  isLoading: boolean
  login: () => void
  disabled: boolean
}) {
  const content = useContent('demoSignIn')
  return (
    <Stack spacing={4}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" component="h2">
          {content.signIn}
        </Typography>
        <Link component="button" type="button" onClick={() => onHelp('accounts')} underline="none">
          {content.noAccount}
        </Link>
      </Stack>
      <ErrorNotice error={error} />
      {isLoading ? (
        <Loading />
      ) : (
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault()
            login()
          }}
        >
          <Stack spacing={2.5}>
            <TextField
              type="email"
              required
              placeholder={content.emailPlaceholder}
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="username"
              slotProps={{ htmlInput: { 'aria-label': content.email } }}
            />
            <TextField
              type={showPassword ? 'text' : 'password'}
              required
              placeholder={content.passwordPlaceholder}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              slotProps={{
                htmlInput: { 'aria-label': content.password },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? content.hidePassword : content.showPassword}
                        onClick={onTogglePassword}
                        color="secondary"
                        size="small"
                      >
                        {showPassword ? (
                          <EyeOutlined aria-hidden="true" />
                        ) : (
                          <EyeInvisibleOutlined aria-hidden="true" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button variant="contained" type="submit" fullWidth disabled={disabled}>
              {content.signInAction}
            </Button>
            <Link
              component="button"
              type="button"
              underline="none"
              color="text.primary"
              onClick={() => onHelp('password')}
              sx={{ alignSelf: 'flex-start' }}
            >
              {content.forgotPassword}
            </Link>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}
