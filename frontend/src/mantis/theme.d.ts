import type {} from '@mui/material/themeCssVarsAugmentation'
import type { CustomShadows } from './types'

// Mantis palette/shadow extensions, scoped to the imported template features.
declare module '@mui/material/styles' {
  interface Color {
    0: string
    A50: string
    A800: string
  }
  interface PaletteColor {
    lighter: string
    darker: string
    [shade: number]: string
  }
  interface SimplePaletteColorOptions {
    lighter?: string
    darker?: string
    [shade: number]: string
    A100?: string
    A200?: string
    A300?: string
  }
  interface Theme {
    customShadows: CustomShadows
  }
  interface ThemeOptions {
    customShadows?: CustomShadows
  }
  interface ThemeVars {
    customShadows: CustomShadows
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsVariantOverrides {
    light: true
    combined: true
  }
  interface ChipPropsSizeOverrides {
    large: true
  }
}

declare module '@mui/material/Alert' {
  interface AlertPropsVariantOverrides {
    border: true
  }
}

declare module '@mui/material/Checkbox' {
  interface CheckboxPropsSizeOverrides {
    large: true
  }
}

declare module '@mui/material/Switch' {
  interface SwitchPropsSizeOverrides {
    large: true
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    dashed: true
    shadow: true
  }
  interface ButtonPropsSizeOverrides {
    extraSmall: true
  }
}
