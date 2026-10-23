// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - DIALOG CONTENT TEXT ||============================== //

export default function DialogContentText(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          color: theme.palette.text.primary,
        },
      },
    },
  }
}
