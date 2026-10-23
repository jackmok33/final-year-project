// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { application, documents, run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { RecommendationPanel } from './RecommendationPanel'

describe('RecommendationPanel', () => {
  it('shows the supplied explanation and links to the exact source run/page', () => {
    renderPage(
      <RecommendationPanel
        applicationId={application.id}
        run={run}
        documents={documents}
        groups={[]}
      />,
    )
    expect(screen.getByText(run.justification.summary)).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toContain(`document=${documents[0].id}&page=2&run=${run.id}`)
  })
  it('withholds the explanation and evidence when no assessment is supplied', () => {
    renderPage(
      <RecommendationPanel applicationId={application.id} documents={documents} groups={[]} />,
    )
    expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
