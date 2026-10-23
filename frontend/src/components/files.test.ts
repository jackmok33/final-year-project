// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { displayTime, downloadBlob } from './files'
describe('document/CSV download helpers', () => {
  it('downloads original bytes and releases the object URL after the click', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:demo'),
      revoke = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create
        static revokeObjectURL = revoke
      },
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const blob = new Blob(['original bytes'])
    downloadBlob(blob, 'source.pdf')
    expect(create).toHaveBeenCalledWith(blob)
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toBe('blob:demo')
    expect(anchor.download).toBe('source.pdf')
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:demo')
    vi.unstubAllGlobals()
  })
  it('formats time using the UK locale and readable date/time options', () => {
    const format = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('10 Oct 2026, 09:00')
    expect(displayTime('2026-10-10T09:00:00Z')).toBe('10 Oct 2026, 09:00')
    expect(format).toHaveBeenCalledWith('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  })
})
