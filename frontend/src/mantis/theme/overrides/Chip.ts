// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import getColors from '../../utils/getColors'

// types
import { ExtendedStyleProps } from '../../types'

// ==============================|| CHIP - COLORS ||============================== //

function getColor({ color, theme }: ExtendedStyleProps) {
  const colors = getColors(theme, color)
  const { dark } = colors

  return {
    '&.Mui-focusVisible': {
      outline: `2px solid ${dark}`,
      outlineOffset: 2,
    },
  }
}

function getColorStyle({ color, theme }: ExtendedStyleProps) {
  const colors = getColors(theme, color)
  const { light, lighter, main, darker } = colors

  return {
    color: main,
    backgroundColor: lighter,
    borderColor: light,
    ...theme.applyStyles('dark', { color: darker }),
    '& .MuiChip-deleteIcon': {
      color: main,
      '&:hover': {
        color: light,
      },
    },
  }
}

// ==============================|| OVERRIDES - CHIP ||============================== //

export default function Chip(theme: Theme): NonNullable<Theme['components']> {
  const defaultLightChip = getColorStyle({ color: 'secondary', theme })
  return {
    MuiChip: {
      variants: [
        {
          props: { size: 'large' },
          style: {
            fontSize: '1rem',
            height: 40,
          },
        },
        {
          props: { variant: 'light' },
          style: {
            ...defaultLightChip,
            '&.MuiChip-colorPrimary': getColorStyle({ color: 'primary', theme }),
            '&.MuiChip-colorSecondary': getColorStyle({ color: 'secondary', theme }),
            '&.MuiChip-colorError': getColorStyle({ color: 'error', theme }),
            '&.MuiChip-colorInfo': getColorStyle({ color: 'info', theme }),
            '&.MuiChip-colorSuccess': getColorStyle({ color: 'success', theme }),
            '&.MuiChip-colorWarning': getColorStyle({ color: 'warning', theme }),
          },
        },
        {
          props: { variant: 'combined' },
          style: {
            border: '1px solid',
            ...defaultLightChip,
            '&.MuiChip-colorPrimary': getColorStyle({ color: 'primary', theme }),
            '&.MuiChip-colorSecondary': getColorStyle({ color: 'secondary', theme }),
            '&.MuiChip-colorError': getColorStyle({ color: 'error', theme }),
            '&.MuiChip-colorInfo': getColorStyle({ color: 'info', theme }),
            '&.MuiChip-colorSuccess': getColorStyle({ color: 'success', theme }),
            '&.MuiChip-colorWarning': getColorStyle({ color: 'warning', theme }),
          },
        },
      ],
      styleOverrides: {
        root: {
          borderRadius: 4,
          '&:active': {
            boxShadow: 'none',
          },
          '&.MuiChip-colorPrimary': getColor({ color: 'primary', theme }),
          '&.MuiChip-colorSecondary': getColor({ color: 'secondary', theme }),
          '&.MuiChip-colorError': getColor({ color: 'error', theme }),
          '&.MuiChip-colorInfo': getColor({ color: 'info', theme }),
          '&.MuiChip-colorSuccess': getColor({ color: 'success', theme }),
          '&.MuiChip-colorWarning': getColor({ color: 'warning', theme }),
        },
      },
    },
  }
}
