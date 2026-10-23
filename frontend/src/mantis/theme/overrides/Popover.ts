// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - DIALOG CONTENT TEXT ||============================== //

export default function Popover(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiPopover: {
      styleOverrides: {
        paper: {
          boxShadow: theme.customShadows.z1,
        },
      },
    },
  }
}
