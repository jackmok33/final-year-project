// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import { alpha as withAlpha } from '@mui/material/styles'

// ==============================|| OVERRIDES - DIALOG ||============================== //

export default function Dialog(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiDialog: {
      styleOverrides: {
        root: {
          '& .MuiBackdrop-root': {
            backgroundColor: withAlpha(theme.palette.common.black, 0.7),
          },
        },
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  }
}
