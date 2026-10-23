// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { documents } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { DocumentNavigation } from './DocumentNavigation'

describe('DocumentNavigation', () => {
  it('forwards the selected document ID and numeric source page', async () => {
    const onDocumentChange = vi.fn(),
      changePage = vi.fn()
    renderPage(
      <DocumentNavigation
        documents={documents}
        doc={documents[0]}
        page={1}
        onDocumentChange={onDocumentChange}
        changePage={changePage}
      />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Original document' }))
    await userEvent.click(screen.getByRole('option', { name: 'cv.pdf' }))
    expect(onDocumentChange).toHaveBeenCalledWith(documents[1].id)
    await userEvent.click(screen.getByRole('combobox', { name: 'Page' }))
    expect(screen.getAllByRole('option')).toHaveLength(documents[0].pages)
    await userEvent.click(screen.getByRole('option', { name: '2 of 4' }))
    expect(changePage).toHaveBeenCalledWith(2)
  })
})
