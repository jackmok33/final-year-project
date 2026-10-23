// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import { Theme } from '@mui/material/styles'

// ==============================|| CUSTOM FUNCTION - COLOR SHADOWS ||============================== //

export default function getShadow(theme: Theme, shadow: string) {
  if (!theme.customShadows) return theme.shadows[1]

  switch (shadow) {
    case 'secondary':
      return theme.customShadows.secondary
    case 'error':
      return theme.customShadows.error
    case 'warning':
      return theme.customShadows.warning
    case 'info':
      return theme.customShadows.info
    case 'success':
      return theme.customShadows.success
    case 'primaryButton':
      return theme.customShadows.primaryButton
    case 'secondaryButton':
      return theme.customShadows.secondaryButton
    case 'errorButton':
      return theme.customShadows.errorButton
    case 'warningButton':
      return theme.customShadows.warningButton
    case 'infoButton':
      return theme.customShadows.infoButton
    case 'successButton':
      return theme.customShadows.successButton
    default:
      return theme.customShadows.primary
  }
}
