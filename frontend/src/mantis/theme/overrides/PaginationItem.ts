// Adapted from Mantis 4.0.1 themes/overrides/PaginationItem.ts; this workspace uses its outlined variant.
import type { Theme } from '@mui/material/styles'
import getColors from '../../utils/getColors'

export default function PaginationItem(theme: Theme): NonNullable<Theme['components']> {
  const primary = getColors(theme, 'primary')
  return {
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.secondary.dark}`,
            outlineOffset: 2,
          },
        },
        outlined: {
          borderColor: theme.palette.divider,
          '&.Mui-selected': {
            backgroundColor: 'transparent',
            color: primary.main,
            borderColor: primary.main,
            '&:hover': { backgroundColor: primary.lighter, borderColor: primary.light },
          },
        },
      },
    },
  }
}
