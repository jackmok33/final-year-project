// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { otherProgramme, programme, tutor } from '../test/fixtures'
import {
  apiMocks,
  command,
  dispatch,
  queryResult,
  resetPageMocks,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { ModulesPage } from './ModulesPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('module workspace creation', () => {
  beforeEach(resetPageMocks)
  it('adds a course by name, opens its intake workspace and closes the dialog', async () => {
    unwrap.mockResolvedValue({ id: 'workspace-new' })
    renderPage(<ModulesPage />, '/modules', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    const input = screen.getByRole('textbox', { name: 'Programme name' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add Programme' })).toBeDisabled()
    await userEvent.type(input, '  Data Science & AI MSc  ')
    await userEvent.keyboard('{Enter}')
    expect(command).toHaveBeenCalledWith({ op: 'workspace', name: 'Data Science & AI MSc' })
    await waitFor(() =>
      expect(screen.getByLabelText('Current URL')).toHaveTextContent(
        '/batches?programme=workspace-new',
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('allows creating the first workspace without an assigned course and resets cancelled drafts', async () => {
    workspaceMock.mockReturnValue({ user: tutor, programmes: [], programme: undefined })
    renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('alert')).toHaveTextContent('do not have access')
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Programme name' }), 'Draft')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    expect(screen.getByRole('textbox', { name: 'Programme name' })).toHaveValue('')
    expect(command).not.toHaveBeenCalled()
  })
  it('keeps failed drafts editable and rejects names longer than 100 characters', async () => {
    unwrap.mockRejectedValue({ data: 'Storage unavailable' })
    renderPage(<ModulesPage />, '/modules', '*')
    dispatch.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    const input = screen.getByRole('textbox', { name: 'Programme name' })
    await userEvent.type(input, 'COMP0003')
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(input).toHaveValue('COMP0003')
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ui/selectProgramme' }),
    )
    await userEvent.clear(input)
    await userEvent.type(input, 'x'.repeat(101))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Programme' })).toBeDisabled()
  })
})
describe('module and intake selection', () => {
  beforeEach(resetPageMocks)
  it('renders module cards and keeps unassigned modules out of the page', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programmes: [{ ...programme, name: 'Legacy course title' }],
      isLoading: false,
    })
    renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('link', { name: 'Open Legacy course title 26/27' })).toHaveAttribute(
      'href',
      '/batches?programme=programme-1&intake=2026+%2F+27',
    )
    expect(screen.getByRole('heading', { name: 'Legacy course title 26/27' })).toBeInTheDocument()
    expect(screen.queryByText(programme.code)).not.toBeInTheDocument()
    expect(screen.queryByText(programme.department)).not.toBeInTheDocument()
    expect(screen.queryByText(otherProgramme.name)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    for (const link of screen.getAllByRole('link'))
      expect(link.getAttribute('href')).toMatch(/^\/batches\?/)
    expect(screen.queryByRole('link', { name: 'Open Legacy course title' })).not.toBeInTheDocument()
  })
  it('opens the selected intake directly from programme cards', async () => {
    apiMocks.useProgrammeIntakesQuery.mockReturnValue(
      queryResult([
        { programmeId: programme.id, years: ['2026 / 27', '2025 / 26', '2024 / 25', '2020 / 21'] },
      ]),
    )
    renderPage(<ModulesPage />, '/modules', '*')
    for (const year of ['26/27', '25/26', '24/25', '20/21']) {
      expect(screen.getByRole('heading', { name: `CSML ${year}` })).toBeInTheDocument()
    }
    await userEvent.click(screen.getByRole('link', { name: 'Open CSML 25/26' }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(
      '/batches?programme=programme-1&intake=2025+%2F+26',
    )
    expect(command).not.toHaveBeenCalled()
  })
  it('shows module loading and lookup failures without inventing counts', () => {
    workspaceMock.mockReturnValue({ programmes: [], isLoading: true })
    const view = renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    workspaceMock.mockReturnValue({ programmes: [], error: { data: 'Storage unavailable' } })
    view.rerender(<ModulesPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable')
  })
})
