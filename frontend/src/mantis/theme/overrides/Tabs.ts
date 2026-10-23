// Adapted from the supplied Mantis 4.0.1 template.
import type { Theme } from '@mui/material/styles'
// ==============================|| OVERRIDES - TABS ||============================== //

export default function Tabs(): NonNullable<Theme['components']> {
  return {
    MuiTabs: {
      styleOverrides: {
        vertical: {
          overflow: 'visible',
        },
      },
    },
  }
}
