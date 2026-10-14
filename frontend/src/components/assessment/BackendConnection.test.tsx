// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { BackendConnection } from './BackendConnection'
import type { BackendHealth } from '../../services/backend'

afterEach(cleanup)
const health: BackendHealth = {
  status: 'ok',
  mode: 'mock',
  service: 'ucl-application-review-api',
  database: 'not configured',
  inference: 'not configured',
}
it.each([
  [{ pending: true, error: false, fromBackend: false }, /Checking FastAPI/],
  [{ pending: false, error: true, fromBackend: false }, /FastAPI is unavailable/],
  [{ pending: false, error: false, fromBackend: false, health }, /FastAPI connected/],
  [
    { pending: false, error: false, fromBackend: true, health },
    /This assessment came from FastAPI/,
  ],
  [{ pending: false, error: false, fromBackend: false }, /Checking FastAPI/],
])('explains the connection without claiming real inference', (props, label) => {
  render(<BackendConnection {...props} />)
  expect(screen.getByRole('status')).toHaveTextContent(label)
})
