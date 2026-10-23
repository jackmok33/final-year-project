import { createTheme, type Theme } from '@mui/material/styles'
import { deepmerge } from '@mui/utils'
import buildPalette from '../mantis/theme/palette'
import Typography from '../mantis/theme/typography'
import CustomShadows from '../mantis/theme/customShadows'
import componentsOverride from '../mantis/theme/overrides'
import { DRAWER_WIDTH, HEADER_HEIGHT } from '../mantis/config'

// Use the supplied Mantis theme factories, then apply workspace accessibility defaults.
// The darker action blue retains AA contrast for small white button labels.
const primary = '#0958D9'
export const sidebarWidth = DRAWER_WIDTH
export const headerHeight = HEADER_HEIGHT

const palette = deepmerge(buildPalette(), {
  primary: { main: primary, light: '#E6F4FF', dark: '#003EB3', contrastText: '#FFFFFF' },
  secondary: { main: '#595959', light: '#F5F5F5', dark: '#262626' },
  background: { default: '#FAFAFB', paper: '#FFFFFF' },
  text: { primary: '#262626', secondary: '#595959' },
  divider: '#E6EBF1',
  success: { main: '#237804', light: '#F6FFED', dark: '#135200' },
  warning: { main: '#874D00', light: '#FFFBE6', dark: '#613400' },
  error: { main: '#C62828', light: '#FFF1F0', dark: '#8E1B1B' },
  info: { main: primary, light: '#E6F4FF', dark: '#003EB3' },
  action: { hover: '#FAFAFB', selected: '#E6F4FF' },
})

export const theme = createTheme({
  cssVariables: { cssVarPrefix: 'ucl' },
  palette,
  customShadows: CustomShadows(createTheme({ palette }).palette, 'light'),
  typography: {
    ...Typography('"Public Sans", Arial, sans-serif'),
    fontSize: 14,
    fontWeightBold: 600,
    button: { textTransform: 'none', fontWeight: 500 },
  },
  mixins: { toolbar: { minHeight: HEADER_HEIGHT } },
  shape: { borderRadius: 4 },
  spacing: 8,
})

const workspaceComponents: NonNullable<Theme['components']> = {
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: { minHeight: 36, paddingInline: 14 },
    },
  },
  MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
  MuiTableContainer: { defaultProps: { tabIndex: 0 } },
  MuiChip: {
    defaultProps: { size: 'small' },
    styleOverrides: {
      root: { height: 'auto', minHeight: 24, borderRadius: 4 },
      label: { paddingTop: 2, paddingBottom: 2, whiteSpace: 'normal' },
    },
  },
  MuiCssBaseline: {
    styleOverrides: {
      '*:focus-visible': { outline: `2px solid ${primary}`, outlineOffset: 3 },
      a: { color: primary },
      body: { margin: 0 },
      '.skip-link': {
        position: 'fixed',
        top: -100,
        left: 16,
        zIndex: 2000,
        padding: '12px 20px',
        background: '#FFFFFF',
      },
      '.skip-link:focus': { top: 8 },
    },
  },
}

theme.components = deepmerge(componentsOverride(theme), workspaceComponents)
