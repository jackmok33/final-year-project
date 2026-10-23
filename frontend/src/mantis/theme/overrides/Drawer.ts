import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - DRAWER ||============================== //

export default function Drawer(): NonNullable<Theme['components']> {
  return {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  }
}
