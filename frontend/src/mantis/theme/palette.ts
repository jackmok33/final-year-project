import { presetPalettes } from '@ant-design/colors'
import type { PaletteOptions } from '@mui/material/styles'
import defaultPalette from './defaultPalette'

// Light-mode builder from seed/src/themes/palette.ts. The workspace exposes
// one theme, so the template's preset picker and dark-mode builder are omitted.
export default function buildPalette(): PaletteOptions {
  const grey = [
    '#ffffff',
    '#fafafa',
    '#f5f5f5',
    '#f0f0f0',
    '#d9d9d9',
    '#bfbfbf',
    '#8c8c8c',
    '#595959',
    '#262626',
    '#141414',
    '#000000',
    '#fafafa',
    '#bfbfbf',
    '#434343',
    '#1f1f1f',
    '#fafafb',
    '#e6ebf1',
  ]
  return {
    mode: 'light',
    ...defaultPalette({ ...presetPalettes, grey }),
    common: { black: '#000000', white: '#ffffff' },
    text: { primary: grey[8], secondary: grey[6], disabled: grey[5] },
    action: { disabled: grey[4] },
    divider: grey[3],
    background: { paper: grey[0], default: grey[15] },
  }
}
