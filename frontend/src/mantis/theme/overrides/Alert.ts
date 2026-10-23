// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import { alpha as withAlpha } from '@mui/material/styles'
import getColors from '../../utils/getColors'

// types
import { ExtendedStyleProps } from '../../types'

// ==============================|| ALERT - COLORS ||============================== //

function getColorStyle({ color, theme }: ExtendedStyleProps) {
  const colors = getColors(theme, color)
  const { lighter, light, main } = colors

  return {
    borderColor: withAlpha(light, 0.5),
    backgroundColor: lighter,
    '& .MuiAlert-icon': { color: main },
  }
}

// ==============================|| OVERRIDES - ALERT ||============================== //

export default function Alert(theme: Theme): NonNullable<Theme['components']> {
  return {
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const colour = ownerState.color ?? ownerState.severity ?? 'info'
          const paletteColor = getColors(theme, colour)
          return {
            color: theme.palette.text.primary,
            fontSize: '0.875rem',
            ...(ownerState.variant === 'standard' && {
              position: 'relative',
              backgroundColor: paletteColor.lighter,
              '& .MuiAlert-icon': { color: paletteColor.main },
            }),
            ...(ownerState.variant === 'filled' && {
              color: theme.palette.grey[0],
              backgroundColor: paletteColor.main,
            }),
            ...(ownerState.variant === 'border' && {
              padding: '10px 16px',
              border: '1px solid',
              ...getColorStyle({ color: colour, theme }),
            }),
          }
        },
        icon: {
          fontSize: '1rem',
        },
        message: {
          padding: 0,
          marginTop: 3,
        },

        action: {
          '& .MuiButton-root': {
            padding: 2,
            height: 'auto',
            fontSize: '0.75rem',
            marginTop: -2,
          },
          '& .MuiIconButton-root': {
            width: 'auto',
            height: 'auto',
            padding: 2,
            marginRight: 6,
            '& .MuiSvgIcon-root': {
              fontSize: '1rem',
            },
          },
        },
      },
    },
  }
}
