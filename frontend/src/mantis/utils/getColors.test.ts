import { createTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import getColors from './getColors'

describe('getColors', () => {
  it.each(['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const)(
    'resolves %s and falls back to standard MUI light/dark tokens',
    (color) => {
      const theme = createTheme()
      expect(getColors(theme, color)).toMatchObject({
        main: theme.palette[color].main,
        lighter: theme.palette[color].light,
        darker: theme.palette[color].dark,
      })
    },
  )
  it('defaults to the primary palette', () => {
    const theme = createTheme()
    expect(getColors(theme).main).toBe(theme.palette.primary.main)
  })
})
