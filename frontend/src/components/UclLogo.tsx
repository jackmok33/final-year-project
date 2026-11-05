import { Box } from '@mui/material'
import logo from '../assets/ucl-logo.png'
import { useContent } from '../hooks/useContent'

export function UclLogo() {
  const content = useContent('branding')
  return (
    <Box
      component="img"
      src={logo}
      alt={content.institution}
      width={400}
      height={112}
      sx={{
        display: 'block',
        width: 128,
        height: 'auto',
        p: 0.75,
        boxSizing: 'content-box',
        bgcolor: 'common.white',
        flexShrink: 0,
      }}
    />
  )
}
