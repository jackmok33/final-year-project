// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// ==============================|| OVERRIDES - ALERT TITLE ||============================== //

export default function Accordion(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        square: true,
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid',
          borderColor: theme.palette.secondary.light,
          '&:not(:last-child)': {
            borderBottom: 0,
          },
          '&:before': {
            display: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: theme.palette.secondary.lighter,
          },
        },
      },
    },
  }
}
