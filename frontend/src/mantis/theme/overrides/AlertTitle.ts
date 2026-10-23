import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - ALERT TITLE ||============================== //

export default function AlertTitle(): NonNullable<Theme['components']> {
  return {
    MuiAlertTitle: {
      styleOverrides: {
        root: {
          marginBottom: 4,
          marginTop: 0,
          fontWeight: 400,
        },
      },
    },
  }
}
