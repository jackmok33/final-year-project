import { aggregate } from '../domain/rules'
import type {
  Application,
  AssessmentRun,
  Dataset,
  DocumentRecord,
  DocumentType,
  Rubric,
  SectionScore,
  UploadBatch,
} from '../domain/types'
import { sha256 } from './storage'

export const baseRubric: Rubric = {
  id: 'rubric-1',
  programmeId: 'programme-1',
  version: '1.0',
  createdAt: '2026-10-09T09:00:00Z',
  weights: { academic: 50, cv: 25, statement: 25 },
  rejectBelow: 60,
  offerFrom: 80,
  margin: 3,
  mandatoryRule: 'Relevant undergraduate qualification',
}
export const firstProgramme = {
  id: 'programme-1',
  name: 'Computational Statistics and Machine Learning MSc',
  code: 'COMP0001',
  year: '2026 / 27',
  department: 'Example department',
  description: 'Illustrative course workspace. Not UCL admissions policy.',
}
export const secondProgramme = {
  id: 'programme-2',
  name: 'Machine Learning MSc',
  code: 'COMP0002',
  year: '2026 / 27',
  department: 'Example department',
  description: 'Synthetic second course workspace. Not UCL admissions policy.',
}
export const thirdProgramme = {
  id: 'programme-3',
  name: 'Computer Science MSc',
  code: 'CS-MSC-DEMO',
  year: '2026 / 27',
  department: 'Example department',
  description: 'Illustrative course workspace. Not UCL admissions policy.',
}
export const thirdRubric: Rubric = {
  ...baseRubric,
  id: 'rubric-3',
  programmeId: thirdProgramme.id,
  weights: { ...baseRubric.weights },
}
export const secondRubric: Rubric = {
  ...baseRubric,
  id: 'rubric-2',
  programmeId: secondProgramme.id,
  weights: { academic: 60, cv: 20, statement: 20 },
  offerFrom: 85,
}
async function syntheticPdf(type: DocumentType, candidate: string, grade: number) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages = type === 'transcript' ? 4 : 2
  for (let i = 1; i <= pages; i++) {
    const page = pdf.addPage([595, 842])
    page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: rgb(0.21, 0.1, 0.33) })
    page.drawText('SYNTHETIC UNIVERSITY', {
      x: 40,
      y: 801,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    })
    const lines =
      type === 'transcript'
        ? i === 2
          ? [
              'Academic transcript',
              `Candidate: ${candidate}`,
              'Qualification: BSc Computer Science',
              'Award year: 2026',
              '',
              'Machine Learning                         78%',
              'Algorithms                                     76%',
              'Database Systems                          72%',
              'Final-year project                           79%',
              '',
              `Final weighted average: ${grade}%`,
            ]
          : [
              'Academic transcript',
              `Candidate: ${candidate}`,
              `Academic record - page ${i}`,
              'Relevant undergraduate qualification: verified',
              'Synthetic document for interface demonstration.',
            ]
        : type === 'cv'
          ? [
              'Curriculum vitae',
              `Candidate: ${candidate}`,
              'Software engineering internship',
              'Built and tested a web application with a small team.',
              'Final-year project: evidence-linked document assessment.',
              'Relevant programming and analytical experience.',
            ]
          : [
              'Personal statement',
              `Candidate: ${candidate}`,
              'I want to extend my knowledge of computer science.',
              'My final-year project developed my research skills.',
              'Programme-specific interests require further detail.',
            ]
    lines.forEach((line, n) =>
      page.drawText(line, {
        x: 40,
        y: 720 - n * 32,
        size: n === 0 ? 22 : 13,
        font: n === 0 || line.startsWith('Final weighted') ? bold : font,
        color: rgb(0.21, 0.1, 0.33),
      }),
    )
    page.drawText('Synthetic record. No real applicant data or official admissions policy.', {
      x: 40,
      y: 58,
      size: 10,
      font,
    })
    page.drawText(`Page ${i} of ${pages}`, { x: 40, y: 35, size: 10, font })
  }
  return new Blob([new Uint8Array(await pdf.save()).buffer], { type: 'application/pdf' })
}

export function simulateRun(
  app: Application,
  docs: DocumentRecord[],
  rubric: Rubric,
  grade: number | null,
  modelAvailable: boolean,
): AssessmentRun {
  const previous = app.runs.at(-1)
  const flagMismatch = app.fixture === 'review' && grade !== 74
  const missing = !(['transcript', 'cv', 'statement'] as const).every((t) =>
    docs.some((d) => d.type === t),
  )
  const unsupported = !!app.fixture && grade !== 74 && !(app.fixture === 'review' && grade === 71)
  const unavailable = !app.fixture || unsupported
  const failed = app.fixture === 'failed' && !modelAvailable
  const scores =
    app.fixture === 'offer'
      ? [90, 88, 86]
      : app.fixture === 'reject'
        ? [45, 50, 48]
        : [84, 76, 69.6]
  const sections: SectionScore[] = (['academic', 'cv', 'statement'] as const).map((key, i) => {
    const doc = docs.find((d) => d.type === (key === 'academic' ? 'transcript' : key))
    const score = unavailable || failed || !doc ? null : scores[i]
    const explanation =
      score == null
        ? unavailable
          ? 'Evaluation requires the backend and local model. No score has been generated.'
          : failed
            ? 'The simulated model service is unavailable.'
            : 'The required source document is missing.'
        : key === 'academic'
          ? flagMismatch
            ? 'Relevant modules are strong; the final grade needs source verification.'
            : 'Relevant undergraduate qualification and modules are supported by the synthetic transcript.'
          : key === 'cv'
            ? 'Relevant project and internship experience are supported by the synthetic CV.'
            : 'Motivation is stated; programme-specific detail is limited in this synthetic example.'
    return {
      key,
      score,
      explanation,
      uncertainty:
        score == null
          ? 'Insufficient evidence'
          : key === 'cv'
            ? 'Low uncertainty'
            : 'Moderate uncertainty',
      citations:
        doc && !unavailable
          ? [
              {
                documentId: doc.id,
                page: key === 'academic' ? Math.min(2, doc.pages) : 1,
                claim:
                  key === 'academic' ? `Final weighted average: ${grade ?? 74}%.` : explanation,
              },
            ]
          : [],
    }
  })
  const flags = [
    ...(flagMismatch
      ? [
          {
            code: 'GRADE_MISMATCH',
            message:
              'Extracted final grade: 71%. Transcript page 2 shows 74%. Verify and correct the fact.',
            critical: true,
          },
        ]
      : []),
    ...(missing
      ? [
          {
            code: 'MISSING_DOCUMENT',
            message:
              'A mandatory source document is missing. No complete overall score is available.',
            critical: true,
          },
        ]
      : []),
    ...(unavailable
      ? [
          {
            code: 'BACKEND_UNAVAILABLE',
            message:
              'This upload needs the backend and local AI service. Demo scores are available only for seeded synthetic cases.',
            critical: true,
          },
        ]
      : []),
    ...(failed
      ? [
          {
            code: 'MODEL_UNAVAILABLE',
            message: 'Simulated model unavailable. Retry after the demo service recovers.',
            critical: true,
          },
        ]
      : []),
  ]
  const result = aggregate(
    sections,
    rubric,
    flags.some((f) => f.critical),
  )
  const nearThreshold =
    result.overall === null
      ? undefined
      : [rubric.offerFrom, rubric.rejectBelow].find(
          (threshold) => Math.abs(result.overall! - threshold) <= rubric.margin,
        )
  const scoreContext =
    nearThreshold === undefined
      ? `The score of ${result.overall} cannot resolve this critical contradiction.`
      : `The score of ${result.overall} also lies within the inclusive ±${rubric.margin}-point review margin around the ${nearThreshold === rubric.offerFrom ? 'offer' : 'rejection'} threshold of ${nearThreshold}.`
  const summary = unavailable
    ? 'No assessment has been produced for these documents. Connect the backend and local model before evaluating this application.'
    : failed
      ? 'The simulated model service is unavailable. The application needs further review; no score has been calculated.'
      : missing
        ? 'A required document is missing, so the assessment is incomplete. Review the source documents before making a decision.'
        : flagMismatch
          ? `Further review is required because the extracted final grade (71%) conflicts with the transcript (74%, page 2). ${scoreContext} Criteria v${rubric.version} applies.`
          : `${result.recommendation} is recommended for this synthetic case. The weighted score is ${result.overall}: academic ${scores[0]}, CV ${scores[1]}, statement ${scores[2]}. ${result.rules.join(' ')} The cited source pages remain available for tutor review.`
  const startedAt = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    applicationId: app.id,
    rubricId: rubric.id,
    startedAt,
    finishAt: new Date(Date.now() + 1800).toISOString(),
    status: 'queued',
    sections,
    ...result,
    justification: {
      summary,
      citations: sections.flatMap((s) => s.citations),
      rules: result.rules,
    },
    flags,
    extractedGrade: unavailable ? null : grade,
    parentRunId: previous?.id,
    error: failed ? 'MODEL_UNAVAILABLE' : undefined,
    simulated: true,
  }
}
const sampleBatches: UploadBatch[] = [
  {
    id: 'sample-csml-october-12',
    programmeId: 'programme-1',
    intakeYear: '2026 / 27',
    filename: 'Sample October applications.zip',
    uploadedAt: '2026-10-12T10:30:00Z',
    uploadedBy: 'tutor-a',
    source: 'zip',
  },
  {
    id: 'sample-csml-october-16',
    programmeId: 'programme-1',
    intakeYear: '2026 / 27',
    filename: 'Sample reviewed applications.zip',
    uploadedAt: '2026-10-16T13:00:00Z',
    uploadedBy: 'tutor-a',
    source: 'zip',
  },
]
const sampleBatchAudit = {
  id: 'sample-csml-batches-v2',
  at: '2026-10-16T15:00:00Z',
  actor: 'tutor-a',
  action: 'Add sample course batches',
  target: 'sample-batches',
}
export async function createSeed(): Promise<{ dataset: Dataset; files: Record<string, Blob> }> {
  const files: Record<string, Blob> = {}
  const documents: DocumentRecord[] = []
  const applications: Application[] = []
  for (const [index, fixture] of (
    [
      'review',
      'offer',
      'reject',
      'missing',
      'failed',
      'offer',
      'offer',
      'missing',
      'reject',
    ] as const
  ).entries()) {
    const id =
      index >= 6
        ? `SAMPLE-CSML-${String(index - 5).padStart(2, '0')}`
        : `APP-2026-${String(142 + index).padStart(4, '0')}`
    const candidate = `SYN-${142 + index}`
    const batch = index >= 6 ? sampleBatches[index === 8 ? 1 : 0] : undefined
    const app: Application = {
      id,
      candidate,
      programmeId: index === 5 ? 'programme-2' : 'programme-1',
      intakeYear: '2026 / 27',
      submittedAt: batch?.uploadedAt ?? '2026-10-08T09:00:00Z',
      ...(batch ? { batchId: batch.id } : {}),
      documentIds: [],
      fixture,
      runs: [],
      corrections: [],
      decisions: [],
    }
    for (const type of ['transcript', 'cv', 'statement'] as const) {
      if (fixture === 'missing' && type === 'statement') continue
      const blob = await syntheticPdf(type, candidate, 74)
      const doc: DocumentRecord = {
        id: `${id}-${type}`,
        applicationId: id,
        type,
        name:
          type === 'transcript'
            ? 'Transcript.pdf'
            : type === 'cv'
              ? 'CV.pdf'
              : 'Personal statement.pdf',
        size: blob.size,
        pages: type === 'transcript' ? 4 : 2,
        hash: await sha256(blob),
      }
      files[doc.id] = blob
      documents.push(doc)
      app.documentIds.push(doc.id)
    }
    const run = simulateRun(
      app,
      documents.filter((d) => d.applicationId === id),
      index === 5 ? secondRubric : baseRubric,
      fixture === 'review' ? 71 : 74,
      false,
    )
    run.startedAt = batch?.uploadedAt ?? '2026-10-09T10:42:00Z'
    run.finishAt = new Date(Date.parse(run.startedAt) + 1000).toISOString()
    run.status = fixture === 'failed' ? 'failed' : 'awaiting review'
    app.runs.push(run)
    if (index === 6 || index === 8) {
      app.decisions.push({
        id: `sample-decision-${id}`,
        runId: run.id,
        recommendation: run.recommendation,
        outcome: index === 6 ? 'Offer' : 'Reject',
        reason: 'Synthetic example: source evidence reviewed by the tutor.',
        actor: 'tutor-a',
        at: new Date(Date.parse(run.finishAt) + 3600000).toISOString(),
      })
    }
    applications.push(app)
  }
  return {
    files,
    dataset: {
      version: 2,
      users: [
        {
          id: 'tutor-a',
          name: 'Jack · Demo tutor',
          email: 'tutor@demo.ucl.local',
          roles: ['tutor'],
          programmeIds: ['programme-1', 'programme-2', 'programme-3'],
          canPublishCriteria: true,
          active: true,
        },
        {
          id: 'tutor-b',
          name: 'Demo tutor B',
          email: 'tutor.b@demo.ucl.local',
          roles: ['tutor'],
          programmeIds: [],
          canPublishCriteria: false,
          active: true,
        },
        {
          id: 'admin-a',
          name: 'Demo administrator',
          email: 'admin@demo.ucl.local',
          roles: ['admin'],
          programmeIds: [],
          canPublishCriteria: false,
          active: true,
        },
        {
          id: 'former-tutor',
          name: 'Former tutor',
          email: 'former@demo.ucl.local',
          roles: ['tutor'],
          programmeIds: [],
          canPublishCriteria: false,
          active: false,
        },
      ],
      programmes: [firstProgramme, secondProgramme, thirdProgramme].map((p) => ({
        ...p,
        createdBy: 'tutor-a',
      })),
      rubrics: [baseRubric, secondRubric, thirdRubric],
      activeRubricIds: {
        'programme-1': baseRubric.id,
        'programme-2': secondRubric.id,
        'programme-3': thirdRubric.id,
      },
      applications,
      batches: structuredClone(sampleBatches),
      documents,
      audit: [{ ...sampleBatchAudit }],
      modelAvailable: false,
    },
  }
}

/** Install code-defined defaults and repair older incomplete upgrades without resetting data. */
export async function addSampleCourseBatches(data: Dataset): Promise<Record<string, Blob>> {
  if (data.audit.some((event) => event.id === sampleBatchAudit.id)) return {}
  const programme = data.programmes.find((p) => p.id === 'programme-1')
  const rubric = data.rubrics.find((r) => r.id === baseRubric.id && r.programmeId === programme?.id)
  if (
    programme?.name !== 'Computational Statistics and Machine Learning MSc' ||
    programme.createdBy !== 'tutor-a' ||
    !rubric ||
    !data.users.some((u) => u.id === 'tutor-a' && u.roles.includes('tutor'))
  )
    return {}

  const installed = sampleBatches.map((example) => data.batches?.find((b) => b.id === example.id))
  // Reserved IDs must never overwrite another course or intake's batch.
  if (
    installed.some(
      (batch) => batch && (batch.programmeId !== programme.id || batch.intakeYear !== '2026 / 27'),
    )
  )
    return {}
  const complete = () => data.audit.push({ ...sampleBatchAudit, at: new Date().toISOString() })
  if (installed.every(Boolean)) {
    // A successful older install may have intentional applicant deletions. Keep them.
    complete()
    return {}
  }

  const cases = [
    {
      id: 'SAMPLE-CSML-01',
      legacyId: 'APP-2026-0148',
      candidate: 'SYN-148',
      fixture: 'offer',
      batch: sampleBatches[0],
    },
    {
      id: 'SAMPLE-CSML-02',
      legacyId: 'APP-2026-0149',
      candidate: 'SYN-149',
      fixture: 'missing',
      batch: sampleBatches[0],
    },
    {
      id: 'SAMPLE-CSML-03',
      legacyId: 'APP-2026-0150',
      candidate: 'SYN-150',
      fixture: 'reject',
      batch: sampleBatches[1],
    },
  ] as const
  const existing = cases.map((example) =>
    data.applications.find(
      (a) =>
        (a.id === example.id || a.id === example.legacyId) &&
        a.programmeId === programme.id &&
        a.candidate === example.candidate &&
        a.fixture === example.fixture,
    ),
  )
  if (
    cases.some((example, index) => {
      const application = existing[index]
      const currentBatch = data.batches?.find((b) => b.id === application?.batchId)
      return (
        // An unrelated record/PDF at a reserved reference is preserved; do not mark success.
        (data.applications.some((a) => a.id === example.id) && application?.id !== example.id) ||
        (!application && data.documents.some((d) => d.id.startsWith(`${example.id}-`))) ||
        (currentBatch?.source === 'zip' && currentBatch.id !== example.batch.id)
      )
    })
  )
    return {}

  const seed = await createSeed()
  const files: Record<string, Blob> = {}
  for (const [index, example] of cases.entries()) {
    const application = existing[index]
    if (application) {
      // Legacy backups may group synthetic cases into the original batch. Restore
      // their default grouping without touching facts, decisions, runs or PDFs.
      application.batchId = example.batch.id
      continue
    }
    if (
      data.audit.some(
        (event) =>
          event.action === 'Delete application and documents' &&
          (event.target === example.id || event.target === example.legacyId),
      )
    )
      continue
    const added = seed.dataset.applications.find((a) => a.id === example.id)!
    const documents = seed.dataset.documents.filter((d) => d.applicationId === added.id)
    const previous = added.runs[0]
    const run = simulateRun(added, documents, rubric, 74, false)
    Object.assign(run, {
      startedAt: previous.startedAt,
      finishAt: previous.finishAt,
      status: previous.status,
    })
    added.runs = [run]
    added.decisions.forEach((decision) => {
      decision.runId = run.id
      decision.recommendation = run.recommendation
    })
    data.applications.push(added)
    data.documents.push(...documents)
    for (const document of documents) files[document.id] = seed.files[document.id]
  }
  data.batches ??= []
  for (const [index, example] of sampleBatches.entries()) {
    if (!installed[index]) data.batches.push({ ...example })
  }
  complete()
  return files
}
