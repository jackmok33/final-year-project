// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - ALERT TITLE ||============================== //

export default function AccordionDetails(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: theme.spacing(2),
          borderTop: '1px solid',
          borderTopColor: theme.palette.secondary.light,
        },
      },
    },
  }
}
