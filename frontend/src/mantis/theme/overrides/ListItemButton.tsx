// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - LIST ITEM ICON ||============================== //

export default function ListItemButton(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: theme.palette.primary.main,
            ...theme.applyStyles('dark', { color: theme.palette.primary.darker }),
            '& .MuiListItemIcon-root': {
              color: theme.palette.primary.main,
            },
          },
        },
      },
    },
  }
}
