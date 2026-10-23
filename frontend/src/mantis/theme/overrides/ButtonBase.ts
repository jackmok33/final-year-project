import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - BUTTON ||============================== //

export default function ButtonBase(): NonNullable<Theme['components']> {
  return {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          '&.MuiButtonBase-root:disabled': {
            cursor: 'not-allowed',
            pointerEvents: 'auto',
          },
        },
      },
    },
  }
}
