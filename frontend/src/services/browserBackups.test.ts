import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dataset } from '../test/fixtures'
import { prepareBackupRestore } from './browserBackups'
import { validateBackup } from './demo/backups'
import { stageBackup } from './fileStaging'

vi.mock('./demo/backups', () => ({ validateBackup: vi.fn() }))
vi.mock('./fileStaging', () => ({ stageBackup: vi.fn(() => 'restore-reference') }))

describe('browser backup restore preview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns counts from validated data and stages the original supported archive', async () => {
    const legacyArchive = Object.freeze({ format: 'ucl-admissions-demo', version: 1 })
    vi.mocked(validateBackup).mockResolvedValue({ dataset, files: {} })

    await expect(prepareBackupRestore(legacyArchive)).resolves.toEqual({
      id: 'restore-reference',
      applications: dataset.applications.length,
      documents: dataset.documents.length,
    })
    expect(validateBackup).toHaveBeenCalledWith(legacyArchive)
    expect(stageBackup).toHaveBeenCalledWith(legacyArchive)
  })

  it('never stages an archive that fails validation', async () => {
    vi.mocked(validateBackup).mockRejectedValue(new Error('Invalid backup'))
    await expect(prepareBackupRestore({})).rejects.toThrow('Invalid backup')
    expect(stageBackup).not.toHaveBeenCalled()
  })
})
