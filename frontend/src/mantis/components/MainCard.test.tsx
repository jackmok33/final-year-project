// @vitest-environment jsdom
import { Button, CardActionArea, ThemeProvider } from '@mui/material'
import { getContrastRatio } from '@mui/material/styles'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import AuthCard from './AuthCard'
import MainCard from './MainCard'

describe('supplied Mantis integration', () => {
  it('keeps panel headings, actions and body content accessible', async () => {
    const onClick = vi.fn()
    const ref = createRef<HTMLDivElement>()
    render(
      <ThemeProvider theme={theme}>
        <MainCard
          ref={ref}
          title="Applications"
          secondary={<Button onClick={onClick}>Export</Button>}
        >
          Applicants awaiting review
        </MainCard>
      </ThemeProvider>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeVisible()
    expect(ref.current).toHaveClass('MuiCard-root')
    expect(ref.current?.querySelector('.MuiCardContent-root')).toHaveTextContent(
      'Applicants awaiting review',
    )
    await userEvent.click(within(ref.current!).getByRole('button', { name: 'Export' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('lets a course card keep a single keyboard-operable action without an extra content wrapper', async () => {
    const onSelect = vi.fn()
    render(
      <MainCard content={false}>
        <CardActionArea onClick={onSelect}>Open course</CardActionArea>
      </MainCard>,
    )
    const action = screen.getByRole('button', { name: 'Open course' })
    expect(action.closest('.MuiCardContent-root')).toBeNull()
    await userEvent.tab()
    expect(action).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('combines Mantis auth sizing with caller styling and keeps the form interactive', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AuthCard sx={[{ width: '100%' }, (theme) => ({ color: theme.palette.text.primary })]}>
          <Button>Continue</Button>
        </AuthCard>
      </ThemeProvider>,
    )
    const button = screen.getByRole('button', { name: 'Continue' })
    const card = button.closest('.MuiCard-root')!
    expect(card).toHaveStyle({ width: '100%' })
    await userEvent.tab()
    expect(button).toHaveFocus()
  })

  it('supports themed card styles and isolated rendering without the application theme', () => {
    const view = render(
      <MainCard title="Evidence" sx={[(theme) => ({ padding: theme.spacing(1) })]}>
        Original document
      </MainCard>,
    )
    const card = screen.getByRole('heading', { name: 'Evidence' }).closest('.MuiCard-root')!
    expect(card).toHaveStyle({ padding: '8px' })
    view.rerender(<MainCard>Untitled content</MainCard>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('Untitled content')).toBeVisible()
  })

  it('retains readable workspace action and status colours over the Mantis palette', () => {
    for (const colour of ['primary', 'success', 'warning', 'error'] as const) {
      const palette = theme.palette[colour]
      expect(getContrastRatio(palette.main, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
    expect(
      getContrastRatio(theme.palette.text.secondary, theme.palette.background.paper),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
