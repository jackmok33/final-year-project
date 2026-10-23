import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - LINER PROGRESS ||============================== //

export default function LinearProgress(): NonNullable<Theme['components']> {
  return {
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: 100,
        },
        bar: {
          borderRadius: 100,
        },
      },
    },
  }
}
