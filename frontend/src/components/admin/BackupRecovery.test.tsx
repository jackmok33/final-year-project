// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { BackupRecovery } from './BackupRecovery'

describe('BackupRecovery', () => {
  it('forwards backup creation and the selected restore file', async () => {
    const backup = vi.fn().mockResolvedValue(undefined),
      selectBackup = vi.fn().mockResolvedValue(undefined)
    renderPage(
      <BackupRecovery busy={false} reading={false} backup={backup} selectBackup={selectBackup} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create backup' }))
    expect(backup).toHaveBeenCalledOnce()
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText('Import demo backup'), file)
    expect(selectBackup).toHaveBeenCalledWith(file)
  })
  it('blocks both operations while verifying a backup', () => {
    renderPage(<BackupRecovery busy={false} reading backup={vi.fn()} selectBackup={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Create backup' })).toBeDisabled()
    expect(screen.getByLabelText('Import demo backup')).toBeDisabled()
  })
})
