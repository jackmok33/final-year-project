// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { ZipUploadPanel } from './ZipUploadPanel'

describe('ZipUploadPanel', () => {
  it('clears the previous ZIP when a replacement is rejected', async () => {
    const onSelect = vi.fn(),
      onImport = vi.fn()
    renderPage(
      <ZipUploadPanel
        file={new File(['zip'], 'old.zip')}
        busy={false}
        error={undefined}
        onSelect={onSelect}
        onImport={onImport}
      />,
    )
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(
      screen.getByLabelText('Application ZIP file'),
      new File(['pdf'], 'cv.pdf', { type: 'application/pdf' }),
    )
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(undefined))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })
  it('shows the selected file and disables duplicate imports while busy', () => {
    renderPage(
      <ZipUploadPanel
        file={new File(['zip'], 'selected.zip')}
        busy
        error={undefined}
        onSelect={vi.fn()}
        onImport={vi.fn()}
      />,
    )
    expect(screen.getByText('selected.zip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled()
    expect(screen.getByRole('progressbar', { name: 'Uploading…' })).toBeInTheDocument()
  })
})
