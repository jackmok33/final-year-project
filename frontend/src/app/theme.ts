import { createTheme } from '@mui/material/styles'
export const theme = createTheme({
  palette: {
    primary: { main: '#993BFF', dark: '#361A54', contrastText: '#FFFFFF' },
    secondary: { main: '#361A54' },
    background: { default: '#FAFAFA', paper: '#FFFFFF' },
    text: { primary: '#361A54', secondary: '#62566F' },
    divider: '#E5DEEC',
    success: { main: '#197553' },
    warning: { main: '#8A5A10' },
    error: { main: '#B33139' },
  },
  typography: {
    fontFamily: 'Aptos, Arial, sans-serif',
    fontSize: 14,
    h3: { fontSize: 40, fontWeight: 700, lineHeight: 1.2 },
    h4: { fontSize: 28, fontWeight: 700 },
    h5: { fontSize: 22, fontWeight: 600 },
    h6: { fontSize: 18, fontWeight: 600 },
    body1: { fontSize: 14, lineHeight: 1.6 },
    body2: { fontSize: 12, lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40 },
        outlined: { borderColor: '#993BFF', color: '#361A54' },
        text: { color: '#361A54' },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: '#62566F', background: '#FAFAFA' },
        root: { borderColor: '#E5DEEC' },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 600, height: 'auto', minHeight: 26 },
        label: { paddingTop: 3, paddingBottom: 3, whiteSpace: 'normal' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '*:focus-visible': { outline: '3px solid #361A54', outlineOffset: 3 },
        a: { color: '#361A54' },
        body: { margin: 0 },
        '.skip-link': {
          position: 'fixed',
          top: -100,
          left: 16,
          zIndex: 2000,
          padding: '12px 20px',
          background: '#FFF',
        },
        '.skip-link:focus': { top: 8 },
      },
    },
  },
})
