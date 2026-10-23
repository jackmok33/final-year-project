import type { Theme } from '@mui/material/styles'
// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// ==============================|| OVERRIDES - LINK ||============================== //

export default function Link(): NonNullable<Theme['components']> {
  return {
    MuiLink: {
      defaultProps: {
        underline: 'hover',
      },
    },
  }
}
