import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - INPUT BASE ||============================== //

export default function InputBase(): NonNullable<Theme['components']> {
  return {
    MuiInputBase: {
      styleOverrides: {
        sizeSmall: {
          fontSize: '0.75rem',
        },
      },
    },
  }
}
