import { useContent } from '../../hooks/useContent'
import { Stack, Typography } from '@mui/material'

export function SignInIntro() {
  const content = useContent('signInIntro')
  return (
    <Stack
      spacing={2}
      sx={{ bgcolor: '#361A54', color: '#FFF', p: { xs: 4, md: 8 }, justifyContent: 'center' }}
    >
      <Typography variant="h3" component="p" sx={{ fontWeight: 800 }}>
        {content.ucl}
      </Typography>
      <Typography variant="h3" component="h1" sx={{ maxWidth: 500 }}>
        {content.applicationReviewWorkspace}
      </Typography>
    </Stack>
  )
}
