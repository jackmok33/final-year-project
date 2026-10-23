// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '../components/files'
import type { Backup } from '../domain/types'
import { discardBackup, stageBackup, takeBackup, validateBackup } from '../services/demo'
import '../test/domSetup'
import { dataset } from '../test/fixtures'
import { command, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { DataOperationsPage } from './DataOperationsPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
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
describe('browser data maintenance', () => {
  beforeEach(resetPageMocks)
  const show = (page: React.ReactElement) => renderPage(page, '/admin', '*')
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
