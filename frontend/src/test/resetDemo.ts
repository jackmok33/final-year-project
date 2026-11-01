import { assignExistingBatches } from '../domain/batches'
import { recordAudit, runExclusive } from '../services/demo/runtime'
import { createSeed } from '../services/seed'
import { writeDataset } from '../services/storage'

/** Isolated test-fixture setup, never exposed as an application command. */
export function resetDemo() {
  return runExclusive(async () => {
    const seed = await createSeed()
    assignExistingBatches(seed.dataset)
    recordAudit(seed.dataset, 'admin-a', 'Reset browser demo', 'demo-dataset')
    await writeDataset(seed.dataset, seed.files, [], true)
  })
}
