// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'

// project imports
import { alpha as withAlpha } from '@mui/material/styles'
import getColors from '../../utils/getColors'
import getShadow from '../../utils/getShadow'

// types
import { ButtonVariantProps, ExtendedStyleProps } from '../../types'

// ==============================|| BUTTON - COLORS ||============================== //

interface ButtonStyleProps extends ExtendedStyleProps {
  variant: ButtonVariantProps
}

function getColorStyle({ variant, color, theme }: ButtonStyleProps) {
  const colors = getColors(theme, color)
  const { lighter, main, dark, darker, contrastText } = colors

  const buttonShadow = `${color}Button`
  const shadows = getShadow(theme, buttonShadow)

  const commonShadow = {
    '&::after': {
      boxShadow: `0 0 5px 5px ${withAlpha(main, 0.9)}`,
    },
    '&:active::after': {
      boxShadow: `0 0 0 0 ${withAlpha(main, 0.9)}`,
    },
    '&:focus-visible': {
      outline: `2px solid ${dark}`,
      outlineOffset: 2,
    },
  }

  switch (variant) {
    case 'contained':
      return {
        '&:hover': {
          backgroundColor: dark,
        },
        ...commonShadow,
      }
    case 'shadow':
      return {
        color: contrastText,
        backgroundColor: main,
        boxShadow: shadows,
        '&:hover': {
          boxShadow: 'none',
          backgroundColor: dark,
        },
        ...commonShadow,
      }
    case 'outlined':
      return {
        borderColor: main,
        '&:hover': {
          color: dark,
          backgroundColor: 'transparent',
          borderColor: dark,
        },
        ...commonShadow,
      }
    case 'dashed':
      return {
        color: main,
        borderColor: main,
        backgroundColor: lighter,
        '&:hover': {
          color: dark,
          borderColor: dark,
        },
        ...commonShadow,
      }
    case 'text':
    default:
      return {
        color: dark,
        '&:hover': {
          color: darker,
          backgroundColor: lighter,
        },
        ...commonShadow,
      }
  }
}

// ==============================|| OVERRIDES - BUTTON ||============================== //

export default function Button(theme: Theme): NonNullable<Theme['components']> {
  const primaryDashed = getColorStyle({ variant: 'dashed', color: 'primary', theme })
  const primaryShadow = getColorStyle({ variant: 'shadow', color: 'primary', theme })

  const disabledStyle = {
    backgroundColor: theme.palette.grey[200],
    '&:hover': {
      backgroundColor: theme.palette.grey[200],
    },
  }
  const iconStyle = {
    '&>*:nth-of-type(1)': {
      fontSize: 'inherit',
    },
  }

  return {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      variants: [
        ...(['contained', 'outlined', 'text'] as const).flatMap((variant) =>
          (['primary', 'secondary', 'error', 'success', 'info', 'warning'] as const).map(
            (color) => ({
              props: { variant, color },
              style: getColorStyle({ variant, color, theme }),
            }),
          ),
        ),
        {
          props: { variant: 'dashed' },
          style: {
            border: '1px dashed',
            ...primaryDashed,
            '&.MuiButton-colorPrimary': getColorStyle({
              variant: 'dashed',
              color: 'primary',
              theme,
            }),
            '&.MuiButton-colorSecondary': getColorStyle({
              variant: 'dashed',
              color: 'secondary',
              theme,
            }),
            '&.MuiButton-colorError': getColorStyle({ variant: 'dashed', color: 'error', theme }),
            '&.MuiButton-colorSuccess': getColorStyle({
              variant: 'dashed',
              color: 'success',
              theme,
            }),
            '&.MuiButton-colorInfo': getColorStyle({ variant: 'dashed', color: 'info', theme }),
            '&.MuiButton-colorWarning': getColorStyle({
              variant: 'dashed',
              color: 'warning',
              theme,
            }),
            '&.Mui-disabled': {
              color: `${theme.palette.grey[300]} !important`,
              borderColor: `${theme.palette.grey[400]} !important`,
              backgroundColor: `${theme.palette.grey[200]} !important`,
            },
          },
        },
        {
          props: { variant: 'shadow' },
          style: {
            ...primaryShadow,
            '&.MuiButton-colorPrimary': getColorStyle({
              variant: 'shadow',
              color: 'primary',
              theme,
            }),
            '&.MuiButton-colorSecondary': getColorStyle({
              variant: 'shadow',
              color: 'secondary',
              theme,
            }),
            '&.MuiButton-colorError': getColorStyle({ variant: 'shadow', color: 'error', theme }),
            '&.MuiButton-colorSuccess': getColorStyle({
              variant: 'shadow',
              color: 'success',
              theme,
            }),
            '&.MuiButton-colorInfo': getColorStyle({ variant: 'shadow', color: 'info', theme }),
            '&.MuiButton-colorWarning': getColorStyle({
              variant: 'shadow',
              color: 'warning',
              theme,
            }),
            '&.Mui-disabled': {
              color: `${theme.palette.grey[300]} !important`,
              borderColor: `${theme.palette.grey[400]} !important`,
              backgroundColor: `${theme.palette.grey[200]} !important`,
            },
          },
        },
        {
          props: { size: 'extraSmall' },
          style: {
            minWidth: 56,
            fontSize: '0.625rem',
            padding: '2px 8px',
          },
        },
      ],
      styleOverrides: {
        root: {
          fontWeight: 400,
          '&::after': {
            content: '""',
            display: 'block',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            borderRadius: 4,
            opacity: 0,
            transition: 'all 0.5s',
          },

          '&:active::after': {
            position: 'absolute',
            borderRadius: 4,
            left: 0,
            top: 0,
            opacity: 1,
            transition: '0s',
          },
        },
        contained: {
          '&.Mui-disabled': {
            ...disabledStyle,
          },
        },
        outlined: {
          '&.Mui-disabled': {
            ...disabledStyle,
            '&:hover': {
              backgroundColor: theme.palette.grey[200],
              color: `${theme.palette.grey[300]} !important`,
              borderColor: 'inherit',
            },
          },
        },
        text: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        endIcon: {
          ...iconStyle,
        },
        startIcon: {
          ...iconStyle,
        },
        loading: {
          pointerEvents: 'none',
          '& svg': {
            width: 'inherit',
            height: 'inherit',
          },
          '&.MuiButton-loadingPositionCenter': {
            color: 'transparent !important',
          },
        },
      },
    },
  }
}
