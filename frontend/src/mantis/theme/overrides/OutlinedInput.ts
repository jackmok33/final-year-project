// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import getColors from '../../utils/getColors'
import getShadow from '../../utils/getShadow'

// types
import { ColorProps } from '../../types'

interface Props {
  variant: ColorProps
  theme: Theme
}

// ==============================|| OVERRIDES - INPUT BORDER & SHADOWS ||============================== //

function getColor({ variant, theme }: Props) {
  const colors = getColors(theme, variant)
  // Workspace "light" colours are status backgrounds; use main for a visible
  // input boundary while retaining Mantis's focus ring and layout.
  const { main } = colors

  const shadows = getShadow(theme, `${variant}`)

  return {
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: main },
    '&.Mui-focused': {
      boxShadow: shadows,
      '& .MuiOutlinedInput-notchedOutline': { border: '1px solid', borderColor: main },
    },
  }
}

// ==============================|| OVERRIDES - OUTLINED INPUT ||============================== //

export default function OutlinedInput(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiOutlinedInput: {
      styleOverrides: {
        input: ({ ownerState }) => ({
          padding: ownerState.multiline
            ? 0
            : ownerState.size === 'small'
              ? '7.5px 8px 7.5px 12px'
              : '10.5px 14px 10.5px 12px',
        }),
        notchedOutline: {
          borderColor: theme.palette.grey[300],
          ...theme.applyStyles('dark', { borderColor: theme.palette.grey[200] }),
        },
        root: ({ ownerState }) => ({
          ...getColor({ variant: ownerState.color ?? 'primary', theme }),
          '&.Mui-error': getColor({ variant: 'error', theme }),
        }),
      },
    },
  }
}
