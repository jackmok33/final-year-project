import type { Application, DocumentRecord, Rubric } from '../domain/types'
import { backendUrl, evaluateBackend } from './backend'
import { simulateRun } from './seed'

/** Transport selection stays outside screen code and never sends uploaded PDF contents. */
export async function evaluateApplication(
  app: Application,
  docs: DocumentRecord[],
  rubric: Rubric,
  grade: number | null,
  modelAvailable: boolean,
) {
  return backendUrl() && app.fixture
    ? evaluateBackend(app, docs, rubric, grade, modelAvailable)
    : simulateRun(app, docs, rubric, grade, modelAvailable)
}
