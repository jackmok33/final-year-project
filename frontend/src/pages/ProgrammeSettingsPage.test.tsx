// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { otherProgramme, programme } from '../test/fixtures'
import { apiMocks, command, queryResult, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { ProgrammeSettingsPage } from './ProgrammeSettingsPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('programme settings', () => {
  beforeEach(resetPageMocks)
  const show = (page: React.ReactElement) => renderPage(page, '/admin', '*')
  it('saves course metadata and can cancel unsaved changes', async () => {
    unwrap.mockResolvedValue({ id: programme.id })
    show(<ProgrammeSettingsPage />)
    fireEvent.change(screen.getByLabelText(/Course code/), { target: { value: 'COMP0009' } })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }))
    expect(screen.getByLabelText(/Course code/)).toHaveValue(programme.code)
    fireEvent.change(screen.getByLabelText(/Course code/), { target: { value: 'COMP0009' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save programme' }))
    expect(command).toHaveBeenCalledWith({
      op: 'programme',
      programme: { ...programme, code: 'COMP0009' },
    })
    expect(await screen.findByText('Programme metadata saved.')).toBeInTheDocument()
  })
  it('switches courses without offering administrative course creation', async () => {
    show(<ProgrammeSettingsPage />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Manage programme' }))
    await userEvent.click(screen.getByRole('option', { name: otherProgramme.name }))
    expect(screen.getByLabelText(/Course code/)).toHaveValue(otherProgramme.code)
    expect(screen.queryByRole('button', { name: 'New programme' })).not.toBeInTheDocument()
  })
  it('shows an empty state until a tutor adds a course', () => {
    apiMocks.useProgrammesQuery.mockReturnValue(queryResult([]))
    show(<ProgrammeSettingsPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Tutors can add their own courses')
    expect(screen.queryByRole('button', { name: 'Save programme' })).not.toBeInTheDocument()
  })
})
