import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - TYPOGRAPHY ||============================== //

export default function Typography(): NonNullable<Theme['components']> {
  return {
    MuiTypography: {
      styleOverrides: {
        gutterBottom: {
          marginBottom: 12,
        },
      },
    },
  }
}
