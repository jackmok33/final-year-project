// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { apiMocks, command, queryResult, resetPageMocks, unwrap } from '../test/pageMocks'
import type { Backup } from '../domain/types'
import { administrator, dataset, otherProgramme, programme, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { UsersAccessPage } from './UsersAccessPage'
import { ProgrammeSettingsPage } from './ProgrammeSettingsPage'
import { ServiceHealthPage } from './ServiceHealthPage'
import { DataOperationsPage } from './DataOperationsPage'
import { discardBackup, stageBackup, takeBackup, validateBackup } from '../services/demo'
import { downloadBlob } from '../components/files'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/demo', () => ({
  discardBackup: vi.fn(),
  stageBackup: vi.fn(() => 'backup-1'),
  takeBackup: vi.fn(),
  validateBackup: vi.fn(),
}))
vi.mock('../components/files', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadBlob: vi.fn(),
}))
beforeEach(resetPageMocks)
const show = (page: React.ReactElement) => renderPage(page, '/admin', '*')
describe('accounts and permissions', () => {
  it('creates an account with multiple course assignments without criteria editing permission', async () => {
    show(<UsersAccessPage />)
    await userEvent.type(screen.getByLabelText(/Name/), 'New tutor')
    await userEvent.type(screen.getByLabelText(/Demo email/), 'new@example.test')
    await userEvent.click(screen.getByLabelText(`Programme access: ${programme.name}`))
    await userEvent.click(screen.getByLabelText(`Programme access: ${otherProgramme.name}`))
    expect(screen.queryByLabelText('Allow rubric publication')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: {
        ...tutor,
        id: '',
        name: 'New tutor',
        email: 'new@example.test',
        canPublishCriteria: false,
      },
    })
    expect(await screen.findByText('Account and permissions saved.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue('')
  })
  it('loads an existing account and resets its draft when another account is selected', async () => {
    show(<UsersAccessPage />)
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
    await userEvent.clear(screen.getByLabelText(/Name/))
    await userEvent.type(screen.getByLabelText(/Name/), 'Unsaved edit')
    await userEvent.click(screen.getByRole('button', { name: `Edit ${administrator.name}` }))
    expect(screen.getByLabelText(/Name/)).toHaveValue(administrator.name)
    expect(screen.queryByLabelText('Allow rubric publication')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({ op: 'user', user: administrator })
    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue(''))
  })
  it('changes account roles, deactivates accounts and preserves draft on save failure', async () => {
    unwrap.mockRejectedValue(new Error('Email already assigned'))
    show(<UsersAccessPage />)
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Tutor + administrator' }))
    await userEvent.click(screen.getByLabelText('Account active'))
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: { ...tutor, roles: ['tutor', 'admin'], active: false },
    })
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
  })
})
describe('programme settings', () => {
  it('saves course metadata and can cancel unsaved changes', async () => {
    unwrap.mockResolvedValue({ id: programme.id })
    show(<ProgrammeSettingsPage />)
    fireEvent.change(screen.getByLabelText(/Programme name/), { target: { value: 'Changed name' } })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }))
    expect(screen.getByLabelText(/Programme name/)).toHaveValue(programme.name)
    fireEvent.change(screen.getByLabelText(/Programme name/), { target: { value: 'Changed name' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save programme' }))
    expect(command).toHaveBeenCalledWith({
      op: 'programme',
      programme: { ...programme, name: 'Changed name' },
    })
    expect(await screen.findByText('Programme metadata saved.')).toBeInTheDocument()
  })
  it('switches courses, then creates a workspace without reusing previous metadata', async () => {
    show(<ProgrammeSettingsPage />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Manage programme' }))
    await userEvent.click(screen.getByRole('option', { name: otherProgramme.name }))
    expect(screen.getByLabelText(/Programme code/)).toHaveValue(otherProgramme.code)
    await userEvent.click(screen.getByRole('button', { name: 'New programme' }))
    expect(screen.getByLabelText(/Programme name/)).toHaveValue('')
    fireEvent.change(screen.getByLabelText(/Programme name/), { target: { value: 'New Course' } })
    fireEvent.change(screen.getByLabelText(/Programme code/), { target: { value: 'NEW' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save programme' }))
    expect(command).toHaveBeenCalledWith({
      op: 'programme',
      programme: {
        id: '',
        name: 'New Course',
        code: 'NEW',
        year: '2026 / 27',
        department: '',
        description: '',
      },
    })
  })
  it('can create a first course when no programmes exist', () => {
    apiMocks.useProgrammesQuery.mockReturnValue(queryResult([]))
    show(<ProgrammeSettingsPage />)
    expect(screen.getByLabelText(/Programme name/)).toHaveValue('')
  })
})
describe('simulated service health', () => {
  it('changes model availability and shows redacted logs without applicant content', async () => {
    show(<ServiceHealthPage />)
    await userEvent.click(screen.getByRole('switch'))
    expect(command).toHaveBeenCalledWith({ op: 'model', available: true })
    await userEvent.click(screen.getByRole('button', { name: 'View redacted log' }))
    const dialog = screen.getByRole('dialog', { name: 'Redacted demo log' })
    expect(dialog).toHaveTextContent('JOB-1')
    expect(dialog).toHaveTextContent('Applicant content: excluded')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('handles healthy services with no failures', () => {
    apiMocks.useHealthQuery.mockReturnValue(
      queryResult({ modelAvailable: true, queued: 0, failed: 0, logs: [] }),
    )
    show(<ServiceHealthPage />)
    expect(screen.getByText('No failed attempts recorded.')).toBeInTheDocument()
    expect(screen.queryByText(/Simulated local model unavailable/)).not.toBeInTheDocument()
  })
})
describe('browser data maintenance', () => {
  it('requires confirmation for deletion and records reset separately', async () => {
    show(<DataOperationsPage />)
    expect(screen.getByRole('button', { name: 'Review deletion impact' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Application identifier'), ' APP-TEST ')
    await userEvent.click(screen.getByRole('button', { name: 'Review deletion impact' }))
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    )
    expect(command).toHaveBeenCalledWith({ op: 'delete', id: 'APP-TEST' })
    expect(await screen.findByText(/APP-TEST and its local documents/)).toBeInTheDocument()
    expect(screen.getByLabelText('Application identifier')).toHaveValue('')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo dataset' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    )
    expect(command).toHaveBeenLastCalledWith({ op: 'reset' })
  })
  it('exports PDFs and record history in a JSON backup', async () => {
    const backup: Backup = {
      format: 'ucl-admissions-demo',
      version: 2,
      dataset,
      files: [],
      createdAt: '2026-10-10',
    }
    unwrap.mockResolvedValue({ backupId: 'backup-1' })
    vi.mocked(takeBackup).mockReturnValue(backup)
    show(<DataOperationsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Create backup' }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled())
    expect(JSON.parse(await vi.mocked(downloadBlob).mock.calls[0][0].text())).toEqual(backup)
    expect(screen.getByText(/backup downloaded, including original PDFs/)).toBeInTheDocument()
  })
  it('verifies a backup before confirmation and discards it if cancelled', async () => {
    vi.mocked(validateBackup).mockResolvedValue({ dataset, files: {} })
    show(<DataOperationsPage />)
    await userEvent.upload(
      screen.getByLabelText('Import demo backup'),
      new File(['{}'], 'backup.json', { type: 'application/json' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Restore browser demo backup?' })
    expect(dialog).toHaveTextContent('1 applications')
    expect(stageBackup).toHaveBeenCalledWith({})
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(discardBackup).toHaveBeenCalledWith('backup-1')
    expect(command).not.toHaveBeenCalled()
  })
  it('restores only a verified, confirmed backup', async () => {
    vi.mocked(validateBackup).mockResolvedValue({ dataset, files: {} })
    show(<DataOperationsPage />)
    await userEvent.upload(
      screen.getByLabelText('Import demo backup'),
      new File(['{}'], 'backup.json', { type: 'application/json' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(command).toHaveBeenCalledWith({ op: 'restore', backupId: 'backup-1' })
    expect(await screen.findByText(/Browser demo restored/)).toBeInTheDocument()
  })
  it('surfaces malformed, oversized and failed backup operations without replacing data', async () => {
    show(<DataOperationsPage />)
    await userEvent.upload(
      screen.getByLabelText('Import demo backup'),
      new File(['broken'], 'backup.json', { type: 'application/json' }),
    )
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('JSON'))).toBe(true),
    )
    const oversized = new File(['{}'], 'large.json', { type: 'application/json' })
    Object.defineProperty(oversized, 'size', { value: 100 * 1024 * 1024 + 1 })
    await userEvent.upload(screen.getByLabelText('Import demo backup'), oversized)
    expect(
      await screen.findByText('Demo backup imports are limited to 100 MB.'),
    ).toBeInTheDocument()
    unwrap.mockRejectedValue(new Error('Backup failed'))
    await userEvent.click(screen.getByRole('button', { name: 'Create backup' }))
    expect(await screen.findByText('Backup failed')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
