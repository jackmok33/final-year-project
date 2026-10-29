import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it.each([
    ['A document is missing.', 'A document is missing.'],
    [new Error('Storage is unavailable.'), 'Storage is unavailable.'],
    [{ status: 'DEMO_ERROR', data: 'Access denied.' }, 'Access denied.'],
    [{ status: 422, data: { detail: 'Invalid intake.' } }, 'Invalid intake.'],
    [{ status: 500, data: { message: 'Please retry.' } }, 'Please retry.'],
    [{ detail: 'File rejected.' }, 'File rejected.'],
    [{ message: 'Connection failed.' }, 'Connection failed.'],
  ])('preserves a useful local or HTTP error', (error, message) => {
    expect(errorMessage(error)).toBe(message)
  })

  it.each([null, undefined, '', '  ', new Error(''), { data: '  ' }, { data: 42 }, { detail: [] }])(
    'uses the fallback for missing or blank error details',
    (error) => {
      expect(errorMessage(error)).toBe('The operation could not be completed.')
      expect(errorMessage(error, 'The request failed.')).toBe('The request failed.')
    },
  )

  it('uses the exception message if a response body has no useful detail', () => {
    expect(errorMessage({ data: { detail: '' }, message: 'The connection closed.' })).toBe(
      'The connection closed.',
    )
  })
})
