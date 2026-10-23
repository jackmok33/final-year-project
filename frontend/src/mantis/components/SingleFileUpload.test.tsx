// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import SingleFileUpload from './SingleFileUpload'
describe('SingleFileUpload', () => {
  const labels = {
    title: 'Upload applications',
    description: 'Drop your ZIP or',
    browse: 'Browse',
    ending: 'to select a file.',
    input: 'Choose ZIP',
    fileInput: 'ZIP file',
  }
  it('accepts one ZIP and rejects other files without selecting them', async () => {
    const select = vi.fn(),
      reject = vi.fn()
    render(
      <SingleFileUpload disabled={false} labels={labels} onSelect={select} onReject={reject} />,
    )
    const file = new File(['zip'], 'applications.zip', { type: 'application/zip' })
    await userEvent.upload(screen.getByLabelText('ZIP file'), file)
    await waitFor(() => expect(select).toHaveBeenCalledWith(file))
    select.mockClear()
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(
      screen.getByLabelText('ZIP file'),
      new File(['pdf'], 'cv.pdf', { type: 'application/pdf' }),
    )
    await waitFor(() => expect(reject).toHaveBeenCalled())
    expect(select).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Choose ZIP' })).not.toContainElement(
      screen.getByLabelText('ZIP file'),
    )
  })
  it('blocks selecting files while an upload is already running', async () => {
    const select = vi.fn(),
      reject = vi.fn()
    render(<SingleFileUpload disabled labels={labels} onSelect={select} onReject={reject} />)
    const input = screen.getByLabelText('ZIP file')
    expect(input).toBeDisabled()
    await userEvent.upload(input, new File(['zip'], 'next.zip', { type: 'application/zip' }))
    expect(select).not.toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
  })
})
