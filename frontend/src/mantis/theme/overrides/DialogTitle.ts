import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - DIALOG TITLE ||============================== //

export default function DialogTitle(): NonNullable<Theme['components']> {
  return {
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 500,
        },
      },
    },
  }
}
