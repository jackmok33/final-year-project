import { createTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { theme } from '../../app/theme'
import getShadow from './getShadow'

describe('getShadow', () => {
  it.each([
    'primary',
    'secondary',
    'success',
    'info',
    'warning',
    'error',
    'primaryButton',
    'secondaryButton',
    'successButton',
    'infoButton',
    'warningButton',
    'errorButton',
  ] as const)('resolves the %s template shadow', (key) =>
    expect(getShadow(theme, key)).toBe(theme.customShadows![key]),
  )
  it('uses the standard MUI shadow when custom tokens are unavailable', () => {
    const plain = createTheme()
    expect(getShadow(plain, 'primary')).toBe(plain.shadows[1])
    expect(getShadow(theme, 'unknown')).toBe(theme.customShadows!.primary)
  })
})
