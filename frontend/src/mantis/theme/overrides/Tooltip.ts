// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - TOOLTIP ||============================== //

export default function Tooltip(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          color: theme.palette.background.paper,
        },
      },
    },
  }
}
