// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { CourseAnalytics } from './CourseAnalytics'

describe('CourseAnalytics', () => {
  it('shows four outcome proportions using tutor decision counts', () => {
    renderPage(
      <CourseAnalytics
        total={10}
        counts={{ unconditional: 4, conditional: 3, reject: 1, pending: 2 }}
      />,
    )
    for (const [label, value] of [
      ['Unconditional', 40],
      ['Conditional', 30],
      ['Reject', 10],
      ['Pending', 20],
    ] as const)
      expect(screen.getByRole('progressbar', { name: label })).toHaveAttribute(
        'aria-valuenow',
        String(value),
      )
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
  it('avoids percentages when there are no applications', () => {
    renderPage(
      <CourseAnalytics
        total={0}
        counts={{ unconditional: 0, conditional: 0, reject: 0, pending: 0 }}
      />,
    )
    expect(screen.getByText('No applications in this intake yet.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
