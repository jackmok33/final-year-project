// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import TablePagination from './TablePagination'
describe('TablePagination', () => {
  it('bounds page navigation and keeps page-size controls labelled', async () => {
    const size = vi.fn()
    function Example() {
      const [page, setPage] = useState(0)
      return (
        <TablePagination
          page={page}
          pageSize={5}
          total={12}
          onPageChange={setPage}
          onPageSizeChange={size}
          labels={{
            navigation: 'Result pages',
            rowsPerPage: 'Rows per page',
            goTo: 'Go to',
            pageSize: (value) => `${value} rows`,
          }}
        />
      )
    }
    render(
      <ThemeProvider theme={theme}>
        <Example />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(screen.getByRole('spinbutton', { name: 'Go to' })).toHaveValue(3)
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Go to' }))
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Go to' }), '99')
    expect(screen.getByRole('spinbutton', { name: 'Go to' })).toHaveValue(3)
    await userEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    await userEvent.click(screen.getByRole('option', { name: '25 rows' }))
    expect(size).toHaveBeenCalledWith(25)
  })
})
