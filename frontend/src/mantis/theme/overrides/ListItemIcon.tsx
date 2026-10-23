// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - LIST ITEM ICON ||============================== //

export default function ListItemIcon(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 24,
          color: theme.palette.text.primary,
        },
      },
    },
  }
}
