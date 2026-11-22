// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { EvidenceSummary } from './EvidenceSummary'

describe('EvidenceSummary', () => {
  it('groups supplied evidence under accessible headings', () => {
    renderPage(
      <EvidenceSummary
        groups={[
          { key: 'transcript', entries: [['Machine learning: 78%']] },
          { key: 'work', entries: [['Data science intern']] },
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: /Transcript/, level: 3 })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Working experience', level: 3 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Machine learning: 78%')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Education' })).not.toBeInTheDocument()
  })
  it('does not invent facts for an empty evidence summary', () => {
    renderPage(<EvidenceSummary groups={[]} />)
    expect(screen.getByRole('heading', { name: 'Evidence summary', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})
