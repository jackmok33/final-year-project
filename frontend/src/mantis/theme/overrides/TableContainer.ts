import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - TABLE CONTAINER ||============================== //

export default function TableContainer(): NonNullable<Theme['components']> {
  return {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
  }
}
