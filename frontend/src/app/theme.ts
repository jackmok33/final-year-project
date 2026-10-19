import { alpha, createTheme } from '@mui/material/styles'

// Mantis-style foundations adapted to the existing MUI/Vite application.
// The darker action blue retains AA contrast for small white button labels.
const primary = '#0958D9'
export const sidebarWidth = 260
export const headerHeight = 64

export const theme = createTheme({
  palette: {
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
  },
  typography: {
    fontFamily: '"Public Sans", Arial, sans-serif',
    fontSize: 14,
    fontWeightBold: 600,
    h3: { fontSize: 24, fontWeight: 600, lineHeight: 1.33 },
    h4: { fontSize: 20, fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.5 },
    h6: { fontSize: 14, fontWeight: 600, lineHeight: 1.57 },
    body1: { fontSize: 14, lineHeight: 1.57 },
    body2: { fontSize: 12, lineHeight: 1.66 },
    subtitle1: { fontSize: 14, fontWeight: 600, lineHeight: 1.57 },
    subtitle2: { fontSize: 12, fontWeight: 500, lineHeight: 1.66 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 4 },
  spacing: 8,
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 36, paddingInline: 14 },
        outlined: ({ ownerState }) =>
          ownerState.color === 'primary'
            ? {
                borderColor: '#D9D9D9',
                color: '#262626',
                '&:hover': { borderColor: primary, color: primary, backgroundColor: '#F5FAFF' },
              }
            : {},
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          '&.Mui-focused': { boxShadow: `0 0 0 2px ${alpha(primary, 0.1)}` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1 },
        },
        notchedOutline: { borderColor: '#D9D9D9' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#595959',
          backgroundColor: '#FAFAFB',
          whiteSpace: 'nowrap',
        },
        root: { padding: '16px 20px', borderColor: '#E6EBF1' },
      },
    },
    MuiTableContainer: { defaultProps: { tabIndex: 0 } },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 500, height: 'auto', minHeight: 24, borderRadius: 4 },
        label: { paddingTop: 2, paddingBottom: 2, whiteSpace: 'normal' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { border: '1px solid', borderColor: 'transparent', alignItems: 'flex-start' },
        standard: ({ ownerState, theme }) => {
          const tone = theme.palette[ownerState.color ?? ownerState.severity ?? 'info']
          return {
            color: tone.dark,
            backgroundColor: tone.light,
            borderColor: alpha(tone.main, 0.2),
          }
        },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 8 } } },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 18, fontWeight: 600 } } },
    MuiLink: { defaultProps: { underline: 'hover' } },
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
  },
})
