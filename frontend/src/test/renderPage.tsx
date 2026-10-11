import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { theme } from '../app/theme'
import { Location } from './Location'

export function renderPage(
  element: ReactElement,
  url = '/applications/APP-TEST',
  path = '/applications/:id/*',
) {
  return render(element, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[url]}>
          <Location />
          <Routes>
            <Route path={path} element={children} />
            <Route path="*" element={<p>Destination page</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    ),
  })
}
