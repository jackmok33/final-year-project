// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { documents } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { CorrectionGuidance } from '../assessment/CorrectionGuidance'
import { EvidenceLink } from './EvidenceLink'

describe('shared evidence links', () => {
  it('navigates to the original document, page and run with encoded identities', async () => {
    const document = { ...documents[0], id: 'source & page=99' }
    renderPage(
      <EvidenceLink
        applicationId="APP/TEST"
        document={document}
        citation={{ documentId: document.id, page: 2 }}
        runId="run & page=99"
      />,
    )
    await userEvent.click(screen.getByRole('link', { name: 'transcript.pdf · p.2' }))
    const destination = screen.getByLabelText('Current URL').textContent!
    const url = new URL(destination, 'https://example.test')
    expect(url.pathname).toBe('/applications/APP%2FTEST/evidence')
    expect(url.searchParams.get('document')).toBe(document.id)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('run')).toBe('run & page=99')
    expect([...url.searchParams.keys()]).toEqual(['document', 'page', 'run'])
  })

  it.each([0, -1, 1.5, NaN, Infinity, 5])('disables invalid page %s', async (page) => {
    renderPage(
      <EvidenceLink
        applicationId="APP-TEST"
        document={documents[0]}
        citation={{ documentId: documents[0].id, page }}
      />,
    )
    const link = screen.getByText(`transcript.pdf · p.${page}`).closest('a')!
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')
    // A disabled source reference cannot navigate even if clicked programmatically.
    link.click()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(/^\/applications\/APP-TEST$/)
  })

  it('disables references with missing or mismatched documents', () => {
    const { rerender } = renderPage(
      <EvidenceLink applicationId="APP-TEST" citation={{ documentId: 'missing', page: 1 }} />,
    )
    expect(screen.getByText('Unsupported source reference').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    rerender(
      <EvidenceLink
        applicationId="APP-TEST"
        document={documents[0]}
        citation={{ documentId: 'different-document', page: 1 }}
      />,
    )
    expect(screen.getByText('transcript.pdf · p.1').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('correction source guidance', () => {
  it.each([1, 4])('opens a valid page for a %s-page transcript', (pages) => {
    renderPage(<CorrectionGuidance id="APP-TEST" transcript={{ ...documents[0], pages }} />)
    expect(screen.getByRole('link', { name: 'Inspect original transcript' })).toHaveAttribute(
      'href',
      `/applications/APP-TEST/evidence?document=APP-TEST-transcript&page=${Math.min(2, pages)}`,
    )
  })

  it('disables inspection when there is no transcript', () => {
    renderPage(<CorrectionGuidance id="APP-TEST" />)
    expect(screen.getByText('Inspect original transcript').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
