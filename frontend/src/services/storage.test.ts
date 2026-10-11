import { beforeEach, describe, expect, it } from 'vitest'
import { readDataset, readFile, sha256, writeDataset } from './storage'
import { dataset } from '../test/fixtures'
import type { Dataset } from '../domain/types'
beforeEach(async () => {
  await writeDataset(structuredClone(dataset), {}, [], true)
})
describe('IndexedDB record and PDF persistence', () => {
  it('preserves dataset and original bytes across independent reads', async () => {
    await writeDataset(dataset, { source: new Blob(['original PDF']) })
    expect(await readDataset()).toEqual(dataset)
    expect(await (await readFile('source'))?.text()).toBe('original PDF')
    const copy = (await readDataset())!
    copy.users[0].name = 'Unsaved change'
    expect((await readDataset())!.users[0].name).toBe(dataset.users[0].name)
  })
  it('deletes selected PDF blobs and replaces all blobs only when requested', async () => {
    await writeDataset(dataset, { a: new Blob(['a']), b: new Blob(['b']) })
    await writeDataset(dataset, { c: new Blob(['c']) }, ['a'])
    expect(await readFile('a')).toBeUndefined()
    expect(await readFile('b')).toBeDefined()
    await writeDataset(dataset, { d: new Blob(['d']) }, [], true)
    expect(await readFile('b')).toBeUndefined()
    expect(await readFile('c')).toBeUndefined()
    expect(await (await readFile('d'))?.text()).toBe('d')
  })
  it('rolls back PDF changes as well as records when a transaction cannot save', async () => {
    await writeDataset(dataset, { original: new Blob(['original']) })
    const invalid = { ...dataset, cannotClone: () => {} } as Dataset
    await expect(
      writeDataset(invalid, { partial: new Blob(['partial']) }, ['original']),
    ).rejects.toThrow('Browser storage could not save')
    expect(await readDataset()).toEqual(dataset)
    expect(await readFile('partial')).toBeUndefined()
    expect(await readFile('original')).toBeDefined()
  })
  it('hashes PDF bytes deterministically for tamper verification', async () => {
    expect(await sha256(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await sha256(new Blob(['abcd']))).not.toBe(await sha256(new Blob(['abc'])))
  })
})
