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
        documents={[{ file, pages: 4 }]}
        checking={false}
        disabled={false}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    )
    expect(screen.getByText(/transcript.pdf/)).toHaveTextContent('4 pages')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file)
    expect(onSelect).toHaveBeenCalledWith([file])
    await userEvent.click(screen.getByRole('button', { name: 'Remove Transcript' }))
    expect(onRemove).toHaveBeenCalledWith(0)
  })
  it('blocks file selection and removal while validation is running', () => {
    const onRemove = vi.fn()
    const file = new File(['pdf'], 'cv.pdf', { type: 'application/pdf' })
    renderPage(
      <DocumentUpload
        type="cv"
        documents={[{ file, pages: 2 }]}
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
  it('accepts several references and removes a specific original', async () => {
    const first = new File(['one'], 'academic.pdf', { type: 'application/pdf' })
    const second = new File(['two'], 'professional.pdf', { type: 'application/pdf' })
    const onSelect = vi.fn(),
      onRemove = vi.fn()
    renderPage(
      <DocumentUpload
        type="reference"
        documents={[
          { file: first, pages: 1 },
          { file: second, pages: 2 },
        ]}
        checking={false}
        disabled={false}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    )
    const input = screen.getByLabelText('Upload References')
    expect(input).toHaveAttribute('multiple')
    await userEvent.upload(input, [first, second])
    expect(onSelect).toHaveBeenCalledWith([first, second])
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove reference 2: professional.pdf' }),
    )
    expect(onRemove).toHaveBeenCalledWith(1)
  })
})
