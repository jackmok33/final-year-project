// @vitest-environment jsdom
import {
  Alert,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Switch,
  ThemeProvider,
} from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { theme } from './theme'
describe('theme', () => {
  it('preserves green, amber and red status labels with MUI 9 colour classes', () => {
    const statuses = [
      { label: 'Offer', color: 'success' },
      { label: 'Further review', color: 'warning' },
      { label: 'Reject', color: 'error' },
    ] as const
    render(
      <ThemeProvider theme={theme}>
        {statuses.map(({ label, color }) => (
          <Chip key={label} variant="combined" color={color} label={label} />
        ))}
      </ThemeProvider>,
    )
    for (const { label, color } of statuses) {
      expect(screen.getByText(label).closest('.MuiChip-root')).toHaveStyle({
        color: theme.palette[color].main,
      })
    }
  })
  it('keeps radio selection and account switches connected to their labels and handlers', async () => {
    const onOutcome = vi.fn()
    const onActive = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <RadioGroup
          aria-label="Tutor decision"
          defaultValue="review"
          onChange={(_, value) => onOutcome(value)}
        >
          <FormControlLabel value="offer" control={<Radio />} label="Offer" />
          <FormControlLabel value="review" control={<Radio />} label="Further review" />
        </RadioGroup>
        <FormControlLabel
          label="Account active"
          control={<Switch onChange={(_, value) => onActive(value)} />}
        />
      </ThemeProvider>,
    )
    expect(screen.getByRole('radio', { name: 'Further review' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Offer' }))
    expect(onOutcome).toHaveBeenLastCalledWith('offer')
    await userEvent.click(screen.getByRole('switch', { name: 'Account active' }))
    expect(onActive).toHaveBeenLastCalledWith(true)
  })
  it.each(['success', 'info', 'warning', 'error'] as const)(
    'renders %s alerts when only severity is supplied',
    (severity) => {
      render(
        <ThemeProvider theme={theme}>
          <Alert severity={severity}>Assessment update</Alert>
        </ThemeProvider>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Assessment update')
    },
  )
})
