// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { rubric } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { CriteriaFields } from './CriteriaFields'

describe('CriteriaFields', () => {
  it('forwards numeric edits without converting empty strings and reports validity', () => {
    const changeWeight = vi.fn(),
      changeThreshold = vi.fn()
    renderPage(
      <CriteriaFields
        rubric={rubric}
        total={100}
        invalidWeights={false}
        disabled={false}
        changeWeight={changeWeight}
        changeThreshold={changeThreshold}
      />,
    )
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    expect(changeWeight).toHaveBeenCalledWith('academic', '')
    expect(changeThreshold).toHaveBeenCalledWith('offerFrom', '85')
    expect(screen.getByText('100% · Valid')).toBeInTheDocument()
  })
  it('renders invalid values as empty and disables all editable fields', () => {
    renderPage(
      <CriteriaFields
        rubric={{ ...rubric, margin: NaN, weights: { ...rubric.weights, academic: NaN } }}
        total={NaN}
        invalidWeights
        disabled
        changeWeight={vi.fn()}
        changeThreshold={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Academic performance (%)')).toHaveValue(null)
    for (const input of screen.getAllByRole('spinbutton', { hidden: true }))
      expect(input).toBeDisabled()
    expect(screen.getByText('—% · Invalid')).toBeInTheDocument()
  })
})
