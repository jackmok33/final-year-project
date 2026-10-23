// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - TABLE CELL ||============================== //

export default function TableHead(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.grey[50],
          borderTop: '1px solid',
          borderTopColor: theme.palette.divider,
          borderBottom: '2px solid',
          borderBottomColor: theme.palette.divider,
        },
      },
    },
  }
}
