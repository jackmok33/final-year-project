import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - FORM HELPER TEXT ||============================== //

export default function FormHelperText(): NonNullable<Theme['components']> {
  return {
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginTop: 4,
          marginLeft: 0,
        },
      },
    },
  }
}
