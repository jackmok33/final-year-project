// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - TABLE ROW ||============================== //

export default function TableBody(theme: Theme): NonNullable<Theme['components']> {
  const hoverStyle = {
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  }

  return {
    MuiTableBody: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.background.paper,
          '& .MuiTableRow-root': {
            ...hoverStyle,
          },
        },
      },
    },
  }
}
