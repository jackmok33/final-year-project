// Adapted from the supplied Mantis 4.0.1 template.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import { alpha } from '@mui/material/styles'

// ==============================|| OVERRIDES - TAB ||============================== //

export default function Tab(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 46,
          color: theme.palette.text.primary,
          borderRadius: 4,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.light, 0.6),
            color: theme.palette.primary.main,
          },
          '&:focus-visible': {
            borderRadius: 4,
            outline: `2px solid ${theme.palette.secondary.dark}`,
            outlineOffset: -3,
          },
        },
      },
    },
  }
}
