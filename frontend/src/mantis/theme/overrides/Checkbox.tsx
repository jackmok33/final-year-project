// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import type { Theme } from '@mui/material/styles'
import { CheckboxProps } from '@mui/material/Checkbox'

// project imports
import getColors from '../../utils/getColors'

// assets
import BorderOutlined from '@ant-design/icons/BorderOutlined'
import CheckSquareFilled from '@ant-design/icons/CheckSquareFilled'
import MinusSquareFilled from '@ant-design/icons/MinusSquareFilled'

// types
import { ExtendedStyleProps } from '../../types'

// ==============================|| RADIO - COLORS ||============================== //

function getColorStyle({ color, theme }: ExtendedStyleProps) {
  const colors = getColors(theme, color)
  const { lighter, main, dark } = colors

  return {
    '&:hover': {
      backgroundColor: lighter,
      '& .icon': {
        borderColor: main,
      },
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${dark}`,
      outlineOffset: -4,
    },
  }
}

// ==============================|| CHECKBOX - SIZE STYLE ||============================== //

interface CheckboxSizeProps {
  fontSize: number
}

function getSizeStyle(size?: CheckboxProps['size']): CheckboxSizeProps {
  switch (size) {
    case 'small':
      return { fontSize: 1.15 }
    case 'large':
      return { fontSize: 1.6 }
    case 'medium':
    default:
      return { fontSize: 1.35 }
  }
}

// ==============================|| CHECKBOX - STYLE ||============================== //

function checkboxStyle(size?: CheckboxProps['size']) {
  const sizes: CheckboxSizeProps = getSizeStyle(size)

  return {
    '& .icon': {
      fontSize: `${sizes.fontSize}rem`,
    },
  }
}

// ==============================|| OVERRIDES - CHECKBOX ||============================== //

export default function Checkbox(theme: Theme): NonNullable<Theme['components']> {
  const { palette } = theme

  return {
    MuiCheckbox: {
      defaultProps: {
        className: 'size-small',
        icon: <BorderOutlined aria-hidden="true" className="icon" />,
        checkedIcon: <CheckSquareFilled aria-hidden="true" className="icon" />,
        indeterminateIcon: <MinusSquareFilled aria-hidden="true" className="icon" />,
      },
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...getColorStyle({ color: ownerState.color, theme }),
          borderRadius: 0,
          color: palette.secondary[300],
          '&.size-small': {
            ...checkboxStyle('small'),
          },
          '&.size-medium': {
            ...checkboxStyle('medium'),
          },
          '&.size-large': {
            ...checkboxStyle('large'),
          },
        }),
      },
    },
  }
}
