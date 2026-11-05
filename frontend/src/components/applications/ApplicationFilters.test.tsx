// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { ApplicationFilters } from './ApplicationFilters'

describe('ApplicationFilters', () => {
  it('offers unique document states and forwards search and quick-sort changes', async () => {
    const setSearch = vi.fn(),
      setStatus = vi.fn(),
      setSort = vi.fn()
    renderPage(
      <ApplicationFilters
        search=""
        status="all"
        sort={{ column: 'name', direction: 'asc' }}
        setSearch={setSearch}
        setStatus={setStatus}
        setSort={setSort}
        addPath="/applications/new?batch=one"
      />,
    )
    await userEvent.type(screen.getByRole('textbox', { name: 'Search applicant' }), 'A')
    expect(setSearch).toHaveBeenCalledWith('A')
    await userEvent.click(screen.getByRole('combobox', { name: 'All status' }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All status',
      'Ready',
      'Missing',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Missing' }))
    expect(setStatus).toHaveBeenCalledWith('missing')
    await userEvent.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await userEvent.click(screen.getByRole('option', { name: 'Highest score' }))
    expect(setSort).toHaveBeenCalledWith({ column: 'score', direction: 'desc' })
    expect(screen.getByRole('link', { name: 'Add applicant' })).toHaveAttribute(
      'href',
      '/applications/new?batch=one',
    )
  })
})
