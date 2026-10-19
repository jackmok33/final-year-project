import { useContent } from '../../hooks/useContent'
import { Stack, Typography } from '@mui/material'
import { UclLogo } from '../UclLogo'

export function SignInIntro() {
  const content = useContent('signInIntro')
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        p: { xs: 3, sm: 4 },
        pb: 2,
        alignItems: 'center',
        textAlign: { xs: 'center', sm: 'left' },
      }}
    >
      <UclLogo />
      <Typography variant="h5" component="h1">
        {content.applicationReviewWorkspace}
      </Typography>
    </Stack>
  )
}
