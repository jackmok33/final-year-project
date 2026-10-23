// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - ICON BUTTON ||============================== //

export default function IconButton(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          '&.MuiIconButton-loading': {
            pointerEvents: 'none',
            '& svg': {
              width: 'inherit !important',
              height: 'inherit !important',
            },
          },
        },
        sizeLarge: {
          width: theme.spacing(5.5),
          height: theme.spacing(5.5),
          fontSize: '1.25rem',
        },
        sizeMedium: {
          width: theme.spacing(4.5),
          height: theme.spacing(4.5),
          fontSize: '1rem',
        },
        sizeSmall: {
          width: theme.spacing(3.75),
          height: theme.spacing(3.75),
          fontSize: '0.75rem',
        },
      },
    },
  }
}
