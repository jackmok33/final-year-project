// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { RecommendationPanel } from './RecommendationPanel'

describe('RecommendationPanel', () => {
  it('shows the explanation and evidence summary without PDF shortcuts', () => {
    renderPage(
      <RecommendationPanel
        run={run}
        groups={[{ key: 'transcript', entries: [['Machine learning: 78%']] }]}
      />,
    )
    expect(screen.getByText(run.justification.summary)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Why this recommendation', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evidence summary', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Machine learning: 78%')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('withholds the explanation and evidence when no assessment is supplied', () => {
    renderPage(
      <RecommendationPanel
        groups={[{ key: 'transcript', entries: [['Machine learning: 78%']] }]}
      />,
    )
    expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
    expect(screen.queryByText('Machine learning: 78%')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
