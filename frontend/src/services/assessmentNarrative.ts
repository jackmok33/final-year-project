import { validateRubric } from '../domain/rules'
import {
  isAssessmentReady,
  legacySectionKeys,
  latestRun,
  sectionKeys,
  type Application,
  type AssessmentRun,
  type Rubric,
  type SectionKey,
  type SectionScore,
} from '../domain/types'
import { applicantEvidence } from './applicantPresentation'

const legacyExplanations: Record<SectionKey, readonly string[]> = {
  academic: [
    'Relevant modules are strong; the final grade needs source verification.',
    'Relevant undergraduate qualification and modules are supported by the synthetic transcript.',
  ],
  cv: ['Relevant project and internship experience are supported by the synthetic CV.'],
  statement: [
    'Motivation is stated; programme-specific detail is limited in this synthetic example.',
  ],
  references: [],
}

/** Expand old presentation fixtures only; stored runs and future evaluator output stay untouched. */
export function presentAssessment(
  application: Application,
  run: AssessmentRun,
  rubric: Rubric | undefined,
): AssessmentRun {
  if (
    !rubric ||
    rubric.id !== run.rubricId ||
    rubric.programmeId !== application.programmeId ||
    validateRubric(rubric) ||
    !consistentScores(run, rubric) ||
    run.applicationId !== application.id ||
    latestRun(application)?.id !== run.id ||
    !isAssessmentReady(run) ||
    !applicantEvidence(application, run).length
  )
    return run

  const sections = run.sections.map((section) =>
    section.score !== null && legacyExplanations[section.key].includes(section.explanation)
      ? { ...section, explanation: sectionNarrative(section, run, rubric) }
      : section,
  )
  const summary = isLegacySummary(run.justification.summary)
    ? recommendationNarrative(run, rubric)
    : run.justification.summary
  if (
    summary === run.justification.summary &&
    sections.every((section, i) => section === run.sections[i])
  )
    return run
  return {
    ...run,
    sections,
    justification:
      summary === run.justification.summary ? run.justification : { ...run.justification, summary },
  }
}

function consistentScores(run: AssessmentRun, rubric: Rubric) {
  if (
    (rubric.weights.references ?? 0) > 0 ||
    !legacySectionKeys.every((key) => run.sections.some((section) => section.key === key)) ||
    new Set(run.sections.map((section) => section.key)).size !== run.sections.length ||
    run.sections.some((section) => !sectionKeys.some((key) => section.key === key)) ||
    run.sections.some(
      (section) =>
        section.score !== null &&
        (!Number.isFinite(section.score) || section.score < 0 || section.score > 100),
    )
  )
    return false
  const coreSections = run.sections.filter((section) => section.key !== 'references')
  if (coreSections.some((section) => section.score === null)) return run.overall === null
  const expected =
    Math.round(
      coreSections.reduce(
        (total, section) => total + (section.score! * (rubric.weights[section.key] ?? 0)) / 100,
        0,
      ) * 100,
    ) / 100
  return run.overall !== null && Math.abs(expected - run.overall) < 0.005
}

function isLegacySummary(summary: string) {
  if (summary.includes('\n') || summary.length > 700) return false
  return (
    /^(Offer|Reject|Further review) is recommended for this synthetic case\./.test(summary) ||
    summary.startsWith(
      'Further review is required because the extracted final grade (71%) conflicts with the transcript (74%, page 2).',
    ) ||
    summary ===
      'A required document is missing, so the assessment is incomplete. Review the source documents before making a decision.' ||
    summary.startsWith('FastAPI mock assessment: ')
  )
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100)
}

function weighting(section: SectionScore, rubric: Rubric) {
  const weight = rubric.weights[section.key] ?? 0
  return `Under criteria v${rubric.version}, this section carries ${formatNumber(weight)}% of the overall weighting. Its recorded score of ${formatNumber(section.score!)} / 100 contributes ${formatNumber((section.score! * weight) / 100)} points to a complete weighted result.`
}

function sectionNarrative(section: SectionScore, run: AssessmentRun, rubric: Rubric) {
  const score = section.score!
  if (section.key === 'academic') {
    const grade =
      run.extractedGrade === null
        ? 'No final degree percentage is recorded.'
        : `The extracted final average is ${formatNumber(run.extractedGrade)}%.`
    const concern = run.flags.some((flag) => flag.code === 'GRADE_MISMATCH')
      ? 'The extracted average conflicts with the 74% shown in the transcript. Both values are retained as a source-verification concern for the tutor to consider.'
      : 'The module list gives useful evidence of computing preparation, but does not by itself establish complete coverage of every mathematical prerequisite or the depth of each syllabus.'
    return [
      section.explanation,
      `The academic assessment considers the Computer Science qualification and the listed module results: Machine Learning 78%, Algorithms 76%, Database Systems 72% and final-year project 79%. These provide evidence of applied machine learning, computational problem solving and independent project work. ${grade} The academic section score of ${formatNumber(score)} / 100 is a separate assessment value, not a conversion of that degree percentage.`,
      `${concern} ${score < 60 ? 'The lower recorded section score therefore represents a weaker overall assessment of preparation or fit; it must not be read as evidence of lower transcript marks or a failed degree.' : 'The stronger module results support the academic case, while the limited description of module content leaves some uncertainty about preparation for advanced study.'} ${weighting(section, rubric)}`,
    ].join('\n\n')
  }
  if (section.key === 'cv')
    return [
      section.explanation,
      'The CV records a software-engineering internship, building and testing a web application with a small team, and a final-year project on evidence-linked document assessment. These examples are relevant to practical implementation, testing and collaborative development. The assessment considers the relevance of the activities and the work described, rather than treating a job title or a list of technical interests as proof of proficiency.',
      `The brief source does not quantify project outcomes, separate the applicant’s contribution from the team’s work, or give enough implementation detail to assess research depth. No internship duration, leadership responsibility or independently verified publication is inferred. ${score < 60 ? 'The lower recorded score reflects limited documented depth, rather than an assumption that the experience did not occur.' : 'The recorded score gives credit for relevant practical exposure while leaving room for stronger evidence of individual responsibility and measurable results.'} ${weighting(section, rubric)}`,
    ].join('\n\n')
  return [
    section.explanation,
    'The statement expresses an interest in extending the applicant’s computer-science knowledge and links that goal to research skills developed during the final-year project. This provides a coherent starting point for postgraduate study and connects motivation with an existing academic activity. The assessment considers whether the stated goals explain the next step in the applicant’s education, rather than rewarding general enthusiasm alone.',
    `Programme-specific interests still require detail. The short statement does not identify a particular research question, explain how selected course topics support a concrete goal, or describe what the applicant learned from a difficult project decision. Those gaps limit the evidence of programme fit; they do not establish a lack of motivation or predict future performance. ${weighting(section, rubric)} The recorded score remains separate from any estimate of language proficiency or writing originality.`,
  ].join('\n\n')
}

function recommendationNarrative(run: AssessmentRun, rubric: Rubric) {
  const coreSections = run.sections.filter((section) => section.key !== 'references')
  const complete = run.overall !== null && coreSections.every((section) => section.score !== null)
  const totals = coreSections
    .map((section) =>
      section.score === null
        ? `${section.key}: unavailable`
        : `${section.key}: ${formatNumber(section.score)} / 100 at ${formatNumber(rubric.weights[section.key] ?? 0)}%`,
    )
    .join('; ')
  const combination = complete
    ? `The recorded overall score is ${formatNumber(run.overall!)} / 100. Criteria v${rubric.version} combines the section assessments as ${totals}. The academic score evaluates preparation, the CV score evaluates documented practical experience, and the statement score evaluates motivation and programme fit. These section scores are distinct from the applicant’s degree percentage.`
    : `A complete weighted result is unavailable because at least one required section has no assessment. The available section results are ${totals}. Missing evidence is not assigned a zero or replaced with an assumed strength; the unassessed section must remain unavailable.`
  const sourceContext =
    'The supporting material includes computing-module results, an internship and team-development example, and a statement connecting further study with final-year research. Together these address different aspects of readiness. Their main limitations are the brief descriptions of individual project contributions and the lack of a specific programme-focused study goal. Stronger evidence in one area does not remove uncertainty in another.'
  const concerns = run.flags.length
    ? `The assessment retains these concerns: ${run.flags.map((flag) => flag.message).join(' ')} They explain the cautious recommendation and remain visible for review; recording a tutor decision does not erase them.`
    : 'No review flag is recorded for this result. That does not independently verify every statement in the documents or remove the limitations described in the section assessments.'
  const threshold = complete
    ? `The applicable criteria use an offer threshold of ${formatNumber(rubric.offerFrom)}, a rejection threshold of ${formatNumber(rubric.rejectBelow)} and an inclusive review margin of ±${formatNumber(rubric.margin)} points. The recommendation follows these rules: ${run.justification.rules.join(' ')} The recommendation supports the tutor’s judgement; the final recorded outcome remains the tutor’s choice.`
    : 'The absence of a complete score prevents a valid comparison with the stored thresholds. The recommendation and the tutor’s final recorded decision remain separate.'
  return [
    run.justification.summary,
    combination,
    complete
      ? sourceContext
      : 'The explanation is limited to available evidence. It does not claim that a missing source was read or that the application received a complete assessment.',
    `${concerns} ${threshold}`,
  ].join('\n\n')
}
