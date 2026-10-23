import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - TABLE ROW ||============================== //

export default function TableRow(): NonNullable<Theme['components']> {
  return {
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-of-type': {
            '& .MuiTableCell-root': {
              borderBottom: 'none',
            },
          },
          '& .MuiTableCell-root': {
            '&:last-of-type': {
              paddingRight: 24,
            },
            '&:first-of-type': {
              paddingLeft: 24,
            },
          },
        },
      },
    },
  }
}
