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
          { key: 'english', entries: [['IELTS Academic', '7.5 / 9']] },
          { key: 'work', entries: [['Data science intern']] },
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'English test', level: 3 })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Working experience', level: 3 }),
    ).toBeInTheDocument()
    expect(screen.getByText('7.5 / 9')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Education' })).not.toBeInTheDocument()
  })
  it('does not invent facts for an empty evidence summary', () => {
    renderPage(<EvidenceSummary groups={[]} />)
    expect(screen.getByRole('heading', { name: 'Evidence summary' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})
