import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizedFile, commandDemo, queryDemo, releaseArchive, stageArchive } from '../demo'
import { inspectPdf } from '../pdf'
import { readDataset, writeDataset } from '../storage'
vi.mock('../pdf', () => ({ inspectPdf: vi.fn() }))
describe('persistent browser demo contract', () => {
  const id = 'APP-2026-0142'
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => ({
      pages: file.name.includes('large') ? 60 : 4,
    }))
  })
  it('enforces roles, programme scope and inactive users at the service boundary', async () => {
    await expect(queryDemo({ op: 'application', id }, 'admin-a')).rejects.toThrow('tutor access')
    await expect(authorizedFile(`${id}-transcript`, 'admin-a')).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'users' }, 'tutor-a')).rejects.toThrow('Administrator')
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-1' }, null),
    ).rejects.toThrow('session')
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-1' }, 'former-tutor'),
    ).rejects.toThrow('deactivated')
    const data = (await readDataset())!
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds = []
    await commandDemo({ op: 'user', user: data.users.find((u) => u.id === 'tutor-b')! }, 'admin-a')
    await expect(queryDemo({ op: 'application', id }, 'tutor-b')).rejects.toThrow('programme')
  })
})
describe('persistent ZIP upload batches', () => {
  function makeZip(
    files: Record<string, string> = {
      'A-001/cv.pdf': 'original cv',
      'A-002/transcript.pdf': 'original transcript',
    },
  ) {
    return new File(
      [
        new Uint8Array(
          zipSync(
            Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])),
          ),
        ),
      ],
      'November applications.zip',
    )
  }
  async function importZip(
    file = makeZip(),
    programmeId = 'programme-1',
    year = '2026 / 27',
    actor = 'tutor-a',
  ) {
    const archiveId = stageArchive(file)
    try {
      return await commandDemo(
        { op: 'importBatch', programmeId, intakeYear: year, archiveId },
        actor,
      )
    } finally {
      releaseArchive(archiveId)
    }
  }
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => {
      const text = await file.text()
      if (text === 'bad') throw new Error('Unreadable PDF')
      return { pages: text === 'large' ? 60 : 1 }
    })
  })
  it('enforces tutor membership for import, batch listing and direct batch access', async () => {
    const { id } = await importZip(makeZip(), 'programme-2')
    await expect(queryDemo({ op: 'batch', id: id! }, 'tutor-b')).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'batch', id: id! }, 'admin-a')).rejects.toThrow('tutor access')
    await expect(
      queryDemo({ op: 'batches', programmeId: 'programme-2', intakeYear: '26/27' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(importZip(makeZip(), 'programme-2', '26/27', 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(importZip(makeZip(), 'programme-1', '26/27', 'admin-a')).rejects.toThrow(
      'tutor access',
    )
    await expect(importZip(makeZip(), 'programme-1', '2026 / 30')).rejects.toThrow('valid intake')
    await expect(queryDemo({ op: 'batch', id: 'missing' }, 'tutor-a')).rejects.toThrow('not found')
    await expect(
      commandDemo(
        { op: 'importBatch', programmeId: 'programme-1', intakeYear: '26/27', archiveId: 'gone' },
        'tutor-a',
      ),
    ).rejects.toThrow('Select the ZIP')
  })
})
describe('private tutor courses', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  it('does not grant applicant access from forged legacy assignments', async () => {
    const data = (await readDataset())!
    const application = data.applications[0]
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds = ['programme-1']
    await writeDataset(data)
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toEqual([])
    await expect(queryDemo({ op: 'application', id: application.id }, 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(authorizedFile(application.documentIds[0], 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    const user = data.users.find((u) => u.id === 'tutor-b')!
    await expect(commandDemo({ op: 'user', user }, 'admin-a')).rejects.toThrow('cannot be assigned')
    await expect(
      commandDemo({ op: 'programme', programme: { ...data.programmes[0], id: '' } }, 'admin-a'),
    ).rejects.toThrow('Tutors add their own courses')
  })
})
