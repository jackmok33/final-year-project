// Adapted from the supplied Mantis 4.0.1 template.
import type { Theme } from '@mui/material/styles'
// ==============================|| OVERRIDES - PAGINATION ||============================== //

export default function Pagination(): NonNullable<Theme['components']> {
  return {
    MuiPagination: {
      defaultProps: {
        shape: 'rounded',
      },
      styleOverrides: { ul: { rowGap: 6 } },
    },
  }
}
