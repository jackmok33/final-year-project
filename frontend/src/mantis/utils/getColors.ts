// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import { Theme } from '@mui/material/styles'

// types
import { ColorProps } from '../types'

// ==============================|| CUSTOM FUNCTION - COLORS ||============================== //

export default function getColors(theme: Theme, color?: ColorProps) {
  switch (color!) {
    case 'secondary':
      return withFallback(theme.palette.secondary)
    case 'error':
      return withFallback(theme.palette.error)
    case 'warning':
      return withFallback(theme.palette.warning)
    case 'info':
      return withFallback(theme.palette.info)
    case 'success':
      return withFallback(theme.palette.success)
    default:
      return withFallback(theme.palette.primary)
  }
}

function withFallback(colour: Theme['palette']['primary']) {
  return {
    ...colour,
    lighter: colour.lighter ?? colour.light,
    darker: colour.darker ?? colour.dark,
  }
}
