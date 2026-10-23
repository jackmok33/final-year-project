// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - INPUT LABEL ||============================== //

export default function InputLabel(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: theme.palette.grey[600],
        },
        outlined: {
          lineHeight: '1rem',
          top: -4,
          '&.MuiInputLabel-sizeSmall': {
            lineHeight: '1em',
          },
          '&.MuiInputLabel-shrink': {
            background: theme.palette.background.paper,
            padding: '0 8px',
            marginLeft: -6,
            top: 2,
            lineHeight: '1rem',
          },
        },
      },
    },
  }
}
