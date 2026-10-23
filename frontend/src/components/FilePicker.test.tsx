// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { renderPage } from '../test/renderPage'
import { FilePicker } from './FilePicker'

describe('FilePicker', () => {
  it('returns the selected file and allows selecting it again', async () => {
    const onSelect = vi.fn()
    renderPage(
      <FilePicker label="Choose PDF" inputLabel="Original PDF" accept=".pdf" onSelect={onSelect} />,
    )
    const input = screen.getByLabelText('Original PDF')
    const file = new File(['pdf'], 'cv.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)
    await userEvent.upload(input, file)
    expect(onSelect).toHaveBeenNthCalledWith(1, file)
    expect(onSelect).toHaveBeenNthCalledWith(2, file)
    expect(input).toHaveValue('')
  })

  it('disables both the trigger and the file input', async () => {
    const onSelect = vi.fn()
    renderPage(
      <FilePicker
        label="Choose PDF"
        inputLabel="Original PDF"
        accept=".pdf"
        disabled
        onSelect={onSelect}
      />,
    )
    expect(screen.getByRole('button', { name: 'Choose PDF' })).toBeDisabled()
    const input = screen.getByLabelText('Original PDF')
    expect(input).toBeDisabled()
    await userEvent.upload(input, new File(['pdf'], 'cv.pdf'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
