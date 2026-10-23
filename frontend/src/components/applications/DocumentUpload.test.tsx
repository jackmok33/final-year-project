// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { DocumentUpload } from './DocumentUpload'

describe('DocumentUpload', () => {
  it('shows the selected original and forwards replacement and removal', async () => {
    const onSelect = vi.fn(),
      onRemove = vi.fn()
    const file = new File(['pdf'], 'transcript.pdf', { type: 'application/pdf' })
    renderPage(
      <DocumentUpload
        type="transcript"
        document={{ file, pages: 4 }}
        checking={false}
        disabled={false}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    )
    expect(screen.getByText(/transcript.pdf/)).toHaveTextContent('4 pages')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file)
    expect(onSelect).toHaveBeenCalledWith(file)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Transcript' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })
  it('blocks file selection and removal while validation is running', () => {
    const onRemove = vi.fn()
    const file = new File(['pdf'], 'cv.pdf', { type: 'application/pdf' })
    renderPage(
      <DocumentUpload
        type="cv"
        document={{ file, pages: 2 }}
        checking
        disabled
        onSelect={vi.fn()}
        onRemove={onRemove}
      />,
    )
    expect(screen.getByLabelText('Upload CV')).toBeDisabled()
    const remove = screen.getByRole('button', { name: 'Remove CV' })
    expect(remove).toBeDisabled()
    remove.click()
    expect(onRemove).not.toHaveBeenCalled()
  })
})
